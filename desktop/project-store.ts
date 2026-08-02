import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { isBRIGXSession } from '../lib/session';
import { isCircularPlotData } from '../lib/plotValidation';
import type {
  BRIGXProjectManifest,
  DesktopMainFileBinding,
  DesktopMainSaveProjectRequest,
  DesktopOpenProjectResult,
  DesktopOpenedFile,
  DesktopRecentProject,
  PersistedProjectFile,
} from './contracts';
import {
  BRIGX_PROJECT_SCHEMA_VERSION,
  BRIGX_PROJECT_TYPE,
} from './contracts';

const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_TOTAL_INPUT_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PROJECT_FILES = 1_000;
const MAX_RECENT_PROJECTS = 10;

interface RegisteredFile {
  filePath: string;
  signature: string;
  sha256?: string;
}

interface RecentProjectRecord extends DesktopRecentProject {
  filePath: string;
}

interface ProjectStoreOptions {
  appVersion: string;
  userDataDirectory: string;
}

export class ProjectStore {
  private readonly appVersion: string;
  private readonly userDataDirectory: string;
  private readonly tokenRegistry = new Map<string, RegisteredFile>();
  private currentProjectPath: string | null = null;

  constructor(options: ProjectStoreOptions) {
    this.appVersion = options.appVersion;
    this.userDataDirectory = options.userDataDirectory;
  }

  get recoveryPath(): string {
    return path.join(this.userDataDirectory, 'recovery.brigx');
  }

  startNewProject(): void {
    this.currentProjectPath = null;
  }

  async saveProject(
    request: DesktopMainSaveProjectRequest,
    destinationPath: string,
    includeHashes = true,
  ): Promise<void> {
    const manifest = await this.createManifest(request, destinationPath, includeHashes);
    await writeJsonAtomically(destinationPath, manifest, MAX_PROJECT_BYTES);
    if (destinationPath !== this.recoveryPath) {
      this.currentProjectPath = destinationPath;
      await this.rememberRecentProject(destinationPath);
    }
  }

  async openProject(projectPath: string): Promise<DesktopOpenProjectResult> {
    const manifest = await readManifest(projectPath);
    const issues: string[] = [];
    const files: DesktopOpenedFile[] = [];
    let totalBytes = 0;

    for (const entry of manifest.files) {
      const resolvedPath = resolvePersistedPath(projectPath, entry);
      try {
        const metadata = await stat(resolvedPath);
        if (!metadata.isFile()) throw new Error('not a regular file');
        if (metadata.size > MAX_INPUT_BYTES) {
          throw new Error(`larger than the ${formatBytes(MAX_INPUT_BYTES)} desktop limit`);
        }
        totalBytes += metadata.size;
        if (totalBytes > MAX_TOTAL_INPUT_BYTES) {
          throw new Error(`project inputs exceed ${formatBytes(MAX_TOTAL_INPUT_BYTES)}`);
        }
        if (metadata.size !== entry.size) {
          throw new Error(`size changed from ${entry.size} to ${metadata.size} bytes`);
        }

        const signature = fileSignature(metadata.size, metadata.mtimeMs);
        if (entry.sha256) {
          const actualHash = await sha256File(resolvedPath);
          if (actualHash !== entry.sha256) throw new Error('SHA-256 no longer matches');
        }

        const token = this.registerPath(resolvedPath, signature, entry.sha256);
        const bytes = new Uint8Array(await readFile(resolvedPath));
        files.push({
          role: entry.role,
          ringId: entry.ringId,
          token,
          name: entry.name,
          type: entry.type,
          size: metadata.size,
          lastModified: metadata.mtimeMs,
          bytes,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        issues.push(`${entry.name}: ${reason}`);
      }
    }

    this.currentProjectPath = projectPath === this.recoveryPath ? null : projectPath;
    if (projectPath !== this.recoveryPath) await this.rememberRecentProject(projectPath);

    return {
      cancelled: false,
      displayName: path.basename(projectPath),
      sessionJson: JSON.stringify(manifest.session),
      plotJson: manifest.plot === undefined ? undefined : JSON.stringify(manifest.plot),
      files,
      issues,
    };
  }

  async listRecentProjects(): Promise<DesktopRecentProject[]> {
    const records = await this.readRecentRecords();
    const existing: RecentProjectRecord[] = [];
    for (const record of records) {
      try {
        const metadata = await stat(record.filePath);
        if (metadata.isFile()) existing.push(record);
      } catch {
        // Remove stale entries silently; users can still open files directly.
      }
    }
    if (existing.length !== records.length) await this.writeRecentRecords(existing);
    return existing.map(({ id, displayName, lastOpened }) => ({ id, displayName, lastOpened }));
  }

  async resolveRecentProject(id: string): Promise<string | null> {
    const record = (await this.readRecentRecords()).find(item => item.id === id);
    return record?.filePath ?? null;
  }

  getCurrentProjectPath(): string | null {
    return this.currentProjectPath;
  }

  private async createManifest(
    request: DesktopMainSaveProjectRequest,
    destinationPath: string,
    includeHashes: boolean,
  ): Promise<BRIGXProjectManifest> {
    if (Buffer.byteLength(request.sessionJson, 'utf8') > MAX_PROJECT_BYTES) {
      throw new Error('Session data is too large to save safely');
    }
    if (request.plotJson && Buffer.byteLength(request.plotJson, 'utf8') > MAX_PROJECT_BYTES) {
      throw new Error('Plot data is too large to save safely');
    }

    const session = parseJsonValue(request.sessionJson, 'session');
    const plot = request.plotJson ? parseJsonValue(request.plotJson, 'plot') : undefined;
    if (!isBRIGXSession(session)) throw new Error('Project session is invalid');
    if (plot !== undefined && !isCircularPlotData(plot)) throw new Error('Project plot is invalid');
    if (request.files.length > MAX_PROJECT_FILES) {
      throw new Error(`Project contains more than ${MAX_PROJECT_FILES} input files`);
    }
    const files: PersistedProjectFile[] = [];
    let totalInputBytes = 0;

    for (const binding of request.files) {
      const resolved = await this.resolveBinding(binding);
      const metadata = await stat(resolved.filePath);
      if (!metadata.isFile()) throw new Error(`${binding.name} is not a regular file`);
      if (metadata.size > MAX_INPUT_BYTES) {
        throw new Error(`${binding.name} exceeds ${formatBytes(MAX_INPUT_BYTES)}`);
      }
      totalInputBytes += metadata.size;
      if (totalInputBytes > MAX_TOTAL_INPUT_BYTES) {
        throw new Error(`Project inputs exceed ${formatBytes(MAX_TOTAL_INPUT_BYTES)}`);
      }

      const signature = fileSignature(metadata.size, metadata.mtimeMs);
      const cachedHash = resolved.signature === signature ? resolved.sha256 : undefined;
      const hash = includeHashes
        ? await this.hashRegisteredFile(resolved.filePath, signature, cachedHash)
        : cachedHash;
      resolved.signature = signature;
      resolved.sha256 = hash;
      const storedPath = persistPath(destinationPath, resolved.filePath);
      files.push({
        role: binding.role,
        ringId: binding.ringId,
        ...storedPath,
        name: binding.name || path.basename(resolved.filePath),
        type: binding.type,
        size: metadata.size,
        lastModified: metadata.mtimeMs,
        sha256: hash,
      });
    }

    return {
      type: BRIGX_PROJECT_TYPE,
      schemaVersion: BRIGX_PROJECT_SCHEMA_VERSION,
      appVersion: this.appVersion,
      savedAt: new Date().toISOString(),
      session,
      ...(plot === undefined ? {} : { plot }),
      files,
    };
  }

  private async resolveBinding(binding: DesktopMainFileBinding): Promise<RegisteredFile> {
    if (binding.token) {
      const registered = this.tokenRegistry.get(binding.token);
      if (registered) return registered;
    }
    if (!binding.filePath || !path.isAbsolute(binding.filePath)) {
      throw new Error(`${binding.name} is not backed by an accessible local file`);
    }
    const metadata = await stat(binding.filePath);
    const signature = fileSignature(metadata.size, metadata.mtimeMs);
    this.registerPath(binding.filePath, signature);
    return { filePath: binding.filePath, signature };
  }

  private async hashRegisteredFile(
    filePath: string,
    signature: string,
    existingHash?: string,
  ): Promise<string> {
    if (existingHash) return existingHash;
    const registered = [...this.tokenRegistry.values()].find(
      item => item.filePath === filePath && item.signature === signature && item.sha256,
    );
    if (registered?.sha256) return registered.sha256;
    const hash = await sha256File(filePath);
    for (const entry of this.tokenRegistry.values()) {
      if (entry.filePath === filePath && entry.signature === signature) entry.sha256 = hash;
    }
    return hash;
  }

  private registerPath(filePath: string, signature: string, sha256?: string): string {
    const token = randomUUID();
    this.tokenRegistry.set(token, { filePath, signature, sha256 });
    return token;
  }

  private get recentProjectsPath(): string {
    return path.join(this.userDataDirectory, 'recent-projects.json');
  }

  private async rememberRecentProject(filePath: string): Promise<void> {
    const resolved = path.resolve(filePath);
    const id = createHash('sha256').update(resolved).digest('hex').slice(0, 24);
    const records = (await this.readRecentRecords()).filter(record => record.id !== id);
    records.unshift({
      id,
      filePath: resolved,
      displayName: path.basename(resolved),
      lastOpened: Date.now(),
    });
    await this.writeRecentRecords(records.slice(0, MAX_RECENT_PROJECTS));
  }

  private async readRecentRecords(): Promise<RecentProjectRecord[]> {
    try {
      const json = await readFile(this.recentProjectsPath, 'utf8');
      const value: unknown = JSON.parse(json);
      if (!Array.isArray(value)) return [];
      return value.filter(isRecentProjectRecord).slice(0, MAX_RECENT_PROJECTS);
    } catch {
      return [];
    }
  }

  private async writeRecentRecords(records: RecentProjectRecord[]): Promise<void> {
    await mkdir(this.userDataDirectory, { recursive: true });
    await writeJsonAtomically(this.recentProjectsPath, records);
  }
}

export function parseProjectManifest(value: unknown): BRIGXProjectManifest {
  if (!isRecord(value)) throw new Error('Project must be a JSON object');
  if (value.type !== BRIGX_PROJECT_TYPE) throw new Error('Not a BRIGX project file');
  if (value.schemaVersion !== BRIGX_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported BRIGX project schema: ${String(value.schemaVersion)}`);
  }
  if (typeof value.appVersion !== 'string' || typeof value.savedAt !== 'string') {
    throw new Error('Project metadata is incomplete');
  }
  if (!Array.isArray(value.files) || !value.files.every(isPersistedProjectFile)) {
    throw new Error('Project file references are invalid');
  }
  if (value.files.length > MAX_PROJECT_FILES) throw new Error('Project contains too many input files');
  if (!('session' in value)) throw new Error('Project session is missing');
  if (!isBRIGXSession(value.session)) throw new Error('Project session is invalid');
  if (value.plot !== undefined && !isCircularPlotData(value.plot)) {
    throw new Error('Project plot is invalid');
  }
  return value as unknown as BRIGXProjectManifest;
}

async function readManifest(projectPath: string): Promise<BRIGXProjectManifest> {
  const metadata = await stat(projectPath);
  if (!metadata.isFile()) throw new Error('Project path is not a file');
  if (metadata.size > MAX_PROJECT_BYTES) throw new Error('Project file is too large');
  return parseProjectManifest(JSON.parse(await readFile(projectPath, 'utf8')) as unknown);
}

async function writeJsonAtomically(
  destinationPath: string,
  value: unknown,
  maximumBytes?: number,
): Promise<void> {
  const directory = path.dirname(destinationPath);
  await mkdir(directory, { recursive: true });
  const serialised = `${JSON.stringify(value, null, 2)}\n`;
  if (maximumBytes !== undefined && Buffer.byteLength(serialised, 'utf8') > maximumBytes) {
    throw new Error(`Project data exceeds ${formatBytes(maximumBytes)}`);
  }
  const temporaryPath = path.join(
    directory,
    `.${path.basename(destinationPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, serialised, { mode: 0o600 });
    const handle = await open(temporaryPath, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, destinationPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function persistPath(
  projectPath: string,
  sourcePath: string,
): Pick<PersistedProjectFile, 'pathKind' | 'path'> {
  const relative = path.relative(path.dirname(projectPath), sourcePath);
  if (relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
    return { pathKind: 'relative', path: relative };
  }
  return { pathKind: 'absolute', path: sourcePath };
}

function resolvePersistedPath(projectPath: string, entry: PersistedProjectFile): string {
  return entry.pathKind === 'relative'
    ? path.resolve(path.dirname(projectPath), entry.path)
    : path.resolve(entry.path);
}

function parseJsonValue(json: string, label: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error(`Project ${label} is not valid JSON`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPersistedProjectFile(value: unknown): value is PersistedProjectFile {
  if (!isRecord(value)) return false;
  return (value.role === 'reference' || value.role === 'ring')
    && (value.ringId === undefined || typeof value.ringId === 'string')
    && (value.pathKind === 'absolute' || value.pathKind === 'relative')
    && typeof value.path === 'string'
    && value.path.length > 0
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && typeof value.size === 'number'
    && Number.isFinite(value.size)
    && value.size >= 0
    && typeof value.lastModified === 'number'
    && Number.isFinite(value.lastModified)
    && (
      value.sha256 === undefined
      || (typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256))
    );
}

function isRecentProjectRecord(value: unknown): value is RecentProjectRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.displayName === 'string'
    && typeof value.lastOpened === 'number'
    && Number.isFinite(value.lastOpened)
    && typeof value.filePath === 'string'
    && path.isAbsolute(value.filePath);
}

function fileSignature(size: number, modified: number): string {
  return `${size}:${Math.round(modified)}`;
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}

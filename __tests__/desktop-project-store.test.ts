/** @vitest-environment node */
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore, parseProjectManifest } from '@/desktop/project-store';
import type { DesktopMainSaveProjectRequest } from '@/desktop/contracts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    rm(directory, { recursive: true, force: true })
  )));
});

async function createFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'brigx-project-test-'));
  temporaryDirectories.push(directory);
  const sourcePath = path.join(directory, 'reference.fa');
  const projectPath = path.join(directory, 'example.brigx');
  await writeFile(sourcePath, '>reference\nACGTACGT\n');
  const metadata = await import('node:fs/promises').then(fs => fs.stat(sourcePath));
  const request: DesktopMainSaveProjectRequest = {
    sessionJson: JSON.stringify({
      version: 'test',
      timestamp: 0,
      referenceFileName: 'reference.fa',
      referenceAnnotations: [],
      rings: [],
      params: {
        minIdentity: 70,
        minAlignmentLength: 1000,
        colorScheme: 'blue-red',
        forceAlignment: false,
        alignerOptions: '',
      },
      imageConfig: {
        innerRadius: 200,
        ringWidth: 20,
        gcRingWidth: 40,
        ringSpacing: 4,
        legendFontSize: 16,
        scaleFontSize: 12,
        titleFontSize: 24,
        labelFontSize: 14,
        title: '',
      },
    }),
    plotJson: JSON.stringify({
      reference: { name: 'reference', length: 8 },
      rings: [],
      config: { minIdentity: 70, minAlignmentLength: 1000 },
    }),
    files: [{
      role: 'reference',
      filePath: sourcePath,
      name: 'reference.fa',
      type: 'text/plain',
      size: metadata.size,
      lastModified: metadata.mtimeMs,
    }],
  };
  const store = new ProjectStore({ appVersion: '0.0.0-test', userDataDirectory: directory });
  return { directory, projectPath, request, sourcePath, store };
}

describe('desktop project store', () => {
  it('writes an atomic, hashed project and restores its referenced file', async () => {
    const { projectPath, request, store } = await createFixture();
    await store.saveProject(request, projectPath);

    const manifest = parseProjectManifest(JSON.parse(await readFile(projectPath, 'utf8')) as unknown);
    expect(manifest.type).toBe('brigx-project');
    expect(manifest.files[0]).toMatchObject({
      pathKind: 'relative',
      path: 'reference.fa',
      name: 'reference.fa',
    });
    expect(manifest.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);

    const opened = await store.openProject(projectPath);
    expect(opened.issues).toEqual([]);
    expect(opened.files).toHaveLength(1);
    expect(new TextDecoder().decode(opened.files[0].bytes)).toBe('>reference\nACGTACGT\n');
    expect(opened.files[0].token).toMatch(/^[0-9a-f-]{36}$/);
    expect((await store.listRecentProjects())[0].displayName).toBe('example.brigx');
  });

  it('reports a changed referenced file instead of silently loading it', async () => {
    const { projectPath, request, sourcePath, store } = await createFixture();
    await store.saveProject(request, projectPath);
    await writeFile(sourcePath, '>reference\nCHANGED\n');

    const opened = await store.openProject(projectPath);
    expect(opened.files).toEqual([]);
    expect(opened.issues).toHaveLength(1);
    expect(opened.issues[0]).toContain('reference.fa');
    expect(opened.issues[0]).toMatch(/size changed|SHA-256 no longer matches/);
  });

  it('rehashes a token-backed source after the source changes', async () => {
    const { directory, projectPath, request, sourcePath, store } = await createFixture();
    await store.saveProject(request, projectPath);
    const opened = await store.openProject(projectPath);
    const replacement = '>reference\nTGCATGCA\n';
    await writeFile(sourcePath, replacement);
    const future = new Date(Date.now() + 2_000);
    await utimes(sourcePath, future, future);

    const changedProjectPath = path.join(directory, 'changed.brigx');
    await store.saveProject({
      ...request,
      files: [{
        role: 'reference',
        token: opened.files[0].token,
        name: 'reference.fa',
        type: 'text/plain',
        size: Buffer.byteLength(replacement),
        lastModified: future.getTime(),
      }],
    }, changedProjectPath);

    const changedManifest = parseProjectManifest(
      JSON.parse(await readFile(changedProjectPath, 'utf8')) as unknown,
    );
    expect(changedManifest.files[0].sha256).toBe(
      createHash('sha256').update(replacement).digest('hex'),
    );
    const independentStore = new ProjectStore({
      appVersion: '0.0.0-test',
      userDataDirectory: directory,
    });
    expect((await independentStore.openProject(changedProjectPath)).issues).toEqual([]);
  });

  it('clears the current save destination for a new project', async () => {
    const { projectPath, request, store } = await createFixture();
    await store.saveProject(request, projectPath);
    expect(store.getCurrentProjectPath()).toBe(projectPath);
    store.startNewProject();
    expect(store.getCurrentProjectPath()).toBeNull();
  });

  it('rejects files that are not BRIGX project manifests', () => {
    expect(() => parseProjectManifest({})).toThrow('Not a BRIGX project file');
    expect(() => parseProjectManifest({
      type: 'brigx-project',
      schemaVersion: 99,
    })).toThrow('Unsupported BRIGX project schema');
    expect(() => parseProjectManifest({
      type: 'brigx-project',
      schemaVersion: 1,
      appVersion: 'test',
      savedAt: new Date(0).toISOString(),
      session: {},
      files: [],
    })).toThrow('Project session is invalid');
  });
});

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from 'electron';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  DesktopMainSaveProjectRequest,
  DesktopMenuAction,
  DesktopSaveFileRequest,
  DesktopSaveResult,
} from './contracts';
import { DESKTOP_CHANNELS } from './contracts';
import { ProjectStore } from './project-store';
import {
  BRIGX_APP_ORIGIN,
  installBRIGXProtocol,
  registerBRIGXScheme,
} from './protocol';
import {
  assertTrustedIPC,
  configureNavigationSecurity,
  isAllowedExternalUrl,
} from './security';

const DEVELOPMENT_URL = getDevelopmentUrl(process.env.BRIGX_DEV_SERVER_URL);
const PROJECT_FILTER = [{ name: 'BRIGX Project', extensions: ['brigx'] }];
const MAX_EXPORT_BYTES = 1024 * 1024 * 1024;

if (process.env.BRIGX_E2E_USER_DATA_DIR) {
  const testUserData = path.resolve(process.env.BRIGX_E2E_USER_DATA_DIR);
  app.setPath('userData', testUserData);
}

registerBRIGXScheme();
app.enableSandbox();
app.setName('BRIGX');

let mainWindow: BrowserWindow | null = null;
let projectStore: ProjectStore;
let rendererHasUnsavedChanges = false;
let allowWindowClose = false;
let closePromptOpen = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  projectStore = new ProjectStore({
    appVersion: app.getVersion(),
    userDataDirectory: app.getPath('userData'),
  });

  if (!DEVELOPMENT_URL) {
    await installBRIGXProtocol(path.join(app.getAppPath(), 'out'));
  }
  configureSessionSecurity();
  installIPCHandlers();
  await createMainWindow();
  await rebuildApplicationMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}).catch(error => {
  console.error('[Desktop] Startup failed:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    title: 'BRIGX',
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#101827',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  configureNavigationSecurity(mainWindow.webContents, DEVELOPMENT_URL);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', event => {
    if (!rendererHasUnsavedChanges || allowWindowClose) return;
    event.preventDefault();
    if (closePromptOpen) return;
    closePromptOpen = true;
    void dialog.showMessageBox(requireMainWindow(), {
      type: 'warning',
      title: 'Unsaved BRIGX project',
      message: 'Save changes before closing?',
      detail: 'BRIGX also keeps a local recovery snapshot for unexpected exits.',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    }).then(result => {
      closePromptOpen = false;
      if (result.response === 0) {
        sendMenuAction({ type: 'save-and-close' });
      } else if (result.response === 1) {
        allowWindowClose = true;
        mainWindow?.close();
      }
    });
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererHasUnsavedChanges = false;
    allowWindowClose = false;
    closePromptOpen = false;
  });

  if (DEVELOPMENT_URL) await mainWindow.loadURL(DEVELOPMENT_URL);
  else await mainWindow.loadURL(`${BRIGX_APP_ORIGIN}/`);
}

function configureSessionSecurity(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function installIPCHandlers(): void {
  ipcMain.handle(DESKTOP_CHANNELS.startNewProject, async event => {
    assertEvent(event);
    projectStore.startNewProject();
  });

  ipcMain.handle(DESKTOP_CHANNELS.saveProject, async (event, request: DesktopMainSaveProjectRequest) => {
    assertEvent(event);
    const destination = await chooseProjectDestination(Boolean(request.saveAs));
    if (!destination) return { cancelled: true } satisfies DesktopSaveResult;
    await projectStore.saveProject(request, destination);
    await rebuildApplicationMenu();
    return { cancelled: false, displayName: path.basename(destination) } satisfies DesktopSaveResult;
  });

  ipcMain.handle(DESKTOP_CHANNELS.openProject, async event => {
    assertEvent(event);
    const result = await dialog.showOpenDialog(requireMainWindow(), {
      title: 'Open BRIGX Project',
      filters: PROJECT_FILTER,
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true, files: [], issues: [] };
    }
    const opened = await projectStore.openProject(result.filePaths[0]);
    await rebuildApplicationMenu();
    return opened;
  });

  ipcMain.handle(DESKTOP_CHANNELS.openRecentProject, async (event, id: string) => {
    assertEvent(event);
    if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('Invalid recent-project identifier');
    const projectPath = await projectStore.resolveRecentProject(id);
    if (!projectPath) throw new Error('That recent project is no longer available');
    const opened = await projectStore.openProject(projectPath);
    await rebuildApplicationMenu();
    return opened;
  });

  ipcMain.handle(DESKTOP_CHANNELS.listRecentProjects, async event => {
    assertEvent(event);
    return projectStore.listRecentProjects();
  });

  ipcMain.handle(DESKTOP_CHANNELS.saveRecovery, async (
    event,
    request: DesktopMainSaveProjectRequest,
  ) => {
    assertEvent(event);
    await projectStore.saveProject(request, projectStore.recoveryPath, false);
  });

  ipcMain.handle(DESKTOP_CHANNELS.hasRecovery, async event => {
    assertEvent(event);
    try {
      return (await stat(projectStore.recoveryPath)).isFile();
    } catch {
      return false;
    }
  });

  ipcMain.handle(DESKTOP_CHANNELS.openRecovery, async event => {
    assertEvent(event);
    return projectStore.openProject(projectStore.recoveryPath);
  });

  ipcMain.handle(DESKTOP_CHANNELS.clearRecovery, async event => {
    assertEvent(event);
    await rm(projectStore.recoveryPath, { force: true });
  });

  ipcMain.handle(DESKTOP_CHANNELS.saveFile, async (
    event,
    request: DesktopSaveFileRequest,
  ): Promise<DesktopSaveResult> => {
    assertEvent(event);
    if (!request || typeof request.defaultName !== 'string' || typeof request.mimeType !== 'string') {
      throw new Error('Invalid save request');
    }
    if (!(request.bytes instanceof Uint8Array) || request.bytes.byteLength > MAX_EXPORT_BYTES) {
      throw new Error('Export is invalid or too large');
    }
    const defaultName = sanitiseFilename(request.defaultName);
    const result = await dialog.showSaveDialog(requireMainWindow(), {
      title: 'Save BRIGX Export',
      defaultPath: defaultName,
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    await writeBytesAtomically(result.filePath, request.bytes);
    return { cancelled: false, displayName: path.basename(result.filePath) };
  });

  ipcMain.handle(DESKTOP_CHANNELS.setDirtyState, async (event, dirty: boolean) => {
    assertEvent(event);
    if (typeof dirty !== 'boolean') throw new Error('Invalid dirty-state value');
    rendererHasUnsavedChanges = dirty;
  });

  ipcMain.handle(DESKTOP_CHANNELS.closeAfterSave, async event => {
    assertEvent(event);
    rendererHasUnsavedChanges = false;
    allowWindowClose = true;
    requireMainWindow().close();
  });
}

async function chooseProjectDestination(saveAs: boolean): Promise<string | null> {
  if (!saveAs) {
    const current = projectStore.getCurrentProjectPath();
    if (current) return current;
  }
  const result = await dialog.showSaveDialog(requireMainWindow(), {
    title: 'Save BRIGX Project',
    defaultPath: 'BRIGX-project.brigx',
    filters: PROJECT_FILTER,
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath.toLowerCase().endsWith('.brigx')
    ? result.filePath
    : `${result.filePath}.brigx`;
}

async function rebuildApplicationMenu(): Promise<void> {
  const recent = await projectStore.listRecentProjects();
  const recentItems: MenuItemConstructorOptions[] = recent.length > 0
    ? recent.map(item => ({
        label: item.displayName,
        click: () => sendMenuAction({ type: 'open-recent', id: item.id }),
      }))
    : [{ label: 'No Recent Projects', enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction({ type: 'new-project' }) },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction({ type: 'open-project' }) },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction({ type: 'save-project' }) },
        { label: 'Save Project As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction({ type: 'save-project-as' }) },
        { label: 'Recover Last Session', click: () => sendMenuAction({ type: 'recover-project' }) },
        ...(process.platform === 'darwin' ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(DEVELOPMENT_URL
          ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }]
          : []),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'BRIGX Source and Documentation',
          click: () => void openExternal('https://github.com/happykhan/brigx'),
        },
        {
          label: 'Report an Issue',
          click: () => void openExternal('https://github.com/happykhan/brigx/issues'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendMenuAction(action: DesktopMenuAction): void {
  mainWindow?.webContents.send(DESKTOP_CHANNELS.menuAction, action);
}

function requireMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('BRIGX window is unavailable');
  return mainWindow;
}

function assertEvent(event: IpcMainInvokeEvent): void {
  assertTrustedIPC(event, DEVELOPMENT_URL);
}

async function openExternal(url: string): Promise<void> {
  if (!isAllowedExternalUrl(url)) throw new Error('External URL is not allowed');
  await shell.openExternal(url);
}

async function writeBytesAtomically(destination: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporary, bytes, { mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function sanitiseFilename(filename: string): string {
  const invalidCharacters = new Set('<>:"/\\|?*');
  const base = [...path.basename(filename)]
    .filter(character => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 && !invalidCharacters.has(character);
    })
    .join('')
    .replace(/[. ]+$/, '')
    .trim();
  return base || 'BRIGX-export';
}

function getDevelopmentUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('BRIGX_DEV_SERVER_URL must use a loopback HTTP address');
  }
  return parsed.origin;
}

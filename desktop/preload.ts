import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  DesktopAPI,
  DesktopMainSaveProjectRequest,
  DesktopMenuAction,
  DesktopSaveProjectRequest,
} from './contracts';
import { DESKTOP_API_VERSION, DESKTOP_CHANNELS } from './contracts';

function prepareProjectRequest(request: DesktopSaveProjectRequest): DesktopMainSaveProjectRequest {
  if (!request || typeof request.sessionJson !== 'string' || !Array.isArray(request.files)) {
    throw new Error('Invalid desktop project request');
  }

  return {
    sessionJson: request.sessionJson,
    plotJson: request.plotJson,
    saveAs: request.saveAs,
    files: request.files.map(binding => ({
      role: binding.role,
      ringId: binding.ringId,
      token: binding.token,
      filePath: binding.token ? undefined : webUtils.getPathForFile(binding.file),
      name: binding.file.name,
      type: binding.file.type,
      size: binding.file.size,
      lastModified: binding.file.lastModified,
    })),
  };
}

const api: DesktopAPI = {
  apiVersion: DESKTOP_API_VERSION,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  startNewProject: () => ipcRenderer.invoke(DESKTOP_CHANNELS.startNewProject),
  saveProject: request => ipcRenderer.invoke(
    DESKTOP_CHANNELS.saveProject,
    prepareProjectRequest(request),
  ),
  openProject: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openProject),
  openRecentProject: id => ipcRenderer.invoke(DESKTOP_CHANNELS.openRecentProject, id),
  listRecentProjects: () => ipcRenderer.invoke(DESKTOP_CHANNELS.listRecentProjects),
  saveRecoverySnapshot: request => ipcRenderer.invoke(
    DESKTOP_CHANNELS.saveRecovery,
    prepareProjectRequest(request),
  ),
  hasRecoverySnapshot: () => ipcRenderer.invoke(DESKTOP_CHANNELS.hasRecovery),
  openRecoverySnapshot: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openRecovery),
  clearRecoverySnapshot: () => ipcRenderer.invoke(DESKTOP_CHANNELS.clearRecovery),
  saveFile: request => ipcRenderer.invoke(DESKTOP_CHANNELS.saveFile, request),
  setDirtyState: dirty => ipcRenderer.invoke(DESKTOP_CHANNELS.setDirtyState, dirty),
  closeAfterSave: () => ipcRenderer.invoke(DESKTOP_CHANNELS.closeAfterSave),
  onMenuAction: listener => {
    const wrapped = (_event: Electron.IpcRendererEvent, action: DesktopMenuAction) => listener(action);
    ipcRenderer.on(DESKTOP_CHANNELS.menuAction, wrapped);
    return () => ipcRenderer.removeListener(DESKTOP_CHANNELS.menuAction, wrapped);
  },
};

contextBridge.exposeInMainWorld('brigxDesktop', api);

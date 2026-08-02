import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  DesktopAPI,
  DesktopFileRole,
  DesktopMenuAction,
  DesktopOpenProjectResult,
  DesktopOpenedFile,
  DesktopPlatform,
  DesktopSaveProjectRequest,
  DesktopSaveResult,
} from './contracts';
import { DESKTOP_API_VERSION } from './contracts';

interface NativeFileBinding {
  role: DesktopFileRole;
  ringId?: string;
  token: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

interface NativeProjectRequest {
  sessionJson: string;
  plotJson?: string;
  files: NativeFileBinding[];
  saveAs?: boolean;
}

type NativeOpenedFile = NativeFileBinding;

interface NativeOpenProjectResult extends Omit<DesktopOpenProjectResult, 'files'> {
  files: NativeOpenedFile[];
}

interface PendingExportResult extends DesktopSaveResult {
  token?: string;
}

export async function installTauriDesktopBridge(): Promise<void> {
  if (!isTauriRuntime()) return;

  if (import.meta.env.VITE_BRIGX_E2E === '1') {
    await import('@wdio/tauri-plugin');
  }

  const platform = currentPlatform();
  const api: DesktopAPI = {
    apiVersion: DESKTOP_API_VERSION,
    platform,
    versions: {
      tauri: '2.11',
      webview: platform === 'darwin'
        ? 'WKWebView (system)'
        : platform === 'win32'
          ? 'WebView2 (system)'
          : 'WebKitGTK (system)',
    },
    pickInputFiles: async request => hydrateFiles(
      await invoke<NativeOpenedFile[]>('pick_input_files', { request }),
    ),
    startNewProject: () => invoke('start_new_project'),
    saveProject: request => invoke('save_project', {
      request: prepareProjectRequest(request),
    }),
    openProject: async () => hydrateProject(
      await invoke<NativeOpenProjectResult>('open_project'),
    ),
    openRecentProject: async id => hydrateProject(
      await invoke<NativeOpenProjectResult>('open_recent_project', { id }),
    ),
    listRecentProjects: () => invoke('list_recent_projects'),
    saveRecoverySnapshot: request => invoke('save_recovery_snapshot', {
      request: prepareProjectRequest(request),
    }),
    hasRecoverySnapshot: () => invoke('has_recovery_snapshot'),
    openRecoverySnapshot: async () => hydrateProject(
      await invoke<NativeOpenProjectResult>('open_recovery_snapshot'),
    ),
    clearRecoverySnapshot: () => invoke('clear_recovery_snapshot'),
    saveFile: async request => {
      const destination = await invoke<PendingExportResult>('choose_export_destination', {
        defaultName: request.defaultName,
        mimeType: request.mimeType,
        size: request.bytes.byteLength,
      });
      if (destination.cancelled || !destination.token) return { cancelled: true };
      await invoke('write_export', request.bytes, {
        headers: { 'x-brigx-export-token': destination.token },
      });
      return { cancelled: false, displayName: destination.displayName };
    },
    setDirtyState: dirty => invoke('set_dirty_state', { dirty }),
    closeAfterSave: () => invoke('close_after_save'),
    openExternal: url => invoke('open_external', { url }),
    onMenuAction: listener => subscribeToMenu(listener),
  };

  window.brigxDesktop = api;
  installExternalLinkGuard(api);
}

function prepareProjectRequest(request: DesktopSaveProjectRequest): NativeProjectRequest {
  if (!request || typeof request.sessionJson !== 'string' || !Array.isArray(request.files)) {
    throw new Error('Invalid desktop project request');
  }

  return {
    sessionJson: request.sessionJson,
    plotJson: request.plotJson,
    saveAs: request.saveAs,
    files: request.files.map(binding => {
      if (!binding.token) {
        throw new Error(`${binding.file.name} must be selected again with the desktop file picker`);
      }
      return {
        role: binding.role,
        ringId: binding.ringId,
        token: binding.token,
        name: binding.file.name,
        type: binding.file.type,
        size: binding.file.size,
        lastModified: binding.file.lastModified,
      };
    }),
  };
}

async function hydrateProject(result: NativeOpenProjectResult): Promise<DesktopOpenProjectResult> {
  if (result.cancelled) return { ...result, files: [] };
  const files: DesktopOpenedFile[] = [];
  const issues = [...result.issues];
  for (const file of result.files) {
    try {
      files.push(await hydrateFile(file));
    } catch (error) {
      issues.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ...result, files, issues };
}

async function hydrateFiles(files: NativeOpenedFile[]): Promise<DesktopOpenedFile[]> {
  const hydrated: DesktopOpenedFile[] = [];
  for (const file of files) hydrated.push(await hydrateFile(file));
  return hydrated;
}

async function hydrateFile(file: NativeOpenedFile): Promise<DesktopOpenedFile> {
  const response = await invoke<ArrayBuffer | Uint8Array | number[]>('read_input_file', {
    token: file.token,
  });
  const bytes = response instanceof Uint8Array
    ? response
    : response instanceof ArrayBuffer
      ? new Uint8Array(response)
      : new Uint8Array(response);
  if (bytes.byteLength !== file.size) {
    throw new Error(`read ${bytes.byteLength} bytes; expected ${file.size}`);
  }
  return { ...file, bytes };
}

function subscribeToMenu(listener: (action: DesktopMenuAction) => void): () => void {
  let disposed = false;
  let unlisten: UnlistenFn | undefined;
  void listen<DesktopMenuAction>('brigx:menu-action', event => listener(event.payload)).then(stop => {
    if (disposed) stop();
    else unlisten = stop;
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}

function installExternalLinkGuard(api: DesktopAPI): void {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;

    let url: URL;
    try {
      url = new URL(anchor.href);
    } catch {
      event.preventDefault();
      return;
    }
    if (url.origin === window.location.origin) return;

    event.preventDefault();
    if (url.protocol === 'https:' || url.protocol === 'mailto:') {
      void api.openExternal(url.href).catch(error => {
        console.error('[Desktop] Failed to open external link:', error);
      });
    }
  }, true);
}

function currentPlatform(): DesktopPlatform {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'darwin';
  if (platform.includes('win')) return 'win32';
  return 'linux';
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}

export const DESKTOP_API_VERSION = 1;
export const BRIGX_PROJECT_TYPE = 'brigx-project';
export const BRIGX_PROJECT_SCHEMA_VERSION = 1;

export type DesktopPlatform = 'darwin' | 'linux' | 'win32';
export type DesktopFileRole = 'reference' | 'ring';

export interface DesktopRendererFileBinding {
  role: DesktopFileRole;
  ringId?: string;
  token?: string;
  file: File;
}

export interface DesktopSaveProjectRequest {
  sessionJson: string;
  plotJson?: string;
  files: DesktopRendererFileBinding[];
  saveAs?: boolean;
}

export interface DesktopSaveResult {
  cancelled: boolean;
  displayName?: string;
}

export interface DesktopOpenedFile {
  role: DesktopFileRole;
  ringId?: string;
  token: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  bytes: Uint8Array;
}

export interface DesktopOpenProjectResult {
  cancelled: boolean;
  displayName?: string;
  sessionJson?: string;
  plotJson?: string;
  files: DesktopOpenedFile[];
  issues: string[];
}

export interface DesktopRecentProject {
  id: string;
  displayName: string;
  lastOpened: number;
}

export type DesktopMenuAction =
  | { type: 'new-project' }
  | { type: 'open-project' }
  | { type: 'open-recent'; id: string }
  | { type: 'save-project' }
  | { type: 'save-project-as' }
  | { type: 'save-and-close' }
  | { type: 'recover-project' };

export interface DesktopSaveFileRequest {
  defaultName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface DesktopPickInputFilesRequest {
  role: DesktopFileRole;
  ringId?: string;
  multiple?: boolean;
}

export interface DesktopAPI {
  readonly apiVersion: number;
  readonly platform: DesktopPlatform;
  readonly versions: {
    tauri: string;
    webview: string;
  };
  pickInputFiles(request: DesktopPickInputFilesRequest): Promise<DesktopOpenedFile[]>;
  startNewProject(): Promise<void>;
  saveProject(request: DesktopSaveProjectRequest): Promise<DesktopSaveResult>;
  openProject(): Promise<DesktopOpenProjectResult>;
  openRecentProject(id: string): Promise<DesktopOpenProjectResult>;
  listRecentProjects(): Promise<DesktopRecentProject[]>;
  saveRecoverySnapshot(request: DesktopSaveProjectRequest): Promise<void>;
  hasRecoverySnapshot(): Promise<boolean>;
  openRecoverySnapshot(): Promise<DesktopOpenProjectResult>;
  clearRecoverySnapshot(): Promise<void>;
  saveFile(request: DesktopSaveFileRequest): Promise<DesktopSaveResult>;
  setDirtyState(dirty: boolean): Promise<void>;
  closeAfterSave(): Promise<void>;
  openExternal(url: string): Promise<void>;
  onMenuAction(listener: (action: DesktopMenuAction) => void): () => void;
}

export interface PersistedProjectFile {
  role: DesktopFileRole;
  ringId?: string;
  pathKind: 'absolute' | 'relative';
  path: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  sha256?: string;
}

export interface BRIGXProjectManifest {
  type: typeof BRIGX_PROJECT_TYPE;
  schemaVersion: typeof BRIGX_PROJECT_SCHEMA_VERSION;
  appVersion: string;
  savedAt: string;
  session: unknown;
  plot?: unknown;
  files: PersistedProjectFile[];
}

declare global {
  interface Window {
    brigxDesktop?: DesktopAPI;
    __TAURI_INTERNALS__?: unknown;
  }
}

export {};

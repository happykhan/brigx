import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { shell } from 'electron';
import { BRIGX_APP_ORIGIN } from './protocol';

export function isTrustedRendererUrl(url: string, developmentUrl?: string): boolean {
  if (url.startsWith(`${BRIGX_APP_ORIGIN}/`) || url === `${BRIGX_APP_ORIGIN}/`) return true;
  if (!developmentUrl) return false;
  try {
    return new URL(url).origin === new URL(developmentUrl).origin;
  } catch {
    return false;
  }
}

export function assertTrustedIPC(event: IpcMainInvokeEvent, developmentUrl?: string): void {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
  if (!isTrustedRendererUrl(senderUrl, developmentUrl)) {
    throw new Error('Rejected an IPC request from an untrusted renderer');
  }
}

export function configureNavigationSecurity(
  contents: WebContents,
  developmentUrl?: string,
): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', event => {
    const target = event.url;
    if (isTrustedRendererUrl(target, developmentUrl)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(target)) void shell.openExternal(target);
  });
}

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

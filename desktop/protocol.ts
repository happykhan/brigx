import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';

export const BRIGX_SCHEME = 'brigx';
export const BRIGX_APP_ORIGIN = `${BRIGX_SCHEME}://app`;

export const DESKTOP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

export function registerBRIGXScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: BRIGX_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export async function installBRIGXProtocol(rendererRoot: string): Promise<void> {
  protocol.handle(BRIGX_SCHEME, async request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secureResponse('Method not allowed', 405, 'text/plain; charset=utf-8');
    }

    const resolved = await resolveBundleRequest(rendererRoot, request.url);
    if (!resolved) return secureResponse('Not found', 404, 'text/plain; charset=utf-8');

    const upstream = await net.fetch(pathToFileURL(resolved).toString());
    if (!upstream.ok) return secureResponse('Not found', 404, 'text/plain; charset=utf-8');

    const headers = securityHeaders(MIME_TYPES.get(path.extname(resolved).toLowerCase()));
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  });
}

export async function resolveBundleRequest(
  rendererRoot: string,
  requestUrl: string,
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${BRIGX_SCHEME}:` || url.host !== 'app') return null;

  let requestedPath: string;
  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const candidate = safeResolve(rendererRoot, relativePath);
  if (!candidate) return null;
  try {
    if ((await stat(candidate)).isFile()) return candidate;
  } catch {
    // Client-side routes fall back to the application entry point below.
  }

  if (path.extname(relativePath)) return null;
  const indexPath = safeResolve(rendererRoot, 'index.html');
  return indexPath && (await stat(indexPath)).isFile() ? indexPath : null;
}

export function safeResolve(root: string, relativePath: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function secureResponse(body: string, status: number, contentType: string): Response {
  return new Response(body, { status, headers: securityHeaders(contentType) });
}

function securityHeaders(contentType = 'application/octet-stream'): Headers {
  return new Headers({
    'Content-Type': contentType,
    'Content-Security-Policy': DESKTOP_CONTENT_SECURITY_POLICY,
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
}

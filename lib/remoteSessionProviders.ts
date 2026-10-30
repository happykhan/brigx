/** URL recognition only: no network requests or credentials belong in provider adapters. */
export interface RemoteSessionSource {
  provider: 'GitHub' | 'GitLab' | 'Gist' | 'Zenodo';
  url: URL;
  kind: 'file' | 'gist' | 'record' | 'gitlab';
  id?: string;
  revision?: string;
  filename?: string;
}

const UNSUPPORTED = 'Use a public GitHub, GitLab.com, GitHub Gist or Zenodo session URL';
const GIST_ID = '[a-fA-F0-9]{5,64}';
const REVISION = '[a-fA-F0-9]{40}';

export function publicUrl(input: string, allowQuery = false): URL {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new Error('Enter a complete public BRIGX session URL'); }
  try { decodeURIComponent(url.pathname); }
  catch { throw new Error('The session URL contains an invalid encoded path'); }
  if (url.protocol !== 'https:') throw new Error('Only HTTPS public session URLs are supported');
  if (url.username || url.password || url.port) throw new Error('Session URLs must not contain credentials or custom ports');
  if (!allowQuery && [...url.searchParams].some(([key, value]) => !(
    (url.hostname === 'zenodo.org' && key === 'download' && value === '1')
    || (url.hostname === 'github.com' && key === 'raw' && value === 'true')
  ))) throw new Error('Session URLs must not contain tokens or unsupported query parameters');
  url.hash = '';
  return url;
}

interface ProviderAdapter {
  recognize(url: URL): RemoteSessionSource | null;
}

const adapters: ProviderAdapter[] = [
  { recognize(url) {
    if (url.hostname === 'github.com') {
      const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+\/.+)$/);
      if (match) return { provider: 'GitHub', kind: 'file', url: new URL(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`) };
    }
    if (url.hostname === 'raw.githubusercontent.com' && /^\/[^/]+\/[^/]+\/[^/]+\/.+/.test(url.pathname)) {
      return { provider: 'GitHub', kind: 'file', url };
    }
    return null;
  } },
  { recognize(url) {
    if (url.hostname !== 'gitlab.com' || !/^\/(?:[^/]+\/){2,}-\/(?:blob|raw)\/.+\/.+$/.test(url.pathname)) return null;
    const raw = new URL(url);
    raw.pathname = raw.pathname.replace('/-/blob/', '/-/raw/');
    return { provider: 'GitLab', kind: 'gitlab', url: raw };
  } },
  { recognize(url) {
    if (url.hostname === 'gist.github.com') {
      const match = url.pathname.match(new RegExp(`^/(?:[^/]+/)?(${GIST_ID})(?:/(${REVISION}))?/?$`));
      if (match) return { provider: 'Gist', kind: 'gist', url, id: match[1], revision: match[2] };
    }
    if (url.hostname === 'gist.githubusercontent.com'
      && new RegExp(`^/[^/]+/${GIST_ID}/raw/(?:${REVISION}/)?[^/]+$`).test(url.pathname)) {
      return { provider: 'Gist', kind: 'file', url };
    }
    return null;
  } },
  { recognize(url) {
    if (url.hostname !== 'zenodo.org') return null;
    const record = url.pathname.match(/^\/records?\/(\d+)\/?$/);
    if (record) return { provider: 'Zenodo', kind: 'record', url, id: record[1] };
    const file = url.pathname.match(/^\/records?\/(\d+)\/files\/([^/]+)$/);
    if (file) {
      // Canonical plural route avoids the legacy /record/ redirect.
      url.pathname = url.pathname.replace(/^\/record\//, '/records/');
      return { provider: 'Zenodo', kind: 'record', url, id: file[1], filename: decodeURIComponent(file[2]) };
    }
    return null;
  } },
];

export function recognizeRemoteSession(input: string): RemoteSessionSource {
  const url = publicUrl(input);
  for (const adapter of adapters) {
    const source = adapter.recognize(url);
    if (source) return source;
  }
  throw new Error(UNSUPPORTED);
}

/** Retains the complete ref/path suffix; resolution must never assume refs have no slashes. */
export function normalizeRemoteJsonUrl(input: string): string {
  return recognizeRemoteSession(input).url.toString();
}

export function isSessionFilename(name: string): boolean {
  return /\.brigx-(?:session|result)\.json$/i.test(name);
}

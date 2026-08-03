const MAX_REMOTE_JSON_BYTES = 25 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 20_000;

/** Convert a public GitHub blob URL into the CORS-enabled raw file URL. */
export function normalizeGitHubJsonUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Enter a complete GitHub file URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS GitHub URLs are supported');
  }

  if (url.hostname === 'raw.githubusercontent.com') {
    return url.toString();
  }

  if (url.hostname !== 'github.com') {
    throw new Error('Only public GitHub file URLs are supported');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 5 || parts[2] !== 'blob') {
    throw new Error('Use a GitHub file URL containing /blob/');
  }

  const [owner, repository, , ref, ...fileParts] = parts;
  return `https://raw.githubusercontent.com/${owner}/${repository}/${ref}/${fileParts.join('/')}`;
}

export async function fetchGitHubJson(input: string): Promise<string> {
  const url = normalizeGitHubJsonUrl(input);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json, text/plain;q=0.9' },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_REMOTE_JSON_BYTES) {
      throw new Error('The GitHub file is larger than 25 MB');
    }

    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REMOTE_JSON_BYTES) {
      throw new Error('The GitHub file is larger than 25 MB');
    }
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('GitHub took too long to return the file');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

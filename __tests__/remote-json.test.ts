import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRemoteJson, normalizeRemoteJsonUrl } from '@/lib/remoteJson';
import { importSession } from '@/lib/session';

const filename = 'example.brigx-session.json';
const raw = `https://raw.githubusercontent.com/owner/repo/main/${filename}`;
const gistId = 'a'.repeat(32);
const revision = 'b'.repeat(40);
const gist = `https://gist.github.com/owner/${gistId}`;
const gistRaw = `https://gist.githubusercontent.com/owner/${gistId}/raw/${revision}/${filename}`;
const zenodo = 'https://zenodo.org/records/123';
const zenodoFile = `https://zenodo.org/api/records/123/files/${filename}/content`;
const gitlab = `https://gitlab.com/group/subgroup/repo/-/blob/feature/branch/path/${filename}`;
const gitlabApi = 'https://gitlab.com/api/v4/projects/group%2Fsubgroup%2Frepo/repository';
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), init);
const gistMetadata = (files = [{ filename, raw_url: gistRaw }]) => ({ public: true, files: Object.fromEntries(files.map((file, i) => [i, file])) });
const zenodoMetadata = (files = [{ key: filename, links: { self: zenodoFile } }]) => ({ id: 123, files });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('public session URL adapters', () => {
  it.each([
    [`https://github.com/owner/repo/blob/main/${filename}?raw=true`, raw],
    [raw, raw],
    [gitlab, gitlab.replace('/blob/', '/raw/')],
    [gitlab.replace('/blob/', '/raw/'), gitlab.replace('/blob/', '/raw/')],
    [gist, gist],
    [gistRaw, gistRaw],
    [`${gist}/${revision}#file-example`, `${gist}/${revision}`],
    [zenodo, zenodo],
    [`https://zenodo.org/record/123/files/${filename}?download=1`, `https://zenodo.org/records/123/files/${filename}?download=1`],
  ])('normalizes %s', (input, expected) => expect(normalizeRemoteJsonUrl(input)).toBe(expected));

  it.each([
    'not a URL', 'https://gitlab.com/group/repo/-/raw/main/%zz.json', 'http://github.com/owner/repo/blob/main/file.json',
    'https://github.com.evil.test/owner/repo/blob/main/file.json',
    'https://gitlab.evil.test/g/r/-/raw/main/file.json',
    'https://zenodo.org.evil.test/records/123', 'https://gist.github.com.evil.test/o/aaaaa',
    'https://github.com@evil.test/o/r/blob/main/file.json',
    'https://user:password@raw.githubusercontent.com/o/r/main/file.json',
    'https://raw.githubusercontent.com:444/o/r/main/file.json',
    'https://example.com/session.json', 'https://github.com/owner/repo',
    'https://raw.githubusercontent.com/', 'https://gitlab.com/group/repo/-/issues/33',
    'https://api.github.com/users/owner', 'https://zenodo.org/api/records/123',
    `${gist}?access_token=secret`, `${raw}?token=secret`, `${zenodo}?access_token=secret`,
  ])('rejects unsafe or unsupported input before fetching: %s', async input => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(fetchRemoteJson(input)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('bounded anonymous downloads', () => {
  it('omits credentials, referrer and cache and forbids automatic redirects', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ hello: 'world' })); vi.stubGlobal('fetch', fetch);
    expect(await fetchRemoteJson(raw)).toBe('{"hello":"world"}');
    expect(fetch).toHaveBeenCalledWith(raw, expect.objectContaining({
      credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal),
    }));
  });
  it.each([403, 404, 429, 500])('reports HTTP %i', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(fetchRemoteJson(raw)).rejects.toThrow(`HTTP ${status}`);
  });
  it('rejects non-JSON and validates the schema after a successful download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Sign in</html>')));
    await expect(fetchRemoteJson(raw)).rejects.toThrow('did not return JSON');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ wrong: 'schema' })));
    const text = await fetchRemoteJson(raw);
    expect(() => importSession(text)).toThrow();
  });
  it('rejects oversized Content-Length without reading the body', async () => {
    const response = new Response('small', { headers: { 'content-length': String(25 * 1024 * 1024 + 1) } });
    const cancel = vi.spyOn(response.body!, 'cancel');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchRemoteJson(raw)).rejects.toThrow('larger than 25 MB');
    expect(cancel).toHaveBeenCalled();
  });
  it('counts actual bytes, including multibyte UTF-8, and cancels oversized streams', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('é'.repeat(13 * 1024 * 1024))); }, cancel,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
    await expect(fetchRemoteJson(raw)).rejects.toThrow('larger than 25 MB');
    expect(cancel).toHaveBeenCalled();
  });
  it('uses a single 20-second deadline across metadata and file download', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementationOnce(async () => json(gistMetadata()))
      .mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
        options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }));
    vi.stubGlobal('fetch', fetch);
    const pending = expect(fetchRemoteJson(gist)).rejects.toThrow('20 seconds');
    await vi.advanceTimersByTimeAsync(20000);
    await pending;
  });
  it.each(['https://evil.test/session.json', 'https://raw.githubusercontent.com/o/r/main/other.json'])('rejects followed redirects to %s', async url => {
    const response = json({});
    Object.defineProperties(response, { redirected: { value: true }, url: { value: url } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchRemoteJson(raw)).rejects.toThrow('Redirects are not supported');
  });
  it('rejects an unexpected final origin and network/redirect failures', async () => {
    const response = json({}); Object.defineProperty(response, 'url', { value: 'https://evil.test/a' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchRemoteJson(raw)).rejects.toThrow('unsafe download origin');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchRemoteJson(raw)).rejects.toThrow('redirects are not supported');
  });
});

describe('Gist resolution', () => {
  it.each([false, true])('reads complete raw content even when API content is truncated=%s', async truncated => {
    const fetch = vi.fn().mockResolvedValueOnce(json(gistMetadata([{ filename, raw_url: gistRaw, ...{ truncated } }])))
      .mockResolvedValueOnce(json({ result: true }));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchRemoteJson(gist)).toBe('{"result":true}');
    expect(fetch.mock.calls.map(call => call[0])).toEqual([`https://api.github.com/gists/${gistId}`, gistRaw]);
  });
  it('resolves a pinned Gist revision', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(gistMetadata())).mockResolvedValueOnce(json({}));
    vi.stubGlobal('fetch', fetch); await fetchRemoteJson(`${gist}/${revision}`);
    expect(fetch.mock.calls[0][0]).toBe(`https://api.github.com/gists/${gistId}/${revision}`);
  });
  it.each([
    [gistMetadata([]), 'No BRIGX'],
    [gistMetadata([{ filename, raw_url: gistRaw }, { filename: 'second.brigx-result.json', raw_url: gistRaw }]), 'Multiple BRIGX'],
    [{ ...gistMetadata(), truncated: true }, 'incomplete'],
    [{ ...gistMetadata(), public: false }, 'Only public'],
    [gistMetadata([{ filename, raw_url: 'https://evil.test/file.json' }]), 'public GitHub'],
    [gistMetadata([{ filename, raw_url: gistRaw.replace(gistId, 'c'.repeat(32)) }]), 'unsafe raw-file'],
    [{ public: true, files: { one: { filename, content: '{}' } } }, 'no downloadable'],
  ])('rejects unavailable, ambiguous or unsafe Gist metadata', async (metadata, message) => {
    const fetch = vi.fn().mockResolvedValueOnce(json(metadata)); vi.stubGlobal('fetch', fetch);
    await expect(fetchRemoteJson(gist)).rejects.toThrow(String(message));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Zenodo resolution', () => {
  it('uses the exact record and API-provided file link', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(zenodoMetadata())).mockResolvedValueOnce(json({}));
    vi.stubGlobal('fetch', fetch); await fetchRemoteJson(zenodo);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['https://zenodo.org/api/records/123', zenodoFile]);
  });
  it('resolves a direct file through metadata and selects it explicitly among multiple files', async () => {
    const metadata = zenodoMetadata([
      { key: filename, links: { self: zenodoFile } },
      { key: 'second.brigx-result.json', links: { self: zenodoFile } },
    ]);
    const fetch = vi.fn().mockResolvedValueOnce(json(metadata)).mockResolvedValueOnce(json({}));
    vi.stubGlobal('fetch', fetch);
    await fetchRemoteJson(`https://zenodo.org/records/123/files/${filename}?download=1`);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['https://zenodo.org/api/records/123', zenodoFile]);
  });
  it('rejects a missing explicitly requested file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(zenodoMetadata([]))));
    await expect(fetchRemoteJson(`https://zenodo.org/records/123/files/${filename}`)).rejects.toThrow('not available');
  });
  it.each([
    [zenodoMetadata([]), 'No BRIGX'],
    [zenodoMetadata([{ key: filename, links: { self: zenodoFile } }, { key: 'second.brigx-result.json', links: { self: zenodoFile } }]), 'Multiple BRIGX'],
    [{ ...zenodoMetadata(), id: 124 }, 'different record version'],
    [zenodoMetadata([{ key: filename, links: { self: 'https://evil.test/file' } }]), 'unsafe file'],
    [zenodoMetadata([{ key: filename, links: { self: zenodoFile.replace('/123/', '/124/') } }]), 'unsafe file'],
    [zenodoMetadata([{ key: filename, links: { self: `${zenodoFile}?token=secret` } }]), 'tokens'],
    [{ id: 123 }, 'no public downloadable'],
  ])('rejects ambiguous, unavailable, unsafe or wrong-version metadata', async (metadata, message) => {
    const fetch = vi.fn().mockResolvedValueOnce(json(metadata)); vi.stubGlobal('fetch', fetch);
    await expect(fetchRemoteJson(zenodo)).rejects.toThrow(String(message));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('GitLab browser API resolution', () => {
  it('resolves a slash-containing branch and pins its commit without assuming a ref/path boundary', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === `${gitlabApi}/branches/feature%2Fbranch`) return json({ name: 'feature/branch', commit: { id: revision } });
      if (url.includes('/files/')) return json({ result: true });
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetch); await fetchRemoteJson(gitlab);
    expect(fetch).toHaveBeenLastCalledWith(`${gitlabApi}/files/path%2F${filename}/raw?ref=${revision}`, expect.anything());
  });
  it('loads commit-pinned URLs without ref lookup', async () => {
    const fetch = vi.fn().mockResolvedValue(json({})); vi.stubGlobal('fetch', fetch);
    await fetchRemoteJson(`https://gitlab.com/group/repo/-/raw/${revision}/${filename}`);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects missing refs and conflicting branch/tag commits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchRemoteJson(gitlab)).rejects.toThrow('reference was not found');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => json({
      name: `feature/branch/path`, commit: { id: url.includes('/branches/') ? revision : 'c'.repeat(40) },
    })));
    await expect(fetchRemoteJson(gitlab)).rejects.toThrow('branch and tag');
  });
});

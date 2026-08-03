import { describe, expect, it } from 'vitest';
import { normalizeGitHubJsonUrl } from '@/lib/remoteJson';

describe('GitHub JSON URLs', () => {
  it('converts a normal GitHub blob URL to its raw file URL', () => {
    expect(normalizeGitHubJsonUrl(
      'https://github.com/happykhan/brigx/blob/master/public/examples/example.json',
    )).toBe(
      'https://raw.githubusercontent.com/happykhan/brigx/master/public/examples/example.json',
    );
  });

  it('keeps raw GitHub URLs intact', () => {
    const url = 'https://raw.githubusercontent.com/happykhan/brigx/master/example.json';
    expect(normalizeGitHubJsonUrl(url)).toBe(url);
  });

  it('rejects non-GitHub and insecure URLs', () => {
    expect(() => normalizeGitHubJsonUrl('https://example.com/session.json')).toThrow('Only public GitHub');
    expect(() => normalizeGitHubJsonUrl('http://github.com/owner/repo/blob/main/file.json')).toThrow('Only HTTPS');
  });
});

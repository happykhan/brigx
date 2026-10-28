import type { ReadRemoteJson } from './remoteJson';

/**
 * GitLab web raw endpoints lack CORS. Resolve actual refs through its public API
 * before using the CORS-enabled files endpoint; never assume the first slash ends a ref.
 */
export async function resolveGitLabFile(url: URL, read: ReadRemoteJson): Promise<string> {
  const [projectPath, suffix] = url.pathname.split('/-/raw/');
  const project = encodeURIComponent(decodeURIComponent(projectPath.slice(1)));
  const parts = decodeURIComponent(suffix).split('/');
  if (parts.length > 32 || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\') || [...part].some(character => character.charCodeAt(0) < 32))) {
    throw new Error('Unsupported GitLab file path. Use a URL pinned to a commit.');
  }
  const api = `https://gitlab.com/api/v4/projects/${project}/repository`;
  const fileUrl = (ref: string, path: string) => `${api}/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`;
  if (/^[a-f\d]{40}$/i.test(parts[0]) || parts[0] === 'HEAD') {
    return fileUrl(parts[0], parts.slice(1).join('/'));
  }
  const getRef = async (type: string, name: string): Promise<Record<string, unknown> | null> => {
    try {
      const value = await read(`${api}/${type}/${encodeURIComponent(name)}`);
      if (!value || typeof value !== 'object' || !('name' in value) || value.name !== name) {
        throw new Error('GitLab returned invalid reference metadata');
      }
      return value as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) return null;
      throw error;
    }
  };
  // GitLab uses the longest matching ref. Look up complete names, including slashes.
  for (let end = parts.length - 1; end > 0; end--) {
    const ref = parts.slice(0, end).join('/');
    const branch = await getRef('branches', ref);
    const tag = await getRef('tags', ref);
    if (branch && tag) {
      const branchCommit = branch.commit as { id?: string } | undefined;
      const tagCommit = tag.commit as { id?: string } | undefined;
      if (!branchCommit?.id || branchCommit.id !== tagCommit?.id) {
        throw new Error('GitLab has a branch and tag with this name. Use a file URL pinned to a commit.');
      }
    }
    if (branch || tag) {
      const commit = (branch ?? tag)?.commit as { id?: string } | undefined;
      if (!commit?.id || !/^[a-f\d]{40}$/i.test(commit.id)) throw new Error('GitLab returned an invalid commit');
      return fileUrl(commit.id, parts.slice(end).join('/'));
    }
  }
  throw new Error('The GitLab reference was not found. Check public access or use a commit-pinned file URL.');
}

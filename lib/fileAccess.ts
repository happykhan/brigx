const FILE_ACCESS_HINTS = [
  'notreadableerror',
  'notfounderror',
  'securityerror',
  'permission',
  'could not be read',
  'cannot read',
  'failed to read',
  'requested file could not be read',
];

export class FileAccessError extends Error {
  readonly cause?: unknown;

  constructor(fileName: string, cause?: unknown) {
    super(
      `BRIGX can no longer read "${fileName}". Re-select the file and try again. ` +
      'If it is in cloud storage or on a removable drive, make it available locally first.',
    );
    this.name = 'FileAccessError';
    this.cause = cause;
  }
}

/** Convert browser File API permission/staleness failures into an actionable message. */
export function normaliseFileAccessError(error: unknown, fileName: string): Error {
  if (error instanceof FileAccessError) return error;

  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  const fingerprint = `${name} ${message}`.toLowerCase();

  if (FILE_ACCESS_HINTS.some(hint => fingerprint.includes(hint))) {
    return new FileAccessError(fileName, error);
  }

  return error instanceof Error ? error : new Error(message);
}

export async function readFileText(file: Pick<File, 'name' | 'text'>): Promise<string> {
  try {
    return await file.text();
  } catch (error) {
    throw normaliseFileAccessError(error, file.name);
  }
}

export async function readFileArrayBuffer(
  file: Pick<File, 'name' | 'arrayBuffer'>,
): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch (error) {
    throw normaliseFileAccessError(error, file.name);
  }
}

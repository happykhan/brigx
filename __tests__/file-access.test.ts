import { describe, expect, it, vi } from 'vitest';
import {
  FileAccessError,
  normaliseFileAccessError,
  readFileArrayBuffer,
  readFileText,
} from '@/lib/fileAccess';

describe('browser file access failures', () => {
  it('turns a stale text File handle into an actionable re-selection message', async () => {
    const file = {
      name: 'reference.fna',
      text: vi.fn().mockRejectedValue(
        new DOMException(
          'The requested file could not be read, typically due to permission problems.',
          'NotReadableError',
        ),
      ),
    };

    await expect(readFileText(file)).rejects.toThrow(
      'BRIGX can no longer read "reference.fna". Re-select the file',
    );
  });

  it('normalises array-buffer permission errors used by the parser worker', async () => {
    const file = {
      name: 'query.fna.gz',
      arrayBuffer: vi.fn().mockRejectedValue(new Error('Permission denied')),
    };

    await expect(readFileArrayBuffer(file)).rejects.toBeInstanceOf(FileAccessError);
  });

  it('preserves unrelated parsing errors', () => {
    const error = new Error('Invalid FASTA content');
    expect(normaliseFileAccessError(error, 'bad.fa')).toBe(error);
  });
});

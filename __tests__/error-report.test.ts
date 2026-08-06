import { describe, expect, it } from 'vitest';
import { buildErrorReportText } from '@/lib/errorReport';

describe('buildErrorReportText', () => {
  it('includes the visible error and diagnostic tail', () => {
    const text = buildErrorReportText('Failed to load BLAST module', [
      '[LOG] [Controller] Starting initialization...',
      '[ERROR] [Page] Alignment error',
    ]);

    expect(text).toContain('BRIGX error\n\nFailed to load BLAST module');
    expect(text).toContain('Diagnostic log (last 2 messages)');
    expect(text).toContain('[ERROR] [Page] Alignment error');
  });

  it('limits copied diagnostics to the most recent messages', () => {
    const logs = Array.from({ length: 60 }, (_, index) => `message ${index + 1}`);
    const text = buildErrorReportText('Failure', logs);

    expect(text).not.toContain('message 10\n');
    expect(text).toContain('message 11');
    expect(text).toContain('message 60');
  });
});

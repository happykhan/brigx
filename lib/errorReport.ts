const ERROR_LOG_TAIL_LENGTH = 50;

export function buildErrorReportText(error: string, diagnosticLogs: string[]): string {
  const tail = diagnosticLogs.slice(-ERROR_LOG_TAIL_LENGTH);
  const sections = [
    'BRIGX error',
    error,
  ];

  if (tail.length > 0) {
    sections.push(`Diagnostic log (last ${tail.length} messages)`, tail.join('\n'));
  }

  return sections.join('\n\n');
}

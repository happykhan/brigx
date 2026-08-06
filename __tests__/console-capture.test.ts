import { describe, expect, it } from 'vitest';
import { formatVisibleConsoleLine, isUsefulConsoleLine, summarizeConsoleArguments } from '../hooks/useConsoleCapture';

describe('summarizeConsoleArguments', () => {
  it('omits large payloads and summarizes arrays', () => {
    expect(summarizeConsoleArguments([{
      sequence: 'ACTG',
      hits: [1, 2, 3, 4, 5, 6],
      name: 'ring',
    }])).toBe('{"sequence":"[omitted]","hits":"[6 items]","name":"ring"}');
  });

  it('handles circular diagnostic objects safely', () => {
    const value: Record<string, unknown> = { name: 'cycle' };
    value.self = value;
    expect(summarizeConsoleArguments([value])).toContain('[circular]');
  });
});

describe('formatVisibleConsoleLine', () => {
  it('removes routine level and source prefixes', () => {
    expect(formatVisibleConsoleLine('[LOG] [Controller] Starting initialization...'))
      .toBe('Starting initialization...');
    expect(formatVisibleConsoleLine('[LOG] [Page] Reference file loaded'))
      .toBe('Reference file loaded');
  });

  it('retains meaningful warning and error severity', () => {
    expect(formatVisibleConsoleLine('[WARN] [Controller] Falling back to one worker'))
      .toBe('Warning: Falling back to one worker');
    expect(formatVisibleConsoleLine('[ERROR] [Page] Alignment failed'))
      .toBe('Error: Alignment failed');
  });

  it('renders captured dictionaries as readable key-value details', () => {
    expect(formatVisibleConsoleLine(
      '[LOG] [Controller] Parameters: {"minIdentity":70,"minAlignmentLength":1000,"colorScheme":"blue-red","forceAlignment":false,"alignerOptions":""}',
    )).toBe([
      'Parameters:',
      '• Minimum identity: 70',
      '• Minimum alignment length: 1000',
      '• Colour scheme: blue-red',
      '• Force alignment: No',
      '• Aligner options: Not set',
    ].join('\n'));

    expect(formatVisibleConsoleLine(
      '[LOG] [RingConfiguration] Creating new ring: {"id":"ring_1","legendText":"Ring 1","files":"[]","color":"#e74c3c"}',
    )).toContain('• Files: None');
  });

  it('gives empty error objects a useful fallback', () => {
    expect(formatVisibleConsoleLine('[ERROR] [Page] Alignment error: {}'))
      .toBe('Error: Alignment error: No details');
  });
});

describe('isUsefulConsoleLine', () => {
  it('hides repeated ring-render chatter from existing and future logs', () => {
    expect(isUsefulConsoleLine('[LOG] [Page] Ring settings changed, updating plot')).toBe(false);
    expect(isUsefulConsoleLine('[ERROR] [Page] Alignment failed')).toBe(true);
  });
});

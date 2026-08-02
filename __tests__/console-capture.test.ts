import { describe, expect, it } from 'vitest';
import { summarizeConsoleArguments } from '../hooks/useConsoleCapture';

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

import { useCallback, useEffect, useState } from 'react';

const MAX_CAPTURED_LOGS = 500;
const MAX_SUMMARY_DEPTH = 2;

function summarizeValue(value: unknown, seen: WeakSet<object>, depth: number): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_SUMMARY_DEPTH) return '[object]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.length > 5
      ? `[Array(${value.length})]`
      : `[${value.map(item => summarizeValue(item, seen, depth + 1)).join(', ')}]`;
  }

  const summary: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'partialData' || key === 'sequence') {
      summary[key] = '[omitted]';
    } else if (Array.isArray(item) && item.length > 5) {
      summary[key] = `[${item.length} items]`;
    } else if (typeof item === 'object' && item !== null) {
      summary[key] = summarizeValue(item, seen, depth + 1);
    } else {
      summary[key] = item === undefined ? 'undefined' : item;
    }
  }
  return JSON.stringify(summary);
}

export function summarizeConsoleArguments(args: readonly unknown[]): string {
  const seen = new WeakSet<object>();
  return args.map(argument => summarizeValue(argument, seen, 0)).join(' ');
}

/** Capture browser console output for the on-page diagnostic console. */
export function useConsoleCapture() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const originals = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    const capture = (level: 'LOG' | 'ERROR' | 'WARN', args: readonly unknown[]) => {
      const entry = `[${level}] ${summarizeConsoleArguments(args)}`;
      setLogs(previous => [...previous.slice(-(MAX_CAPTURED_LOGS - 1)), entry]);
    };

    console.log = (...args: unknown[]) => {
      capture('LOG', args);
      originals.log.apply(console, args);
    };
    console.error = (...args: unknown[]) => {
      capture('ERROR', args);
      originals.error.apply(console, args);
    };
    console.warn = (...args: unknown[]) => {
      capture('WARN', args);
      originals.warn.apply(console, args);
    };

    return () => {
      console.log = originals.log;
      console.error = originals.error;
      console.warn = originals.warn;
    };
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);
  return { logs, clearLogs };
}

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

const VISIBLE_FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  minIdentity: 'Minimum identity',
  minAlignmentLength: 'Minimum alignment length',
  colorScheme: 'Colour scheme',
  forceAlignment: 'Force alignment',
  alignerOptions: 'Aligner options',
  legendText: 'Legend',
  files: 'Files',
  color: 'Colour',
  upperThreshold: 'Upper threshold',
  lowerThreshold: 'Lower threshold',
};

function visibleFieldLabel(key: string): string {
  if (VISIBLE_FIELD_LABELS[key]) return VISIBLE_FIELD_LABELS[key];
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

function visibleFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(visibleFieldValue).join(', ') : 'None';
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${visibleFieldLabel(key)}: ${visibleFieldValue(item)}`)
      .join(', ');
  }
  if (value === '[]') return 'None';
  const capturedCount = typeof value === 'string' && value.match(/^\[(\d+) items\]$/);
  if (capturedCount) return `${capturedCount[1]} items`;
  return String(value);
}

function formatVisibleObject(message: string): string {
  const objectStart = message.indexOf('{');
  if (objectStart < 0 || !message.endsWith('}')) return message;

  try {
    const value: unknown = JSON.parse(message.slice(objectStart));
    if (!value || Array.isArray(value) || typeof value !== 'object') return message;

    const heading = message.slice(0, objectStart).trim().replace(/:$/, '');
    const entries = Object.entries(value);
    if (entries.length === 0) return heading ? `${heading}: No details` : 'No details';

    const details = entries
      .map(([key, item]) => `• ${visibleFieldLabel(key)}: ${visibleFieldValue(item)}`)
      .join('\n');
    return heading ? `${heading}:\n${details}` : details;
  } catch {
    return message;
  }
}

/** Remove capture metadata and implementation origins from the on-page console. */
export function formatVisibleConsoleLine(line: string): string {
  const captured = line.match(/^\[(LOG|WARN|ERROR)\]\s*(.*)$/s);
  const level = captured?.[1];
  const message = formatVisibleObject(
    (captured?.[2] ?? line).replace(/^(?:\[[^\]]+\]\s*)+/, ''),
  );

  if (level === 'ERROR') return `Error: ${message}`;
  if (level === 'WARN') return `Warning: ${message}`;
  return message;
}

/** Hide routine render chatter that cannot help diagnose a failed analysis. */
export function isUsefulConsoleLine(line: string): boolean {
  return !line.includes('Ring settings changed, updating plot');
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

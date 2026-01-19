// Parse annotation files (CSV/TSV format)
import type { Annotation } from './types';

export interface ParsedAnnotations {
  annotations: Annotation[];
  errors: string[];
}

/**
 * Parse annotation file in CSV or TSV format
 * Expected format:
 * #Start  Stop   Label
 * 300041  310626 Sp 1
 * 310627  323513 Sp 2
 * ...
 */
export function parseAnnotationFile(content: string, referenceLength: number): ParsedAnnotations {
  const lines = content.split('\n').filter(line => line.trim());
  const annotations: Annotation[] = [];
  const errors: string[] = [];
  
  let headerFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check for header line
    if (line.startsWith('#') || line.toLowerCase().includes('start')) {
      headerFound = true;
      continue;
    }
    
    // Parse data line - try tab first, then comma, then any whitespace
    let parts: string[];
    if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim());
    } else {
      parts = line.split(/\s+/).filter(p => p);
    }
    
    // Need at least 3 columns: start, stop, label
    if (parts.length < 3) {
      errors.push(`Line ${i + 1}: Expected at least 3 columns (start, stop, label), got ${parts.length}`);
      continue;
    }
    
    const start = parseInt(parts[0], 10);
    const stop = parseInt(parts[1], 10);
    const label = parts.slice(2).join(' '); // Join remaining parts as label
    
    // Validate numbers
    if (isNaN(start)) {
      errors.push(`Line ${i + 1}: Invalid start position "${parts[0]}"`);
      continue;
    }
    
    if (isNaN(stop)) {
      errors.push(`Line ${i + 1}: Invalid stop position "${parts[1]}"`);
      continue;
    }
    
    if (start < 1) {
      errors.push(`Line ${i + 1}: Start position ${start} < 1, will be clamped to 1`);
    }
    
    if (stop > referenceLength) {
      errors.push(`Line ${i + 1}: Stop position ${stop} > reference length ${referenceLength}, will be clamped`);
    }
    
    // Wrap values to reference length
    const clampedStart = Math.max(1, Math.min(start, referenceLength));
    const clampedStop = Math.max(1, Math.min(stop, referenceLength));
    
    // Create annotation with default block shape
    annotations.push({
      id: `ann-${Date.now()}-${i}`,
      start: clampedStart,
      end: clampedStop,
      label: label || `Region ${annotations.length + 1}`,
      shape: 'block',
      color: '#666666'
    });
  }
  
  if (!headerFound && annotations.length === 0) {
    errors.push('No header found. Expected format: #Start\\tStop\\tLabel or Start,Stop,Label');
  }
  
  return { annotations, errors };
}

/**
 * Export annotations to TSV format
 */
export function exportAnnotationsToTSV(annotations: Annotation[]): string {
  const lines = ['#Start\tStop\tLabel'];
  
  annotations.forEach(ann => {
    lines.push(`${ann.start}\t${ann.end}\t${ann.label}`);
  });
  
  return lines.join('\n');
}

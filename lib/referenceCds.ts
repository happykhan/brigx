import type { ReferenceCDS } from './types';

/** Read local CDS locations without treating the spaces between joined exons as CDS. */
export function parseReferenceCds(record: string, length: number): ReferenceCDS[] {
  const section = record.match(/^FEATURES[^\n]*\n([\s\S]*?)(?=^ORIGIN|^CONTIG|^BASE COUNT|(?![\s\S]))/m)?.[1];
  if (!section) return [];
  const result: ReferenceCDS[] = [];
  const entries = section.matchAll(/^ {5}(\S+)\s+([^\n]+)\n((?:^ {21}[^\n]*\n?)*)/gm);
  for (const entry of entries) {
    if (entry[1] !== 'CDS') continue;
    const body = entry[2] + '\n' + entry[3];
    const location = body.split(/\s+\//, 1)[0].replace(/\s/g, '');
    // Remote locations and unsupported operators must not be mistaken for local coordinates.
    const coordinates = location.replace(/complement|join|order/g, '').replace(/[()<>]/g, '');
    if (!/^\d+(?:\.\.\d+)?(?:,\d+(?:\.\.\d+)?)*$/.test(coordinates)) continue;
    const segments = coordinates.split(',').map(part => {
      const [first, last = first] = part.split('..').map(Number);
      return { start: first - 1, end: last };
    });
    if (segments.some(segment => segment.start < 0 || segment.end > length || segment.end <= segment.start)) continue;
    const qualifier = (name: string) => body.match(new RegExp(`/${name}="([^"]*)"`))?.[1].replace(/\s+/g, ' ').trim();
    const gene = qualifier('gene');
    const locusTag = qualifier('locus_tag');
    const product = qualifier('product');
    result.push({ name: gene || locusTag || product || 'CDS', locusTag, product,
      strand: location.startsWith('complement(') ? '-' : '+', segments });
  }
  return result;
}

/** Offset record-local CDS when reference records are concatenated with spacers. */
export function offsetReferenceCds(cds: readonly ReferenceCDS[], offset: number): ReferenceCDS[] {
  return cds.map(feature => ({ ...feature,
    segments: feature.segments.map(segment => ({ start: segment.start + offset, end: segment.end + offset })),
  }));
}

import type { Annotation, AnnotationShape } from './types';

/** Extract simple, contiguous features from GenBank FEATURES sections. */
export function extractGenBankFeatures(
  text: string,
  featureType: string,
  textContains?: string,
): Annotation[] {
  const annotations: Annotation[] = [];
  const records = text.split(/^LOCUS/m).filter(record => record.trim().length > 0);

  for (const record of records) {
    const featuresMatch = record.match(/FEATURES[\s\S]*?(?=ORIGIN|CONTIG|BASE COUNT|$)/);
    if (!featuresMatch) continue;

    const featureRegex = /^ {5}(\S+)\s+(complement\()?(\d+)\.\.(\d+)\)?\s*\n((?:^ {21}\S.*\n)*)/gm;
    let match: RegExpExecArray | null;
    while ((match = featureRegex.exec(featuresMatch[0])) !== null) {
      const type = match[1];
      if (type !== featureType) continue;

      const start = Number.parseInt(match[3], 10);
      const end = Number.parseInt(match[4], 10);
      const qualifierBlock = match[5] || '';
      if (textContains && !qualifierBlock.toLowerCase().includes(textContains.toLowerCase())) {
        continue;
      }

      const gene = qualifierBlock.match(/\/gene="([^"]+)"/)?.[1];
      const product = qualifierBlock.match(/\/product="([^"]+)"/)?.[1];
      const locusTag = qualifierBlock.match(/\/locus_tag="([^"]+)"/)?.[1];
      const shape: AnnotationShape = match[2] ? 'arrow-reverse' : 'arrow-forward';

      annotations.push({
        id: `gbk-${annotations.length}-${start}`,
        start,
        end,
        label: gene || locusTag || product || type,
        shape,
        color: '#000000',
      });
    }
  }

  return annotations;
}

function parseGffAttributes(attributeText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of attributeText.split(';')) {
    const separator = attribute.indexOf('=');
    if (separator === -1) continue;
    const key = attribute.slice(0, separator).trim();
    const encodedValue = attribute.slice(separator + 1).trim();
    try {
      attributes[key] = decodeURIComponent(encodedValue);
    } catch {
      attributes[key] = encodedValue;
    }
  }
  return attributes;
}

/** Extract features from a GFF3 document as editable BRIGX annotations. */
export function extractGFF3Features(
  text: string,
  featureType: string,
  textContains?: string,
): Annotation[] {
  const annotations: Annotation[] = [];

  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const fields = line.split('\t');
    if (fields.length < 9 || fields[2] !== featureType) continue;

    const start = Number.parseInt(fields[3], 10);
    const end = Number.parseInt(fields[4], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const attributes = parseGffAttributes(fields[8]);
    if (
      textContains
      && !Object.values(attributes).join(' ').toLowerCase().includes(textContains.toLowerCase())
    ) {
      continue;
    }

    const shape: AnnotationShape = fields[6] === '-' ? 'arrow-reverse' : 'arrow-forward';
    annotations.push({
      id: `gff-${annotations.length}-${start}`,
      start,
      end,
      label: attributes.gene
        || attributes.locus_tag
        || attributes.Name
        || attributes.product
        || attributes.ID
        || featureType,
      shape,
      color: '#000000',
    });
  }

  return annotations;
}

/** Parse a companion reference-annotation file by its standard extension. */
export function extractReferenceAnnotationFile(
  text: string,
  fileName: string,
  featureType = 'CDS',
): Annotation[] {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith('.gff3') || normalizedName.endsWith('.gff')) {
    return extractGFF3Features(text, featureType);
  }
  if (
    normalizedName.endsWith('.gbff')
    || normalizedName.endsWith('.gbk')
    || normalizedName.endsWith('.gb')
    || normalizedName.endsWith('.genbank')
  ) {
    return extractGenBankFeatures(text, featureType);
  }
  throw new Error('Reference annotations must be GFF3, GFF, GenBank, or GBFF format.');
}

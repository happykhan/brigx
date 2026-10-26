import type { ReferenceCDS } from "./types";

const FEATURES_SECTION = /^FEATURES[^\n]*\n([\s\S]*?)(?=^ORIGIN|^CONTIG|^BASE COUNT|(?![\s\S]))/m;
const FEATURE_ENTRIES = /^ {5}(\S+)\s+([^\n]+)\n((?:^ {21}[^\n]*\n?)*)/gm;
const LOCAL_COORDINATES = /^\d+(?:\.\.\d+)?(?:,\d+(?:\.\.\d+)?)*$/;

function parseCdsSegments(location: string, length: number): ReferenceCDS["segments"] | null {
  // Remote locations and unsupported operators must not be mistaken for local coordinates.
  const coordinates = location.replace(/complement|join|order/g, "").replace(/[()<>]/g, "");
  if (!LOCAL_COORDINATES.test(coordinates)) return null;

  const segments = coordinates.split(",").map((part) => {
    const [first, last = first] = part.split("..").map(Number);
    return { start: first - 1, end: last };
  });
  const outsideReference = segments.some((segment) => segment.start < 0 || segment.end > length || segment.end <= segment.start);
  return outsideReference ? null : segments;
}

function readQualifier(body: string, pattern: RegExp): string | undefined {
  return body.match(pattern)?.[1].replace(/\s+/g, " ").trim();
}

/** Read local CDS locations without treating the spaces between joined exons as CDS. */
export function parseReferenceCds(record: string, length: number): ReferenceCDS[] {
  const section = record.match(FEATURES_SECTION)?.[1];
  if (!section) return [];

  const result: ReferenceCDS[] = [];
  for (const entry of section.matchAll(FEATURE_ENTRIES)) {
    if (entry[1] !== "CDS") continue;

    const body = `${entry[2]}\n${entry[3]}`;
    const location = body.split(/\s+\//, 1)[0].replace(/\s/g, "");
    const segments = parseCdsSegments(location, length);
    if (!segments) continue;

    const gene = readQualifier(body, /\/gene="([^"]*)"/);
    const locusTag = readQualifier(body, /\/locus_tag="([^"]*)"/);
    const product = readQualifier(body, /\/product="([^"]*)"/);
    result.push({
      name: gene || locusTag || product || "CDS",
      locusTag,
      product,
      strand: location.startsWith("complement(") ? "-" : "+",
      segments,
    });
  }

  return result;
}

/** Offset record-local CDS when reference records are concatenated with spacers. */
export function offsetReferenceCds(cds: readonly ReferenceCDS[], offset: number): ReferenceCDS[] {
  return cds.map((feature) => ({
    ...feature,
    segments: feature.segments.map((segment) => ({
      start: segment.start + offset,
      end: segment.end + offset,
    })),
  }));
}

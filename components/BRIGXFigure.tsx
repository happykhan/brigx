import { useEffect, useRef } from 'react';
import { CircularPlotRenderer } from '@/lib/renderer';
import type { AlignmentHit, CircularPlotData, RingData } from '@/lib/types';

const REFERENCE_LENGTH = 5_498_450;

function hit(start: number, end: number, identity: number, strand: '+' | '-' = '+'): AlignmentHit {
  return {
    queryName: 'representative genome',
    refStart: start,
    refEnd: end,
    queryStart: 1,
    queryEnd: end - start + 1,
    percentIdentity: identity,
    alignmentLength: end - start + 1,
    strand,
  };
}

function ring(queryId: string, queryName: string, color: string, offset: number): RingData {
  const segments: AlignmentHit[] = [];
  for (let index = 0; index < 15; index += 1) {
    const start = 70_000 + index * 355_000 + offset;
    const length = 180_000 + ((index * 41_000 + offset) % 120_000);
    if (start < REFERENCE_LENGTH) {
      segments.push(hit(start, Math.min(start + length, REFERENCE_LENGTH - 10_000), 73 + ((index * 7 + offset) % 27), index % 4 === 0 ? '-' : '+'));
    }
  }
  return {
    queryId,
    queryName,
    color,
    visible: true,
    hits: segments,
    statistics: {
      meanIdentity: 91.4,
      genomeCoverage: 84.7,
      totalAlignedBases: segments.reduce((total, segment) => total + segment.alignmentLength, 0),
    },
  };
}

const gcContent = Array.from({ length: 120 }, (_, index) => 0.5 + Math.sin(index * 0.43) * 0.08 + Math.cos(index * 0.19) * 0.035);
const gcSkew = Array.from({ length: 120 }, (_, index) => Math.sin(index * 0.16) * 0.34 + Math.cos(index * 0.07) * 0.12);

const representativeData: CircularPlotData = {
  reference: {
    name: 'E. coli O157:H7 Sakai',
    length: REFERENCE_LENGTH,
    gcContent,
    gcSkew,
    annotations: [
      { id: 'stx', start: 1_315_000, end: 1_352_000, label: 'stx region', shape: 'arrow-forward', color: '#b91c1c' },
      { id: 'lee', start: 4_610_000, end: 4_646_000, label: 'LEE', shape: 'arrow-reverse', color: '#7c3aed' },
    ],
  },
  rings: [
    ring('cft073', 'E. coli CFT073', '#2563eb', 0),
    ring('uti89', 'E. coli UTI89', '#0d9488', 55_000),
    ring('k12', 'E. coli K-12 MG1655', '#d97706', 105_000),
    ring('hs', 'E. coli HS', '#7c3aed', 150_000),
  ],
  config: { minIdentity: 70, minAlignmentLength: 100 },
};

export default function BRIGXFigure() {
  const figureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = figureRef.current;
    if (!container) return;
    const renderer = new CircularPlotRenderer({
      width: 1000,
      height: 1000,
      innerRadius: 185,
      ringWidth: 34,
      gcRingWidth: 32,
      ringSpacing: 5,
      minIdentity: 70,
      maxIdentity: 100,
      legendFontSize: 15,
      scaleFontSize: 11,
      titleFontSize: 23,
      labelFontSize: 12,
      title: 'Representative BRIGX comparison',
      showLegend: true,
    });
    renderer.render(container, representativeData);
  }, []);

  return (
    <figure className="product-figure">
      <div
        ref={figureRef}
        className="product-figure-canvas"
        role="img"
        aria-label="Representative circular comparison rendered by the first-party BRIGX renderer"
      />
      <figcaption>Representative output rendered in-page by BRIGX’s first-party circular renderer.</figcaption>
    </figure>
  );
}

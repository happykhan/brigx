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
  for (let index = 0; index < 12; index += 1) {
    const start = 85_000 + index * 445_000 + offset;
    const length = 235_000 + ((index * 47_000 + offset) % 135_000);
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
  },
  rings: [
    ring('cft073', 'E. coli CFT073', '#315c83', 0),
    ring('uti89', 'E. coli UTI89', '#2e8585', 55_000),
    ring('k12', 'E. coli K-12 MG1655', '#b86b29', 105_000),
    ring('hs', 'E. coli HS', '#76579b', 150_000),
  ],
  config: { minIdentity: 70, minAlignmentLength: 100 },
};

export default function BRIGXFigure() {
  const figureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = figureRef.current;
    if (!container) return;
    const renderer = new CircularPlotRenderer({
      width: 720,
      height: 720,
      innerRadius: 155,
      ringWidth: 23,
      gcRingWidth: 18,
      ringSpacing: 3,
      minIdentity: 70,
      maxIdentity: 100,
      legendFontSize: 12,
      scaleFontSize: 9,
      titleFontSize: 18,
      labelFontSize: 10,
      title: '',
      showLegend: false,
    });
    renderer.render(container, representativeData);
  }, []);

  return (
    <figure className="product-figure">
      <header className="product-figure-header">
        <div>
          <span>Comparative map</span>
          <strong>E. coli O157:H7 Sakai</strong>
        </div>
        <span className="product-figure-reference">5.50 Mb reference</span>
      </header>
      <div className="product-figure-body">
        <div
          ref={figureRef}
          className="product-figure-canvas"
          role="img"
          aria-label="Representative circular comparison of E. coli genomes rendered by BRIGX"
        />
        <div className="product-figure-key" aria-label="Comparison rings">
          {representativeData.rings.map((comparisonRing, index) => (
            <div key={comparisonRing.queryId}>
              <span className="product-figure-key-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="product-figure-key-swatch" style={{ backgroundColor: comparisonRing.color }} aria-hidden="true" />
              <span>{comparisonRing.queryName}</span>
            </div>
          ))}
        </div>
      </div>
      <figcaption>
        <span>Representative comparison</span>
        <span>Rendered live by BRIGX</span>
      </figcaption>
    </figure>
  );
}

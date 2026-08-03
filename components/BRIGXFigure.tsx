import { useEffect, useRef, useState } from 'react';
import { CircularPlotRenderer } from '@/lib/renderer';
import type { CircularPlotData } from '@/lib/types';

interface PublicationData {
  plot: CircularPlotData;
}

export default function BRIGXFigure() {
  const figureRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CircularPlotData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/publications/ecoli-comparison.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Comparison data returned ${response.status}`);
        return response.json() as Promise<PublicationData>;
      })
      .then(publication => setData(publication.plot))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const container = figureRef.current;
    if (!container || !data) return;
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
    renderer.render(container, data);
  }, [data]);

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
          aria-label="Circular comparison of E. coli genomes generated from the repository example data"
        >
          {!data && !loadFailed && <span>Loading comparison…</span>}
          {loadFailed && <span>Comparison unavailable.</span>}
        </div>
        {data && (
          <div className="product-figure-key" aria-label="Comparison rings">
            {data.rings.map((comparisonRing, index) => (
              <div key={comparisonRing.queryId}>
                <span className="product-figure-key-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="product-figure-key-swatch" style={{ backgroundColor: comparisonRing.color }} aria-hidden="true" />
                <span>{comparisonRing.queryName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <figcaption>
        <span>Repository example data</span>
        <span>Rendered live by BRIGX</span>
      </figcaption>
    </figure>
  );
}

import { useEffect, useState } from 'react';
import CircularPlot from '@/components/CircularPlot';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';
import type { CircularPlotData } from '@/lib/types';

interface PublicationData {
  plot: CircularPlotData;
  imageConfig: ImagePropertiesConfig;
}

export default function BRIGXFigure() {
  const [publication, setPublication] = useState<PublicationData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/publications/ecoli-comparison.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Comparison data returned ${response.status}`);
        return response.json() as Promise<PublicationData>;
      })
      .then(setPublication)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <section
      aria-label="Interactive read-only E. coli comparison"
      style={{
        height: 'min(70vw, 43rem)',
        minHeight: '30rem',
        overflow: 'hidden',
        background: 'var(--gx-surface)',
        border: '1px solid var(--brigx-rule-strong)',
      }}
    >
      {publication && <CircularPlot data={publication.plot} imageProperties={publication.imageConfig} />}
      {!publication && !loadFailed && <div className="publication-message h-full">Loading comparison…</div>}
      {loadFailed && <div className="publication-message h-full">Comparison unavailable.</div>}
    </section>
  );
}

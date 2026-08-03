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
      className="landing-preview"
      aria-label="Interactive read-only E. coli comparison"
    >
      {publication && <CircularPlot data={publication.plot} imageProperties={publication.imageConfig} squarePlot />}
      {!publication && !loadFailed && <div className="publication-message h-full">Loading comparison…</div>}
      {loadFailed && <div className="publication-message h-full">Comparison unavailable.</div>}
    </section>
  );
}

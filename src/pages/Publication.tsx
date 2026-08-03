import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CircularPlot from '@/components/CircularPlot';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';
import type { CircularPlotData } from '@/lib/types';

interface PublishedComparison {
  title: string;
  description?: string;
  plot: CircularPlotData;
  imageConfig: ImagePropertiesConfig;
}

export default function PublicationPage() {
  const { slug = '' } = useParams();
  const [publication, setPublication] = useState<PublishedComparison | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setNotFound(true);
      return;
    }
    const controller = new AbortController();
    fetch(`/publications/${slug}.json`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Publication not found');
        return response.json() as Promise<PublishedComparison>;
      })
      .then(setPublication)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setNotFound(true);
      });
    return () => controller.abort();
  }, [slug]);

  if (notFound) {
    return (
      <main className="publication-page publication-message">
        <h1>Publication not found</h1>
        <Link to="/">Return to BRIGX</Link>
      </main>
    );
  }

  if (!publication) return <main className="publication-page publication-message">Loading comparison…</main>;

  return (
    <main className="publication-page">
      <header className="publication-header">
        <div>
          <span className="product-kicker">BRIGX publication</span>
          <h1>{publication.title}</h1>
          {publication.description && <p>{publication.description}</p>}
        </div>
        <Link to="/app" className="gx-btn gx-btn-primary">Open BRIGX</Link>
      </header>
      <section className="publication-viewer" aria-label="Read-only interactive genome comparison">
        <CircularPlot data={publication.plot} imageProperties={publication.imageConfig} />
      </section>
    </main>
  );
}

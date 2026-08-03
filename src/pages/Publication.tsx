import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ResultViewer from '@/components/ResultViewer';
import { parseResultSnapshot, type ResultSnapshot } from '@/lib/resultSnapshot';

export default function PublicationPage() {
  const { slug = '' } = useParams();
  const [publication, setPublication] = useState<ResultSnapshot | null>(null);
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
        return response.json() as Promise<unknown>;
      })
      .then(value => setPublication(parseResultSnapshot(value)))
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

  return <ResultViewer snapshot={publication} mode="publication" />;
}

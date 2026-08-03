import { Link } from 'react-router-dom';
import BRIGXFigure from '@/components/BRIGXFigure';
import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';

export default function LandingPage() {
  return (
    <div className="product-page">
      <ProductNav />
      <main>
        <section className="product-hero product-width" aria-labelledby="product-title">
          <div className="product-hero-copy">
            <h1 id="product-title">Circular genome comparison for microbial genomics</h1>
            <p className="product-lede">
              BRIGX is a modern implementation of{' '}
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/" target="_blank" rel="noopener noreferrer">BRIG</a>,
              {' '}providing interactive circular genome comparisons in the browser with publication-ready SVG and PNG export.
            </p>
            <div className="product-actions">
              <Link to="/app" className="gx-btn gx-btn-primary">Open the web app</Link>
            </div>
          </div>
          <BRIGXFigure />
        </section>
      </main>
      <ProductFooter />
    </div>
  );
}

import { Link } from 'react-router-dom';
import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';

export default function DownloadPage() {
  return (
    <div className="product-page">
      <ProductNav />
      <main className="product-width product-document">
        <header className="product-document-header">
          <p className="product-kicker">Desktop edition</p>
          <h1>Coming soon</h1>
          <p>
            BRIGX is currently focused on the web application. There is no supported desktop download at this time.
          </p>
          <div className="product-actions">
            <Link to="/app" className="gx-btn gx-btn-primary">Open the web app</Link>
          </div>
        </header>
      </main>
      <ProductFooter />
    </div>
  );
}

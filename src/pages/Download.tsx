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
            A desktop version is possible, but distributing it properly requires paid code signing. Apple charges
            US$99 a year, while Windows signing typically costs around US$10 a month. For now, we’re focusing on the
            web version.
          </p>
        </header>
      </main>
      <ProductFooter />
    </div>
  );
}

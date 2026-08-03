import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';

export default function DownloadPage() {
  return (
    <div className="product-page">
      <ProductNav />
      <main className="product-width product-document">
        <header className="product-document-header">
          <h1>Coming soon</h1>
          <p>
            A desktop version is possible, but applications need to be signed before we can distribute them properly.
            Apple charges US$99 a year, and Windows signing costs about US$10 a month.
          </p>
        </header>
      </main>
      <ProductFooter />
    </div>
  );
}

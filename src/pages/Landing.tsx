import { Link } from 'react-router-dom';
import BRIGXFigure from '@/components/BRIGXFigure';
import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';

const workflow = [
  ['01', 'Load', 'Choose a FASTA or GenBank reference and the genomes you want to compare.'],
  ['02', 'Compare', 'Run the bundled BLAST WebAssembly engine locally, using parallel workers.'],
  ['03', 'Annotate', 'Add GenBank, GFF3, BED, graph, coverage, or hand-edited annotation tracks.'],
  ['04', 'Export', 'Fine-tune the figure, then export editable SVG, PNG, or a reusable project.'],
];

export default function LandingPage() {
  return (
    <div className="product-page">
      <ProductNav />
      <main>
        <section className="product-hero product-width" aria-labelledby="product-title">
          <div className="product-hero-copy">
            <p className="product-kicker">Free · local-first · open source</p>
            <h1 id="product-title">Circular genome comparison without uploading your data.</h1>
            <p className="product-lede">
              BRIGX turns whole-genome BLAST comparisons into precise, publication-ready circular maps.
              Use it immediately in the browser or install the offline desktop beta.
            </p>
            <div className="product-actions">
              <Link to="/app" className="gx-btn gx-btn-primary">Open the web app</Link>
              <Link to="/download" className="gx-btn gx-btn-secondary">Get the desktop beta</Link>
            </div>
            <dl className="product-facts">
              <div><dt>Analysis</dt><dd>BLAST 2.2.26 · WebAssembly</dd></div>
              <div><dt>Data</dt><dd>Remains on your device</dd></div>
              <div><dt>Output</dt><dd>Interactive view · SVG · PNG</dd></div>
            </dl>
          </div>
          <BRIGXFigure />
        </section>

        <section className="product-workflow" aria-labelledby="workflow-title">
          <div className="product-width">
            <p className="product-kicker">The workflow</p>
            <h2 id="workflow-title">From sequence files to an editable figure.</h2>
            <ol>
              {workflow.map(([number, title, description]) => (
                <li key={number}>
                  <span className="product-step-number">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="product-section product-width" aria-labelledby="choose-title">
          <div className="product-section-intro">
            <p className="product-kicker">Choose your edition</p>
            <h2 id="choose-title">One scientific engine. Two ways to work.</h2>
            <p>The browser and desktop editions use the same renderer and integrity-checked BLAST WebAssembly pipeline.</p>
          </div>
          <div className="product-table-wrap">
            <table className="product-comparison">
              <thead><tr><th scope="col">Capability</th><th scope="col">Web</th><th scope="col">Desktop beta</th></tr></thead>
              <tbody>
                <tr><th scope="row">Start</th><td data-edition="Web">Open instantly</td><td data-edition="Desktop beta">Install once</td></tr>
                <tr><th scope="row">Analysis data</th><td data-edition="Web">Stays in the browser</td><td data-edition="Desktop beta">Stays on the computer</td></tr>
                <tr><th scope="row">Projects</th><td data-edition="Web">Portable session files</td><td data-edition="Desktop beta">Native <code>.brigx</code> projects and recovery</td></tr>
                <tr><th scope="row">Network</th><td data-edition="Web">Needed to load the application</td><td data-edition="Desktop beta">Not needed after installation</td></tr>
                <tr><th scope="row">Updates</th><td data-edition="Web">Automatic with the website</td><td data-edition="Desktop beta">Manual during beta</td></tr>
                <tr><th scope="row">Recommended for</th><td data-edition="Web">Most users</td><td data-edition="Desktop beta">Offline and project-based work</td></tr>
              </tbody>
            </table>
          </div>
          <div className="product-section-actions">
            <Link to="/app" className="product-text-link">Open BRIGX on the web <span aria-hidden="true">→</span></Link>
            <Link to="/download" className="product-text-link">Read about the desktop beta <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="product-proof" aria-labelledby="local-title">
          <div className="product-width product-proof-grid">
            <div>
              <p className="product-kicker">Local by construction</p>
              <h2 id="local-title">Your sequences are not sent to an analysis server.</h2>
            </div>
            <div>
              <p>
                BLAST runs in Web Workers using bundled WebAssembly. Rendering, annotation editing, and export also happen on your device.
                There are no accounts, cloud storage, advertising, analytics, or telemetry in this release.
              </p>
              <Link to="/about" className="product-text-link">Read the privacy, licence, and provenance record <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="product-section product-width product-origin" aria-labelledby="origin-title">
          <p className="product-kicker">The BRIG lineage</p>
          <h2 id="origin-title">A modern successor to BLAST Ring Image Generator.</h2>
          <p>
            BRIGX carries the familiar comparative-genomics workflow into a local-first web and desktop application.
            Its circular renderer and annotation table are first-party implementations; CGView.js is neither embedded nor copied.
          </p>
          <a className="product-text-link" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/" target="_blank" rel="noopener noreferrer">
            Read the original BRIG paper <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
      <ProductFooter />
    </div>
  );
}

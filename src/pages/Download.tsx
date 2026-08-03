import { Link } from 'react-router-dom';
import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';
import { APP_VERSION } from '@/lib/version';

const releaseTag = `desktop-beta-v${APP_VERSION}`;
const releaseBase = `https://github.com/happykhan/brigx/releases/download/${releaseTag}`;
const releasePage = `https://github.com/happykhan/brigx/releases/tag/${releaseTag}`;

const downloads = [
  {
    platform: 'Windows',
    detail: 'x64 installer',
    requirement: 'Windows 10 or later',
    file: `BRIGX_${APP_VERSION}_x64-setup.exe`,
  },
  {
    platform: 'Linux',
    detail: 'x64 AppImage',
    requirement: 'Portable package',
    file: `BRIGX_${APP_VERSION}_amd64.AppImage`,
  },
];

export default function DownloadPage() {
  return (
    <div className="product-page">
      <ProductNav />
      <main className="product-width product-document">
        <header className="product-document-header">
          <p className="product-kicker">Desktop edition · v{APP_VERSION}</p>
          <h1>BRIGX Desktop Beta</h1>
          <p>
            A small, offline Tauri application using the operating system webview and the same BRIGX WebAssembly pipeline as the web edition.
          </p>
          <div className="beta-notice" role="note">
            <strong>Unsigned community build.</strong> Windows may show a publisher warning. macOS downloads are paused until Developer ID signing and Apple notarisation are configured.
          </div>
        </header>

        <section aria-labelledby="download-title">
          <div className="product-heading-row">
            <h2 id="download-title">Downloads</h2>
            <a href={releasePage} target="_blank" rel="noopener noreferrer">View the complete GitHub prerelease ↗</a>
          </div>
          <div className="download-list">
            {downloads.map(download => (
              <article key={download.file} className="download-row">
                <div>
                  <h3>{download.platform} <span>{download.detail}</span></h3>
                  <p>{download.requirement} · {download.file}</p>
                </div>
                <a className="gx-btn gx-btn-primary" href={`${releaseBase}/${download.file}`}>Download</a>
              </article>
            ))}
          </div>
          <div className="macos-release-hold" role="note">
            <div>
              <h3>macOS</h3>
              <p>Not currently distributed</p>
            </div>
            <p>
              Unsigned applications downloaded through a browser are rejected by Gatekeeper as damaged. We will publish
              Apple silicon and Intel builds after they are signed and notarised. Until then, use the web edition.
            </p>
            <Link to="/app" className="product-text-link">Open the web app <span aria-hidden="true">→</span></Link>
          </div>
          <p className="download-alternatives">
            Linux users can also get <a href={`${releaseBase}/BRIGX_${APP_VERSION}_amd64.deb`}>DEB</a> or{' '}
            <a href={`${releaseBase}/BRIGX-${APP_VERSION}-1.x86_64.rpm`}>RPM</a> packages.{' '}
            <a href={`${releaseBase}/SHA256SUMS.txt`}>SHA-256 checksums</a> are published with every beta.
          </p>
        </section>

        <section className="install-notes" aria-labelledby="install-title">
          <h2 id="install-title">Installation notes</h2>
          <div>
            <article>
              <h3>Windows</h3>
              <ol>
                <li>Run the downloaded installer.</li>
                <li>If Microsoft Defender SmartScreen appears, choose <strong>More info</strong>.</li>
                <li>Confirm that the application name is BRIGX, then choose <strong>Run anyway</strong>.</li>
              </ol>
            </article>
            <article>
              <h3>Linux</h3>
              <ol>
                <li>Install the DEB or RPM with your package manager, or make the AppImage executable.</li>
                <li>The system WebKitGTK runtime and ordinary distribution dependencies are required.</li>
              </ol>
            </article>
          </div>
        </section>

        <section className="product-document-section" aria-labelledby="beta-title">
          <h2 id="beta-title">What Beta means</h2>
          <p>
            The desktop scientific workflow is tested with real Tauri, BLAST, project round-trip, recovery, and export tests on every supported platform. Beta refers to unsigned distribution and the possibility of desktop-specific interface changes—not a reduced analysis engine.
          </p>
          <ul>
            <li>No accounts, subscriptions, telemetry, automatic updates, or cloud services.</li>
            <li>Projects reference source files on your computer; they do not duplicate genome contents.</li>
            <li>Updates are installed manually from this page during beta.</li>
            <li>Packages and source are released under GPL-3.0 with third-party notices.</li>
          </ul>
          <p>If you prefer not to install an unsigned Windows application, or you use macOS, <Link to="/app">use the web edition</Link>.</p>
        </section>
      </main>
      <ProductFooter />
    </div>
  );
}

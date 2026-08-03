import { Link } from 'react-router-dom';
import { NavBar, AppFooter } from '@genomicx/ui';
import { APP_VERSION } from '@/lib/version';

const linkStyle = { color: 'var(--gx-accent)', textDecoration: 'underline' };

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{children}</a>;
}

export default function AboutPage() {
  const desktop = typeof window === 'undefined' ? undefined : window.brigxDesktop;
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gx-bg)' }}>
      <NavBar appName="BRIGX" appSubtitle={desktop ? 'Offline Desktop Ring Image Generator' : 'Browser-based Ring Image Generator'} version={APP_VERSION} />

      <main className="flex-grow py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card">
            <h1 className="text-4xl font-bold mb-8" style={{ letterSpacing: '-0.025em' }}>About BRIGX</h1>

            <div className="max-w-none">
              <h2 className="text-2xl font-semibold mt-6 mb-4">Overview</h2>
              <p className="mb-4">
                BRIGX (BLAST Ring Image Generator eXtended) is a free, open-source comparative genomics tool
                available for the web and as an offline desktop application.
                It creates interactive circular genome comparison plots inspired by the original BRIG application,
                with publication-ready SVG and PNG export.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Data handling and privacy</h2>
              <p className="mb-4">
                Genome and annotation files are processed locally {desktop ? 'on this computer' : 'in your browser'}.
                BRIGX does not upload file contents to an analysis server. This release contains no accounts,
                cloud storage, advertising, telemetry, or analytics.
              </p>
              {desktop ? (
                <p className="mb-4">
                  Desktop project files store settings, completed plot data, SHA-256 checksums, and local paths to
                  source files; they do not copy genome contents into the project. Treat a <code>.brigx</code> file as
                  potentially sensitive because its paths and filenames may reveal information about your computer
                  or work. Recovery snapshots stay in BRIGX&apos;s local application-data directory.
                </p>
              ) : (
                <p className="mb-4">
                  As with any website, the hosting provider may receive ordinary request metadata such as IP address,
                  browser information, requested asset, and time of access.
                </p>
              )}

              <h2 className="text-2xl font-semibold mt-8 mb-4">Open-source licence and commercial use</h2>
              <p className="mb-4">
                BRIGX is released under the{' '}
                <ExternalLink href="https://github.com/happykhan/brigx/blob/master/LICENSE">GNU General Public License v3.0</ExternalLink>.
                The GPL permits commercial use, including paid hosting and support, while preserving recipients&apos;
                rights under the licence. Distribution of modified software must comply with the GPL source and
                notice requirements. This summary is informational and is not legal advice.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Third-party software</h2>
              <p className="mb-4">
                BRIGX depends on the following software at runtime. Links lead to the project or authoritative
                licence information. The repository&apos;s{' '}
                <ExternalLink href="https://github.com/happykhan/brigx/blob/master/THIRD_PARTY_NOTICES.md">complete third-party notice</ExternalLink>{' '}
                records versions, bundled assets, hashes, and development-tool categories.
              </p>

              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Software</th>
                      <th className="text-left p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Purpose</th>
                      <th className="text-left p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Licence</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://blast.ncbi.nlm.nih.gov/Blast.cgi">NCBI BLAST Legacy</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Sequence alignment</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://blast.ncbi.nlm.nih.gov/doc/blast-help/developerinfo.html">US public domain</ExternalLink></td>
                    </tr>
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://emscripten.org/">Emscripten</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>BLAST WebAssembly runtime</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://emscripten.org/docs/introducing_emscripten/emscripten_license.html">MIT/NCSA</ExternalLink></td>
                    </tr>
                    {desktop && (
                      <tr>
                        <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>
                          <ExternalLink href="https://tauri.app/">Tauri {desktop.versions.tauri}</ExternalLink>
                          {' '}with {desktop.versions.webview}
                        </td>
                        <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Desktop application runtime</td>
                        <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>
                          <ExternalLink href="https://github.com/tauri-apps/tauri#license">MIT or Apache-2.0; system-webview terms</ExternalLink>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://react.dev/">React and React DOM</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>User interface</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>MIT</td>
                    </tr>
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://reactrouter.com/">React Router</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Client-side navigation</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>MIT</td>
                    </tr>
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://github.com/happykhan/genomicx-ui">GenomicX UI</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Shared interface components</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>GPL-3.0</td>
                    </tr>
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://github.com/nodeca/pako">pako</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Reading compressed inputs</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>MIT and Zlib</td>
                    </tr>
                    <tr>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}><ExternalLink href="https://react-hot-toast.com/">react-hot-toast</ExternalLink></td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>Status notifications</td>
                      <td className="p-2 border" style={{ borderColor: 'var(--gx-border)' }}>MIT</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mb-4">
                CGView.js, Handsontable, and LAST are not included in this release, and no CGView.js source is copied.
                BRIGX&apos;s circular renderer and editable annotation table are first-party implementations; alignment
                uses the bundled BLAST WebAssembly modules listed above. Desktop packages also include the full
                licence texts for their locked Rust dependencies.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Example data</h2>
              <p className="mb-4">
                Repository test fixtures include static snapshots of public NCBI records and the original BRIG
                example set. They are used for regression testing and are not loaded by the hosted application.
                Accession and provenance details are listed in the{' '}
                <ExternalLink href="https://github.com/happykhan/brigx/blob/master/examples/README.md">example-data notice</ExternalLink>.
                Check the current source record before using a bundled snapshot for research.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Attribution and trademarks</h2>
              <p className="mb-4">
                BLAST is a registered trademark of the US National Library of Medicine. BRIGX is an independent
                project and is not affiliated with or endorsed by NCBI, NLM, or NIH. Third-party names and marks
                remain the property of their respective owners.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Citation</h2>
              <p className="mb-4">If you use BRIGX in research, please cite the original BRIG paper:</p>
              <blockquote className="pl-4 italic mb-4" style={{ borderLeft: '4px solid var(--gx-accent)', color: 'var(--gx-text-muted)' }}>
                Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011) BLAST Ring Image Generator (BRIG):
                simple prokaryote genome comparisons. BMC Genomics 12:402.{' '}
                <ExternalLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/">Read the paper</ExternalLink>
              </blockquote>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Developer and support</h2>
              <p className="mb-4">
                BRIGX is developed by <ExternalLink href="https://github.com/happykhan">Nabil-Fareed Alikhan</ExternalLink>.
                Source code, issue reporting, and contribution guidance are available on{' '}
                <ExternalLink href="https://github.com/happykhan/brigx">GitHub</ExternalLink>.
              </p>

              <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--gx-border)' }}>
                <Link to="/" className="inline-flex items-center font-medium transition-colors" style={{ color: 'var(--gx-accent)' }}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Application
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter appName="BRIGX" bugReportEmail="nabil@happykhan.com" bugReportUrl="https://github.com/happykhan/brigx/issues" />
    </div>
  );
}

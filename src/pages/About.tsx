import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';

const linkStyle = { color: 'var(--gx-accent)', textDecoration: 'underline' };

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{children}</a>;
}

export default function AboutPage() {
  return (
    <div className="product-page">
      <ProductNav />

      <main className="product-width product-document">
        <article className="legal-record">
            <header className="product-document-header"><h1>About BRIGX</h1></header>

            <div className="max-w-none">
              <p className="mb-4">
                BRIGX (BLAST Ring Image Generator eXtended) is a free, open-source comparative genomics tool
                that runs in the web browser.
                It creates interactive circular genome comparison plots inspired by the original BRIG application,
                with publication-ready SVG and PNG export.
              </p>

              <p className="mb-4">
                BRIGX is developed by <ExternalLink href="https://github.com/happykhan">Nabil-Fareed Alikhan</ExternalLink>.
                Source code, issue reporting and contribution guidance are available on{' '}
                <ExternalLink href="https://github.com/happykhan/brigx">GitHub</ExternalLink>.
              </p>

              <p className="mb-4">
                Genome and annotation files are processed locally in your browser.
                BRIGX does not upload file contents to an analysis server. This release contains no accounts,
                cloud storage, advertising, telemetry or analytics.
              </p>
              <p className="mb-4">
                As with any website, the hosting provider may receive ordinary request metadata such as your IP address,
                browser information, requested asset and time of access.
              </p>

              <p className="mb-4">
                BRIGX is released under the{' '}
                <ExternalLink href="https://github.com/happykhan/brigx/blob/master/LICENSE">GNU General Public License v3.0</ExternalLink>.
                The GPL permits commercial use, including paid hosting and support, while preserving recipients&apos;
                rights under the licence. Distribution of modified software must comply with the GPL source and
                notice requirements. This summary is informational and is not legal advice.
              </p>

              <p className="mb-4">
                BRIGX depends on the following software at runtime. The repository&apos;s{' '}
                <ExternalLink href="https://github.com/happykhan/brigx/blob/master/THIRD_PARTY_NOTICES.md">complete third-party notice</ExternalLink>{' '}
                records versions, bundled assets, hashes and development-tool categories.
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
                BRIGX&apos;s circular renderer and editable annotation table are original BRIGX implementations. Alignment
                uses the bundled BLAST WebAssembly modules listed above.
              </p>

              <p className="mb-4">
                BRIGX was developed in my own time, and I cover the costs of hosting this server. So, in a way there is a conflict of interest because the funders (me) had a major role in the design and development of this work.
              </p>
              
              <p className="mb-4">
                A desktop version is possible, but applications need to be signed before we can distribute them properly.
                Apple charges US$99 a year, and Windows signing costs about US$10 a month.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Citation</h2>
              <p className="mb-4">If you use BRIGX in research, please cite the original BRIG paper:</p>
              <blockquote className="pl-4 italic mb-4" style={{ borderLeft: '4px solid var(--gx-accent)', color: 'var(--gx-text-muted)' }}>
                Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011). BLAST Ring Image Generator (BRIG):
                simple prokaryote genome comparisons. BMC Genomics 12:402.{' '}
                <ExternalLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/">Read the paper</ExternalLink>
              </blockquote>
            </div>
        </article>
      </main>

      <ProductFooter />
    </div>
  );
}

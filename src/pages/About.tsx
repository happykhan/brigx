

import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gx-bg)' }}>
      {/* Navigation - Frosted Glass */}
      <nav className="sticky top-0 z-40" style={{ background: 'var(--gx-nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--gx-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[60px]">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="var(--gx-accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              <div>
                <h1 className="text-lg font-bold" style={{ color: 'var(--gx-text)' }}>BRIGX</h1>
                <p className="text-xs" style={{ color: 'var(--gx-text-muted)' }}>BLAST Ring Image Generator</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-sm font-medium transition-colors hover:text-[var(--gx-accent)]" style={{ color: 'var(--gx-text-muted)' }}>
                App
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card">
            <h1 className="text-4xl font-bold mb-8" style={{ color: 'var(--gx-text)', letterSpacing: '-0.025em' }}>About BRIGX</h1>

            <div className="max-w-none">
              <h2 className="text-2xl font-semibold mt-6 mb-4" style={{ color: 'var(--gx-text)' }}>Overview</h2>
              <p className="mb-4" style={{ color: 'var(--gx-text)' }}>
                BRIGX (BLAST Ring Image Generator eXtended) is a web-based tool for comparative genomics visualization.
                It creates circular genome comparison plots similar to the original BRIG tool, but runs entirely in your browser
                using WebAssembly technology.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4" style={{ color: 'var(--gx-text)' }}>Features</h2>
              <ul className="list-disc pl-6 space-y-2 mb-4" style={{ color: 'var(--gx-text)' }}>
                <li>Compare multiple genome sequences against a reference genome</li>
                <li>Interactive circular visualization with multiple rings</li>
                <li>GC content and GC skew analysis</li>
                <li>Configurable alignment parameters</li>
                <li>Export results as SVG or PNG</li>
                <li>Download alignment results for each ring</li>
                <li>All processing happens locally in your browser</li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4" style={{ color: 'var(--gx-text)' }}>How It Works</h2>
              <p className="mb-4" style={{ color: 'var(--gx-text)' }}>
                BRIGX uses BLAST (Basic Local Alignment Search Tool), compiled to WebAssembly. This allows
                sophisticated bioinformatics analysis to run directly in your web browser without requiring any
                server-side processing or data upload.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4" style={{ color: 'var(--gx-text)' }}>Privacy</h2>
              <p className="mb-4" style={{ color: 'var(--gx-text)' }}>
                All processing happens locally in your browser using WebAssembly. Your genome data never leaves
                your computer, ensuring complete privacy and security of your research data.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4" style={{ color: 'var(--gx-text)' }}>Technology Stack</h2>
              <ul className="list-disc pl-6 space-y-2 mb-4" style={{ color: 'var(--gx-text)' }}>
                <li><strong style={{ color: 'var(--gx-text)' }}>BLAST:</strong> Sequence alignment (formatdb + blastn)</li>
                <li><strong style={{ color: 'var(--gx-text)' }}>WebAssembly:</strong> High-performance browser execution</li>
                <li><strong style={{ color: 'var(--gx-text)' }}>Next.js:</strong> React framework for the user interface</li>
                <li><strong style={{ color: 'var(--gx-text)' }}>Web Workers:</strong> Parallel processing for faster alignments</li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4" style={{ color: 'var(--gx-text)' }}>Citation</h2>
              <p className="mb-4" style={{ color: 'var(--gx-text)' }}>
                If you use BRIGX in your research, please cite the original BRIG paper:
              </p>
              <blockquote className="pl-4 italic mb-4" style={{ borderLeft: '4px solid var(--gx-accent)', color: 'var(--gx-text-muted)' }}>
                Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011) BLAST Ring Image Generator (BRIG):
                simple prokaryote genome comparisons. BMC Genomics 12:402.
                {' '}
                <a
                  href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3163573/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--gx-accent)', textDecoration: 'underline' }}
                >
                  Read the paper
                </a>
              </blockquote>

              <h2 className="text-2xl font-semibold mt-8 mb-4" style={{ color: 'var(--gx-text)' }}>Contributing</h2>
              <p className="mb-4" style={{ color: 'var(--gx-text)' }}>
                BRIGX is an open-source project. You can contribute to the project on{' '}
                <a
                  href="https://github.com/happykhan/brigx"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--gx-accent)', textDecoration: 'underline' }}
                >
                  GitHub
                </a>.
              </p>

              <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--gx-border)' }}>
                <Link
                  to="/"
                  className="inline-flex items-center font-medium transition-colors"
                  style={{ color: 'var(--gx-accent)' }}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Application
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8" style={{ background: 'var(--gx-bg-alt)', borderTop: '1px solid var(--gx-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm mb-4 md:mb-0" style={{ color: 'var(--gx-text-muted)' }}>
              BRIGX. Built with Vite and WebAssembly.
            </div>
            <div className="flex gap-6 text-sm">
              <a href="https://genomicx.org" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--gx-accent)]" style={{ color: 'var(--gx-text-muted)' }}>
                genomicx.org
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

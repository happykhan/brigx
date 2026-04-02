interface AppFooterProps {
  onReportBug?: () => void;
}

export default function AppFooter({ onReportBug }: AppFooterProps) {
  return (
    <footer className="mt-auto py-6" style={{ borderTop: '1px solid var(--gx-border)', background: 'var(--gx-bg-alt)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm mb-4 md:mb-0" style={{ color: 'var(--gx-text-muted)' }}>
            <p className="font-semibold" style={{ color: 'var(--gx-text)' }}>BRIGX — Powered by BLAST &amp; WebAssembly</p>
            <p className="mt-1">All processing runs locally in your browser — no data leaves your computer</p>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="https://genomicx.org" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--gx-accent)]" style={{ color: 'var(--gx-text-muted)' }}>
              genomicx.org
            </a>
            {onReportBug && (
              <button onClick={onReportBug} className="transition-colors hover:text-[var(--gx-accent)]" style={{ color: 'var(--gx-text-muted)' }}>
                Report Bug
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

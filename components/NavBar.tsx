

import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import { APP_VERSION } from '@/lib/version';

interface NavBarProps {
  onSaveSession: () => void;
  onLoadSession: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function NavBar({ onSaveSession, onLoadSession }: NavBarProps) {
  return (
    <nav className="sticky top-0 z-40" style={{ background: 'var(--gx-nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--gx-border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[60px]">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="var(--gx-accent)" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1" fill="var(--gx-accent)" />
            </svg>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--gx-text)' }}>BRIGX <span className="text-xs font-normal" style={{ color: 'var(--gx-text-muted)' }}>v{APP_VERSION}</span></h1>
              <p className="text-xs" style={{ color: 'var(--gx-text-muted)' }}>Browser-based Ring Image Generator</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={onSaveSession} className="btn-secondary text-xs px-3 py-1" title="Save current session (rings, annotations, settings) as JSON">
              Save Session
            </button>
            <label className="btn-secondary text-xs px-3 py-1 cursor-pointer" title="Load a previously saved session from JSON file">
              Load Session
              <input type="file" accept=".json" onChange={onLoadSession} className="hidden" />
            </label>
            <Link to="/about" className="text-sm font-medium hover:text-gx-accent transition-colors" style={{ color: 'var(--gx-text-muted)' }}>
              About
            </Link>
            <a href="https://github.com/happykhan/brigx" target="_blank" rel="noopener" className="text-sm font-medium hover:text-gx-accent transition-colors" style={{ color: 'var(--gx-text-muted)' }}>
              GitHub
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

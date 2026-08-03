import type { DesktopRecentProject } from '@/desktop/contracts';

interface DesktopProjectBarProps {
  projectName: string | null;
  recentProjects: readonly DesktopRecentProject[];
  hasRecovery: boolean;
  isSaving: boolean;
  isDirty: boolean;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (id: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRecover: () => void;
}

const buttonClass = 'text-sm px-3 py-2.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed';
const mutedStyle = { color: 'var(--gx-text-muted)' };

export default function DesktopProjectBar({
  projectName,
  recentProjects,
  hasRecovery,
  isSaving,
  isDirty,
  onNew,
  onOpen,
  onOpenRecent,
  onSave,
  onSaveAs,
  onRecover,
}: DesktopProjectBarProps) {
  return (
    <nav
      aria-label="Desktop project controls"
      style={{ background: 'var(--gx-bg-alt)', borderBottom: '1px solid var(--gx-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto">
        <button type="button" onClick={onNew} className={buttonClass} style={mutedStyle}>
          New Project
        </button>
        <button type="button" onClick={onOpen} className={buttonClass} style={mutedStyle}>
          Open Project
        </button>
        <select
          aria-label="Open recent project"
          value=""
          onChange={event => {
            if (event.target.value) onOpenRecent(event.target.value);
          }}
          disabled={recentProjects.length === 0}
          className="text-sm px-2 py-1.5 rounded shrink-0 disabled:opacity-50"
          style={{
            color: 'var(--gx-text-muted)',
            background: 'var(--gx-surface)',
            border: '1px solid var(--gx-border)',
          }}
        >
          <option value="">Recent projects</option>
          {recentProjects.map(project => (
            <option key={project.id} value={project.id}>{project.displayName}</option>
          ))}
        </select>
        <button type="button" onClick={onSave} disabled={isSaving} className={buttonClass} style={mutedStyle}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onSaveAs} disabled={isSaving} className={buttonClass} style={mutedStyle}>
          Save As…
        </button>
        {hasRecovery && (
          <button
            type="button"
            onClick={onRecover}
            className={buttonClass}
            style={{ color: 'var(--gx-accent)' }}
            title="Restore the locally autosaved recovery snapshot"
          >
            Recover autosave
          </button>
        )}
        <div className="ml-auto text-xs px-3 py-2.5 whitespace-nowrap" style={mutedStyle} aria-live="polite">
          <span data-testid="desktop-project-name">{projectName ?? 'Unsaved project'}</span>
          {isDirty && <span aria-label="unsaved changes"> • Unsaved changes</span>}
        </div>
      </div>
    </nav>
  );
}

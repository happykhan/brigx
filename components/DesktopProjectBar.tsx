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

const buttonClass = 'desktop-toolbar-button disabled:opacity-50 disabled:cursor-not-allowed';

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
    <header className="desktop-toolbar">
      <div className="desktop-toolbar-brand">
        <span className="desktop-toolbar-mark" aria-hidden="true"><i /><i /><i /></span>
        <h1>BRIGX</h1>
        <span className="desktop-beta-label">Beta</span>
      </div>
      <nav aria-label="Desktop project controls" className="desktop-toolbar-actions">
        <button type="button" onClick={onNew} className={buttonClass}>
          New Project
        </button>
        <button type="button" onClick={onOpen} className={buttonClass}>
          Open Project
        </button>
        <select
          aria-label="Open recent project"
          value=""
          onChange={event => {
            if (event.target.value) onOpenRecent(event.target.value);
          }}
          disabled={recentProjects.length === 0}
          className="desktop-recent-select disabled:opacity-50"
        >
          <option value="">Recent projects</option>
          {recentProjects.map(project => (
            <option key={project.id} value={project.id}>{project.displayName}</option>
          ))}
        </select>
        <span className="desktop-toolbar-separator" aria-hidden="true" />
        <button type="button" onClick={onSave} disabled={isSaving} className={buttonClass}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onSaveAs} disabled={isSaving} className={buttonClass}>
          Save As…
        </button>
        {hasRecovery && (
          <button
            type="button"
            onClick={onRecover}
            className={`${buttonClass} desktop-recovery-button`}
            title="Restore the locally autosaved recovery snapshot"
          >
            Recover autosave
          </button>
        )}
      </nav>
      <div className="desktop-project-title" aria-live="polite">
          <span data-testid="desktop-project-name">{projectName ?? 'Unsaved project'}</span>
          {isDirty && <span aria-label="unsaved changes"> — Modified</span>}
      </div>
    </header>
  );
}

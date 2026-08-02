

interface BugReportModalProps {
  onClose: () => void;
}

export default function BugReportModal({ onClose }: BugReportModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }} onClick={onClose}>
      <div className="rounded-lg max-w-md w-full p-6" style={{ background: 'var(--gx-bg-alt)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--gx-text)' }}>Report a Bug</h3>
          <button onClick={onClose} style={{ color: 'var(--gx-text-muted)' }}>&times;</button>
        </div>
        <div className="space-y-3 text-sm" style={{ color: 'var(--gx-text)' }}>
          <p>To report a bug, please email the following to:</p>
          <p className="font-mono font-bold" style={{ color: 'var(--gx-accent)' }}>
            <a href="mailto:nabil@happykhan.com">nabil@happykhan.com</a>
          </p>
          <div className="space-y-2 p-3 rounded" style={{ background: 'var(--gx-surface)' }}>
            <p className="font-semibold">Please include:</p>
            <ol className="list-decimal pl-5 space-y-1" style={{ color: 'var(--gx-text-muted)' }}>
              <li>A description of what happened and what you expected</li>
              <li>A minimised or synthetic reproducer, if the problem depends on input data</li>
              <li>A saved session or project containing only safe test data, if relevant</li>
              <li>Debug console output (copy from the Debug Console panel)</li>
              <li>Browser name and version</li>
            </ol>
          </div>
          <p className="text-xs" style={{ color: 'var(--gx-text-muted)' }}>
            Never email confidential, embargoed, patient-identifiable, or otherwise sensitive genome data.{' '}
            You can also open an issue on <a href="https://github.com/happykhan/brigx/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gx-accent)', textDecoration: 'underline' }}>GitHub</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

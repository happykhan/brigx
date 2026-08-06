interface BugReportModalProps {
  onClose: () => void;
}

const REPORT_EMAIL = 'nabil@happykhan.com';

export default function BugReportModal({ onClose }: BugReportModalProps) {
  const reportTemplate = [
    'Hello,',
    '',
    'What happened?',
    '',
    'What did you expect?',
    '',
    'Steps to reproduce:',
    '',
    `BRIGX page: ${window.location.href}`,
    'Browser and operating system:',
    'Relevant error message:',
  ].join('\n');
  const emailHref = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent('BRIGX bug report')}&body=${encodeURIComponent(reportTemplate)}`;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="bug-report-title" className="rounded-lg max-w-lg w-full p-6" style={{ background: 'var(--gx-bg-alt)' }} onClick={event => event.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="bug-report-title" className="text-xl font-semibold">Report a bug</h2>
          <button type="button" onClick={onClose} aria-label="Close bug report">×</button>
        </div>

        <p>
          Email <a className="underline" href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a> and include:
        </p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>what happened and what you expected;</li>
          <li>the steps needed to reproduce the problem;</li>
          <li>the error message and a screenshot, if available;</li>
          <li>your browser and operating system.</li>
        </ul>
        <p className="text-sm mt-4" style={{ color: 'var(--gx-text-muted)' }}>
          Do not include confidential, patient-identifiable, or raw sequence data.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <a className="btn-primary" href={emailHref}>Email bug report</a>
        </div>
      </div>
    </div>
  );
}

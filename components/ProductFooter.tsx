import { AppFooter } from '@genomicx/ui';

export const BUG_REPORT_ITEMS = [
  'A description of what happened and what you expected',
  'A minimised or synthetic reproducer, if needed — never send confidential or patient-identifiable genome data',
  'A saved session containing only safe test data, if relevant',
  'Debug console output',
  'Your browser and BRIGX version',
];

export default function ProductFooter() {
  return (
    <AppFooter
      appName="BRIGX"
      bugReportEmail="nabil@happykhan.com"
      bugReportUrl="https://github.com/happykhan/brigx/issues"
      bugReportItems={BUG_REPORT_ITEMS}
    />
  );
}

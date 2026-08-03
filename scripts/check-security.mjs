/* global console, process */
import { execFileSync } from 'node:child_process';

const acceptedAdvisories = new Map([
  [1124282, 'React Router RSC-only CSRF advisory; BRIGX is a static browser SPA with no actions, server rendering, or RSC endpoints.'],
]);

let report;
try {
  const output = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8' });
  report = JSON.parse(output);
} catch (error) {
  if (!error.stdout) throw error;
  report = JSON.parse(String(error.stdout));
}

const unaccepted = [];
const accepted = [];

for (const vulnerability of Object.values(report.vulnerabilities || {})) {
  for (const advisory of vulnerability.via || []) {
    if (typeof advisory === 'string') continue;
    const rationale = acceptedAdvisories.get(advisory.source);
    if (rationale) accepted.push(`${advisory.source}: ${rationale}`);
    else unaccepted.push(`${advisory.source}: ${advisory.title}`);
  }
}

if (unaccepted.length > 0) {
  console.error(`Unaccepted production advisories:\n${unaccepted.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

if (accepted.length > 0) {
  console.warn(`Accepted non-applicable advisories:\n${[...new Set(accepted)].map(item => `- ${item}`).join('\n')}`);
}

console.log('Runtime and build dependency audit passed.');

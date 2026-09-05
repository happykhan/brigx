/* global console, process */
import { delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.platform === 'win32') {
  console.log('CI portability check skipped on Windows; GitHub CI runs it on Linux.');
  process.exit(0);
}

const systemPath = ['/usr/bin', '/bin'];

try {
  execFileSync('bash', ['scripts/check-architecture.sh'], {
    env: { ...process.env, PATH: systemPath.join(delimiter) },
    stdio: 'inherit',
  });
} catch (error) {
  console.error(
    'CI portability check failed. Quality scripts must use commands available on a clean Ubuntu runner.',
  );
  process.exit(error.status || 1);
}

console.log('CI portability check passed with system commands only.');

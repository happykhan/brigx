/* global console, process */
import { readFileSync } from 'node:fs';

const expectedMajor = Number.parseInt(readFileSync('.nvmrc', 'utf8').trim(), 10);
const actualMajor = Number.parseInt(process.versions.node.split('.')[0], 10);

if (actualMajor !== expectedMajor) {
  console.error(
    `BRIGX requires Node.js ${expectedMajor}.x, but this shell is using ${process.version}. Run \`nvm use\` and try again.`,
  );
  process.exit(1);
}

console.log(`Node.js ${process.version} matches the BRIGX CI runtime.`);

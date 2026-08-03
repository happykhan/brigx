/* global console, process */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tauriRoot = path.join(root, 'src-tauri');
const lock = await readFile(path.join(tauriRoot, 'Cargo.lock'));
const expectedHash = createHash('sha256').update(lock).digest('hex');
const notice = await readFile(
  path.join(tauriRoot, 'resources', 'THIRD_PARTY_LICENSES.html'),
  'utf8',
);
const failures = [];
if (!notice.includes(`name="brigx-cargo-lock-sha256" content="${expectedHash}"`)) {
  failures.push('Rust licence notice is stale; run npm run licences:rust:generate');
}

const acceptedExpressions = new Set([
  '(MIT OR Apache-2.0) AND Unicode-3.0',
  '0BSD OR MIT OR Apache-2.0',
  'Apache-2.0',
  'Apache-2.0 / MIT',
  'Apache-2.0 AND MIT',
  'Apache-2.0 OR MIT',
  'Apache-2.0 WITH LLVM-exception',
  'Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT',
  'Apache-2.0/MIT',
  'BSD-2-Clause OR Apache-2.0 OR MIT',
  'BSD-3-Clause',
  'BSD-3-Clause AND MIT',
  'BSD-3-Clause OR MIT OR Apache-2.0',
  'BSD-3-Clause/MIT',
  'CC0-1.0 OR MIT-0 OR Apache-2.0',
  'ISC',
  'MIT',
  'MIT OR Apache-2.0',
  'MIT OR Apache-2.0 OR LGPL-2.1-or-later',
  'MIT OR Apache-2.0 OR Zlib',
  'MIT OR Zlib OR Apache-2.0',
  'MIT/Apache-2.0',
  'MPL-2.0',
  'Unicode-3.0',
  'Unlicense OR MIT',
  'Unlicense/MIT',
  'Zlib',
  'Zlib OR Apache-2.0 OR MIT',
]);
const metadata = JSON.parse(execFileSync('cargo', [
  'metadata',
  '--manifest-path',
  path.join(tauriRoot, 'Cargo.toml'),
  '--locked',
  '--format-version',
  '1',
], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
}));
const resolved = new Set(metadata.resolve.nodes.map(node => node.id));
for (const crate of metadata.packages) {
  if (!resolved.has(crate.id) || crate.id === metadata.resolve.root) continue;
  if (!crate.license) {
    failures.push(`${crate.name}@${crate.version} has no declared Rust licence`);
  } else if (!acceptedExpressions.has(crate.license)) {
    failures.push(`${crate.name}@${crate.version} has unreviewed Rust licence ${crate.license}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Rust licence policy passed for ${resolved.size - 1} resolved crates.`);

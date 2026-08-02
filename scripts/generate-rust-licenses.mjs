/* global console */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const tauriRoot = path.join(root, 'src-tauri');
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'brigx-licences-'));
const temporaryOutput = path.join(temporaryDirectory, 'THIRD_PARTY_LICENSES.html');

try {
  await exec('cargo', [
    'about',
    'generate',
    '--locked',
    '--fail',
    '--config',
    path.join(tauriRoot, 'about.toml'),
    '--manifest-path',
    path.join(tauriRoot, 'Cargo.toml'),
    '--output-file',
    temporaryOutput,
    path.join(tauriRoot, 'about.hbs'),
  ], { cwd: root });
  const lock = await readFile(path.join(tauriRoot, 'Cargo.lock'));
  const lockHash = createHash('sha256').update(lock).digest('hex');
  const generated = await readFile(temporaryOutput, 'utf8');
  if (!generated.includes('__CARGO_LOCK_SHA256__')) {
    throw new Error('The cargo-about template is missing its lockfile marker');
  }
  const normalised = generated
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n*$/, '\n');
  await writeFile(
    path.join(tauriRoot, 'resources', 'THIRD_PARTY_LICENSES.html'),
    normalised.replace('__CARGO_LOCK_SHA256__', lockHash),
  );
  console.log(`Generated Rust licence notice for Cargo.lock ${lockHash.slice(0, 12)}.`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

/* global process */
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const child = spawn(process.execPath, [
  cli,
  'build',
  '--debug',
  '--no-bundle',
  '--features',
  'e2e',
  '--config',
  'src-tauri/tauri.e2e.conf.json',
], {
  cwd: root,
  env: { ...process.env, VITE_BRIGX_E2E: '1' },
  stdio: 'inherit',
});

child.once('error', error => {
  throw error;
});
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});

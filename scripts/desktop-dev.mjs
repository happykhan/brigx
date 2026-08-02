/* global console, fetch, process, setTimeout */
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const developmentUrl = 'http://127.0.0.1:5173';
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const viteProcess = spawn(
  npmExecutable,
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
  { stdio: 'inherit' },
);

let electronProcess;
let shuttingDown = false;

try {
  await waitForServer(developmentUrl, viteProcess);
  electronProcess = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, BRIGX_DEV_SERVER_URL: developmentUrl },
  });
  electronProcess.once('exit', code => shutdown(code ?? 0));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
viteProcess.once('exit', code => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1);
});

async function waitForServer(url, childProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) throw new Error('Vite exited before Electron could start');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the BRIGX development server');
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  electronProcess?.kill();
  viteProcess.kill();
  process.exitCode = code;
}

import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const testRoot = process.env.BRIGX_E2E_ROOT
  ?? path.join(root, 'test-results', `tauri-e2e-${process.pid}`);
const executable = path.join(
  root,
  'src-tauri',
  'target',
  'debug',
  process.platform === 'win32' ? 'BRIGX.exe' : 'BRIGX',
);

process.env.BRIGX_E2E_ROOT = testRoot;
process.env.BRIGX_E2E_USER_DATA_DIR = path.join(testRoot, 'user-data');
process.env.BRIGX_E2E_PICK_PATHS = JSON.stringify([
  [path.join(root, 'tests', 'fixtures', 'reference.fa')],
  [path.join(root, 'tests', 'fixtures', 'query.fa')],
]);
process.env.BRIGX_E2E_OPEN_PATHS = JSON.stringify([
  path.join(testRoot, 'desktop-roundtrip.brigx'),
]);
process.env.BRIGX_E2E_SAVE_PATHS = JSON.stringify([
  path.join(testRoot, 'desktop-roundtrip.brigx'),
  path.join(testRoot, 'desktop-plot.svg'),
  path.join(testRoot, 'new-empty-project.brigx'),
]);

export const config = {
  runner: 'local',
  specs: ['./tests/tauri/**/*.spec.mjs'],
  maxInstances: 1,
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': { application: executable },
  }],
  services: [['@wdio/tauri-service', {
    appBinaryPath: executable,
    driverProvider: 'embedded',
    captureBackendLogs: true,
    captureFrontendLogs: true,
    commandTimeout: 120_000,
    startTimeout: 120_000,
    statusPollTimeout: 10_000,
  }]],
  logLevel: process.env.WDIO_LOG_LEVEL ?? 'error',
  reporters: ['spec'],
  bail: 0,
  waitforTimeout: 30_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 180_000,
  },
};

import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { stdout } from 'node:process';

const require = createRequire(import.meta.url);
const electronPackagePath = require.resolve('electron/package.json');
const electronPackageDirectory = path.dirname(electronPackagePath);

// Electron 43 resolves and downloads its checksummed platform binary lazily.
// Requiring it here makes the runtime and its notices available before Forge
// evaluates packagerConfig.extraResource on a clean machine.
require('electron');

const electronPackage = JSON.parse(await readFile(electronPackagePath, 'utf8'));
const requiredRuntimeFiles = [
  path.join(electronPackageDirectory, 'dist', 'LICENSE'),
  path.join(electronPackageDirectory, 'dist', 'LICENSES.chromium.html'),
];
await Promise.all(requiredRuntimeFiles.map(filePath => access(filePath)));

stdout.write(`Electron ${electronPackage.version} runtime and notices are ready.\n`);

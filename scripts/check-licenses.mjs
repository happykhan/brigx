/* global console, process */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const notices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');

const expectedLicences = new Map([
  ['@genomicx/ui', new Set(['GPL-3.0', 'GPL-3.0-only'])],
  ['pako', new Set(['(MIT AND Zlib)', 'MIT', 'Zlib'])],
  ['react', new Set(['MIT'])],
  ['react-dom', new Set(['MIT'])],
  ['react-hot-toast', new Set(['MIT'])],
  ['react-router-dom', new Set(['MIT'])],
]);
const expectedDesktopRuntimeLicences = new Map([
  ['electron', new Set(['MIT'])],
]);

const prohibitedPackages = [
  '@handsontable/react',
  'handsontable',
  '@sciguy/cgview-js',
  'cgview-js',
];
const runtimeDependencies = Object.keys(packageJson.dependencies || {});
const failures = [];

for (const packageName of prohibitedPackages) {
  if (runtimeDependencies.includes(packageName)) {
    failures.push(`${packageName} is not approved for commercial BRIGX builds`);
  }
}

for (const packageName of runtimeDependencies) {
  const manifestPath = path.join(root, 'node_modules', packageName, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    failures.push(`${packageName} is not installed; run npm install before this check`);
    continue;
  }

  const allowed = expectedLicences.get(packageName);
  if (!allowed) {
    failures.push(`${packageName} has no approved runtime licence policy entry`);
  } else if (!allowed.has(manifest.license)) {
    failures.push(`${packageName}@${manifest.version} reports unexpected licence ${manifest.license || 'MISSING'}`);
  }

  if (!notices.includes(`\`${packageName}\``)) {
    failures.push(`${packageName} is missing from THIRD_PARTY_NOTICES.md`);
  }
}

for (const [packageName, allowed] of expectedDesktopRuntimeLicences) {
  if (!packageJson.devDependencies?.[packageName]) {
    failures.push(`${packageName} is missing from desktop development dependencies`);
    continue;
  }
  const manifest = JSON.parse(await readFile(
    path.join(root, 'node_modules', packageName, 'package.json'),
    'utf8',
  ));
  if (!allowed.has(manifest.license)) {
    failures.push(`${packageName}@${manifest.version} reports unexpected licence ${manifest.license || 'MISSING'}`);
  }
  if (!notices.includes(`\`${packageName}\``)) {
    failures.push(`${packageName} is missing from THIRD_PARTY_NOTICES.md`);
  }
}

const sourcePaths = ['components', 'hooks', 'lib', 'src', 'workers'];
const sourceFiles = [];
for (const sourcePath of sourcePaths) {
  await collectSourceFiles(path.join(root, sourcePath), sourceFiles);
}

for (const filename of sourceFiles) {
  const source = await readFile(filename, 'utf8');
  if (
    /non-commercial-and-evaluation|from\s+['"](?:@handsontable\/react|handsontable)/i.test(source)
    || /(?:from\s+|import\()['"][^'"]*cgview/i.test(source)
  ) {
    failures.push(`${path.relative(root, filename)} contains a prohibited non-commercial dependency reference`);
  }
}

if (failures.length > 0) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Licence policy passed for ${runtimeDependencies.length} web and ${expectedDesktopRuntimeLicences.size} desktop runtime packages.`);

async function collectSourceFiles(directory, output) {
  const { readdir } = await import('node:fs/promises');
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectSourceFiles(fullPath, output);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) output.push(fullPath);
  }
}

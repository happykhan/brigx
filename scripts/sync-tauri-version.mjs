/* global console */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packagePath = path.join(root, 'package.json');
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargoLockPath = path.join(root, 'src-tauri', 'Cargo.lock');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
  throw new Error(`Cannot synchronise invalid package version: ${packageJson.version}`);
}

const cargo = await readFile(cargoPath, 'utf8');
const updated = cargo.replace(
  /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
  `$1"${packageJson.version}"`,
);
if (updated === cargo && !cargo.includes(`version = "${packageJson.version}"`)) {
  throw new Error('Could not locate the package version in src-tauri/Cargo.toml');
}
await writeFile(cargoPath, updated);
const cargoLock = await readFile(cargoLockPath, 'utf8');
const updatedLock = cargoLock.replace(
  /(\[\[package\]\]\nname = "brigx"\nversion = )"[^"]+"/,
  `$1"${packageJson.version}"`,
);
if (updatedLock === cargoLock && !cargoLock.includes(`name = "brigx"\nversion = "${packageJson.version}"`)) {
  throw new Error('Could not locate the BRIGX package in src-tauri/Cargo.lock');
}
await writeFile(cargoLockPath, updatedLock);
console.log(`Synchronised Tauri crate version to ${packageJson.version}.`);

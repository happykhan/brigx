import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const exampleSessionPath = path.join(root, 'public/examples/ecoli-comparison.brigx-session.json');
const publicationPath = path.join(root, 'public/publications/ecoli-comparison.json');

const session = JSON.parse(await readFile(exampleSessionPath, 'utf8'));
if (!session.result) {
  throw new Error(`Example session at ${exampleSessionPath} has no embedded result snapshot`);
}

await writeFile(publicationPath, `${JSON.stringify(session.result, null, 2)}\n`);

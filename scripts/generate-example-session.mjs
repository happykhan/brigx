import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publication = JSON.parse(await readFile(
  path.join(root, 'public/publications/ecoli-comparison.json'),
  'utf8',
));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const queryFiles = new Map([
  ['E. coli CFT073', 'E_coli_CFT073.fna'],
  ['E. coli UTI89', 'E_coli_UTI89.fna'],
  ['E. coli K-12 MG1655', 'E_coli_K12MG1655.fna'],
  ['E. coli HS', 'E_coli_HS.fna'],
]);
const timestamp = Date.parse(publication.createdAt);

const session = {
  type: 'brigx-session',
  schemaVersion: 1,
  version: packageJson.version,
  timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
  referenceFileName: 'E_coli_O157H7Sakai.gbk',
  referenceAnnotations: publication.plot.reference.annotations ?? [],
  rings: publication.plot.rings.map(ring => ({
    id: ring.queryId,
    legendText: ring.queryName,
    color: ring.color,
    upperThreshold: ring.upperThreshold ?? 90,
    lowerThreshold: ring.lowerThreshold ?? 70,
    customWidth: ring.customWidth,
    blastType: 'blastn',
    showLabels: ring.showLabels ?? true,
    graphMaxCap: ring.graphMaxCap,
    fileNames: queryFiles.has(ring.queryName) ? [queryFiles.get(ring.queryName)] : [],
    annotations: ring.annotations ?? [],
  })),
  params: {
    minIdentity: publication.plot.config.minIdentity,
    minAlignmentLength: publication.plot.config.minAlignmentLength,
    colorScheme: 'blue-red',
    forceAlignment: false,
    alignerOptions: '',
    blastProgram: 'blastn',
    showGCContent: true,
    showGCSkew: true,
  },
  imageConfig: publication.imageConfig,
  result: {
    type: 'brigx-result',
    schemaVersion: 1,
    createdAt: Number.isFinite(timestamp) ? timestamp : Date.now(),
    title: publication.title,
    description: publication.description,
    plot: publication.plot,
    imageConfig: publication.imageConfig,
  },
};

const outputDirectory = path.join(root, 'public/examples');
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, 'ecoli-comparison.brigx-session.json'),
  `${JSON.stringify(session)}\n`,
);

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const referencePath = path.join(root, 'examples/E_coli_O157H7Sakai.gbk');
const queries = [
  ['E. coli CFT073', 'E_coli_CFT073.fna', '#315c83'],
  ['E. coli UTI89', 'E_coli_UTI89.fna', '#2e8585'],
  ['E. coli K-12 MG1655', 'E_coli_K12MG1655.fna', '#b86b29'],
  ['E. coli HS', 'E_coli_HS.fna', '#76579b'],
];

const genbank = await readFile(referencePath, 'utf8');
const referenceSequence = genbank.match(/ORIGIN([\s\S]*?)(?:\/\/|$)/)?.[1].replace(/[^a-zA-Z]/g, '').toUpperCase();
if (!referenceSequence) throw new Error('Could not read the reference sequence');

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'brigx-publication-'));
const referenceFasta = path.join(temporaryDirectory, 'reference.fna');
await writeFile(referenceFasta, `>E_coli_O157H7_Sakai\n${referenceSequence.match(/.{1,80}/g).join('\n')}\n`);

function metricWindows(sequence, size = 50_000) {
  const gcContent = [];
  const gcSkew = [];
  for (let start = 0; start < sequence.length; start += size) {
    const window = sequence.slice(start, start + size);
    const g = (window.match(/G/g) || []).length;
    const c = (window.match(/C/g) || []).length;
    gcContent.push((g + c) / window.length);
    gcSkew.push(g + c ? (g - c) / (g + c) : 0);
  }
  return { gcContent, gcSkew };
}

function coveredBases(hits) {
  const intervals = hits
    .map(hit => [Math.min(hit.refStart, hit.refEnd), Math.max(hit.refStart, hit.refEnd)])
    .sort((left, right) => left[0] - right[0]);
  let total = 0;
  let currentStart = -1;
  let currentEnd = -1;
  for (const [start, end] of intervals) {
    if (start > currentEnd) {
      if (currentEnd >= currentStart) total += currentEnd - currentStart + 1;
      currentStart = start;
      currentEnd = end;
    } else {
      currentEnd = Math.max(currentEnd, end);
    }
  }
  if (currentEnd >= currentStart) total += currentEnd - currentStart + 1;
  return total;
}

const rings = [];
try {
  for (const [queryName, filename, color] of queries) {
    const result = spawnSync('blastn', [
      '-query', path.join(root, 'examples', filename),
      '-subject', referenceFasta,
      '-outfmt', '6 qseqid sseqid pident length qstart qend sstart send bitscore',
      '-perc_identity', '70',
      '-word_size', '28',
      '-max_hsps', '3000',
      '-num_threads', '4',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr || `blastn failed for ${filename}`);

    const hits = result.stdout.trim().split('\n').filter(Boolean).map(line => {
      const [, , identity, length, queryStart, queryEnd, subjectStart, subjectEnd, score] = line.split('\t');
      return {
        queryName,
        refStart: Number(subjectStart),
        refEnd: Number(subjectEnd),
        queryStart: Number(queryStart),
        queryEnd: Number(queryEnd),
        percentIdentity: Number(identity),
        alignmentLength: Number(length),
        strand: Number(subjectStart) <= Number(subjectEnd) ? '+' : '-',
        score: Number(score),
      };
    }).filter(hit => hit.alignmentLength >= 1000);

    const totalAlignedBases = coveredBases(hits);
    rings.push({
      queryId: filename.replace(/\W+/g, '-').toLowerCase(),
      queryName,
      color,
      visible: true,
      hits,
      statistics: {
        meanIdentity: hits.reduce((sum, hit) => sum + hit.percentIdentity, 0) / hits.length,
        genomeCoverage: totalAlignedBases / referenceSequence.length * 100,
        totalAlignedBases,
      },
    });
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const publication = {
  schemaVersion: 1,
  slug: 'ecoli-comparison',
  title: 'E. coli genome comparison',
  description: 'A BRIGX comparison using the original BRIG example genomes.',
  createdAt: new Date().toISOString(),
  plot: {
    reference: {
      name: 'E. coli O157:H7 Sakai',
      length: referenceSequence.length,
      ...metricWindows(referenceSequence),
    },
    rings,
    config: { minIdentity: 70, minAlignmentLength: 1000 },
  },
  imageConfig: {
    innerRadius: 200,
    ringWidth: 24,
    gcRingWidth: 32,
    ringSpacing: 4,
    legendFontSize: 16,
    scaleFontSize: 12,
    titleFontSize: 24,
    labelFontSize: 14,
    title: 'E. coli genome comparison',
    showLegend: true,
  },
};

const publicationDirectory = path.join(root, 'public/publications');
await mkdir(publicationDirectory, { recursive: true });
await writeFile(
  path.join(publicationDirectory, 'ecoli-comparison.json'),
  `${JSON.stringify(publication)}\n`,
);

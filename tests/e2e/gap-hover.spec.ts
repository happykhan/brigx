import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function hoverReference(page: Page, position: number, length: number, radius = 298, zoom = 1, panX = 0, panY = 0) {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const angle = position / length * 2 * Math.PI - Math.PI / 2;
  await page.mouse.move(box.x + (500 + panX + zoom * radius * Math.cos(angle)) * box.width / 1000,
    box.y + (500 + panY + zoom * radius * Math.sin(angle)) * box.height / 1000);
}

test('large saved comparison shows gap coordinates, keeps alignment hover, and survives zoom, pan and restore', async ({ page }, testInfo) => {
  await page.goto('/publication/ecoli-comparison');
  await expect(page.locator('canvas')).toBeVisible();
  const tooltip = page.getByTestId('plot-tooltip');
  const gapPosition = (4883499 + 4919352) / 2;
  await hoverReference(page, gapPosition, 5357923);
  await expect(tooltip).toContainText('Unaligned reference interval');
  await expect(tooltip).toContainText('4,883,500–4,919,352 (35,853 bp)');
  await expect(tooltip).toContainText('Reference CDS annotations unavailable');
  await page.screenshot({ path: testInfo.outputPath('gap-hover.png') });
  await hoverReference(page, 3560000, 5357923);
  await expect(tooltip).toContainText('Identity:');
  await expect(tooltip).not.toContainText('Unaligned');
  await page.getByRole('button', { name: 'Zoom in (or scroll up)' }).click();
  await hoverReference(page, gapPosition, 5357923, 298, 1.2);
  await expect(tooltip).toContainText('4,883,500–4,919,352');
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 + 10, { steps: 4 });
  await page.mouse.up();
  await hoverReference(page, gapPosition, 5357923, 298, 1.2, 15, 10);
  await expect(tooltip).toContainText('4,883,500–4,919,352');

  await page.goto('/app');
  await page.getByLabel('Load session').setInputFiles(path.join(process.cwd(), 'public/examples/ecoli-comparison.brigx-session.json'));
  await expect(page.locator('canvas')).toBeVisible();
  await hoverReference(page, gapPosition, 5357923);
  await expect(tooltip).toContainText('4,883,500–4,919,352');
});

test('GenBank reference retains CDS through real BLAST, session save and reload without drawing extra features', async ({ page }, testInfo) => {
  // Use a deterministic non-repetitive reference with a known interval omitted from the query.
  let seed = 123456;
  const sequence = Array.from({ length: 12000 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 'ACGT'[seed >>> 30];
  }).join('');
  const genbank = `LOCUS       gap_reference 12000 bp DNA circular
FEATURES             Location/Qualifiers
     CDS             5501..6500
                     /gene="gapGene"
                     /locus_tag="GAP_001"
                     /product="Reference gap protein"
ORIGIN
        1 ${sequence}
//
`;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/app');
  await page.getByLabel('Reference genome file').setInputFiles({ name: 'reference.gbk', mimeType: 'text/plain', buffer: Buffer.from(genbank) });
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await page.getByRole('button', { name: 'Add New Ring' }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles({ name: 'query.fa', mimeType: 'text/plain',
    buffer: Buffer.from(`>query\n${sequence.slice(0, 4500)}${sequence.slice(7500)}\n`) });
  await page.getByRole('button', { name: 'Run Alignments' }).click();
  await expect(page.getByText('Alignments completed successfully!')).toBeVisible();
  await expect(page.getByText('Alignments completed successfully!')).toBeHidden();
  await hoverReference(page, 6000, 12000);
  const tooltip = page.getByTestId('plot-tooltip');
  await expect(tooltip).toContainText('Unaligned reference interval');
  await expect(tooltip).toContainText('gapGene');
  await expect(tooltip).toContainText('GAP_001');
  await expect(tooltip).toContainText('Reference gap protein');
  const box = (await tooltip.boundingBox())!;
  const plotBox = (await page.locator('canvas').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(plotBox.y + plotBox.height + 2);
  await page.screenshot({ path: testInfo.outputPath('genbank-gap-hover.png') });

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save session' }).click();
  const savedPath = (await (await saved).path())!;
  const session = JSON.parse(await fs.readFile(savedPath, 'utf8'));
  expect(session.result.plot.reference.cds[0].name).toBe('gapGene');
  expect(session.result.plot.reference.features ?? []).toHaveLength(0);
  expect(session.result.plot.reference.annotations ?? []).toHaveLength(0);
  await page.getByLabel('Load session').setInputFiles(savedPath);
  await hoverReference(page, 6000, 12000);
  await expect(tooltip).toContainText('gapGene');
  expect(errors).toEqual([]);
});

test('gap hover preserves custom overlay precedence and excludes graph tracks', async ({ page }) => {
  const snapshot = JSON.parse(await fs.readFile('public/publications/ecoli-comparison.json', 'utf8'));
  snapshot.plot.rings[0].annotations = [{ id: 'overlay', start: 4883500, end: 4919352,
    label: 'Manual overlay', shape: 'block', color: '#123456' }];
  snapshot.plot.rings[1].hits = [];
  snapshot.plot.rings[1].graphPoints = [{ start: 0, end: 5357923, value: 0 }];
  snapshot.plot.rings[1].graphMaxValue = 1;
  await page.route('**/publications/ecoli-comparison.json', route => route.fulfill({ json: snapshot }));
  await page.goto('/publication/ecoli-comparison');
  await expect(page.locator('canvas')).toBeVisible();
  await hoverReference(page, 4900000, 5357923);
  await expect(page.getByTestId('plot-tooltip')).toContainText('Manual overlay');
  await expect(page.getByTestId('plot-tooltip')).not.toContainText('Unaligned');
  await hoverReference(page, 4900000, 5357923, 322);
  await expect(page.getByTestId('plot-tooltip')).toHaveCount(0);
});

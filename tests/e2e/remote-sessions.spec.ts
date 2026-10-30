import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const filename = 'shared.brigx-session.json';
const revision = 'b'.repeat(40);
const gistId = 'a'.repeat(32);
const providers = [
  { name: 'GitHub', source: `https://github.com/brigx-fixtures/sessions/blob/main/${filename}`,
    file: `https://raw.githubusercontent.com/brigx-fixtures/sessions/main/${filename}` },
  { name: 'GitLab blob with slash ref', source: `https://gitlab.com/brigx-fixtures/sessions/-/blob/feature/share/${filename}`,
    file: `https://gitlab.com/api/v4/projects/brigx-fixtures%2Fsessions/repository/files/${filename}/raw?ref=${revision}`, gitlab: true },
  { name: 'GitLab raw', source: `https://gitlab.com/brigx-fixtures/sessions/-/raw/${revision}/${filename}`,
    file: `https://gitlab.com/api/v4/projects/brigx-fixtures%2Fsessions/repository/files/${filename}/raw?ref=${revision}` },
  { name: 'Gist page', source: `https://gist.github.com/brigx-fixtures/${gistId}`,
    file: `https://gist.githubusercontent.com/brigx-fixtures/${gistId}/raw/${revision}/${filename}`,
    api: `https://api.github.com/gists/${gistId}` },
  { name: 'Gist raw', source: `https://gist.githubusercontent.com/brigx-fixtures/${gistId}/raw/${revision}/${filename}`,
    file: `https://gist.githubusercontent.com/brigx-fixtures/${gistId}/raw/${revision}/${filename}` },
  { name: 'Zenodo record', source: 'https://zenodo.org/records/123',
    file: `https://zenodo.org/api/records/123/files/${filename}/content`, api: 'https://zenodo.org/api/records/123' },
  { name: 'Zenodo file', source: `https://zenodo.org/records/123/files/${filename}?download=1`,
    file: `https://zenodo.org/api/records/123/files/${filename}/content`, api: 'https://zenodo.org/api/records/123' },
];

for (const provider of providers) {
  for (const route of ['/preview', '/app']) {
    test(`${provider.name} loads in ${route} with production CSP`, async ({ page }, testInfo) => {
      // Project-controlled session data and deterministic provider API contracts; no external deposits are created.
      const session = JSON.parse(await fs.readFile('public/examples/ecoli-comparison.brigx-session.json', 'utf8'));
      session.result.plot.rings = session.result.plot.rings.slice(0, 1);
      session.rings = session.rings.slice(0, 1);
      session.result.plot.rings[0].hits = session.result.plot.rings[0].hits.slice(0, 8);
      session.result.plot.rings[0].alignmentOutput = '';
      const headers = await fs.readFile('public/_headers', 'utf8');
      const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)![1];
      await page.route('**/*', async requestRoute => {
        if (requestRoute.request().resourceType() === 'document') {
          const response = await requestRoute.fetch();
          await requestRoute.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
        } else await requestRoute.continue();
      });
      await page.route(provider.file, requestRoute => requestRoute.fulfill({ json: session }));
      if (provider.gitlab) {
        await page.route('https://gitlab.com/api/v4/projects/*/repository/branches/*', requestRoute => requestRoute.fulfill({
          json: { name: 'feature/share', commit: { id: revision } },
        }));
        await page.route('https://gitlab.com/api/v4/projects/*/repository/tags/*', requestRoute => requestRoute.fulfill({ status: 404 }));
      }
      if (provider.api) {
        const metadata = provider.name.startsWith('Gist')
          ? { public: true, files: { [filename]: { filename, raw_url: provider.file, truncated: true } } }
          : { id: 123, files: [{ key: filename, links: { self: provider.file } }] };
        await page.route(provider.api, requestRoute => requestRoute.fulfill({ json: metadata }));
      }
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${route}?url=${encodeURIComponent(provider.source)}`);
      await expect(page.locator('canvas')).toBeVisible();
      expect(new URL(page.url()).searchParams.get('url')).toBe(provider.source);
      if (route === '/preview') {
        await expect(page.getByRole('region', { name: 'Read-only interactive genome comparison' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Reference Genome', exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Edit session' })).toHaveAttribute('href', `/app?url=${encodeURIComponent(provider.source)}`);
        await expect(page.getByText(/Re-add source FASTA files in the editor/)).toBeVisible();
      } else {
        await expect(page.getByRole('button', { name: 'Add New Ring' })).toBeVisible();
        await expect(page.getByText('Saved result loaded for editing. Re-add source FASTA files to rerun alignments.', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Run Alignments' })).toBeDisabled();
      }
      if (provider.name === 'Zenodo record' && route === '/preview') {
        await page.screenshot({ path: testInfo.outputPath('public-session-viewer.png'), fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const route of ['/preview', '/app']) {
  test(`remote failures have a recovery path in ${route}`, async ({ page }) => {
    const source = providers[0].source;
    await page.route(providers[0].file, requestRoute => requestRoute.fulfill({ status: 404 }));
    await page.goto(`${route}?url=${encodeURIComponent(source)}`);
    if (route === '/preview') {
      await expect(page.getByRole('heading', { name: /HTTP 404/ })).toBeVisible();
      const input = page.getByLabel('Public BRIGX session URL');
      await expect(input).toBeVisible();
      await input.fill('https://unsupported.example/session.json');
      await page.getByRole('button', { name: 'Open in viewer' }).click();
      await expect(page.getByRole('heading', { name: /Use a public GitHub/ })).toBeVisible();
    } else {
      await expect(page.getByRole('alert', { name: 'Public session error' })).toContainText('HTTP 404');
      await page.unroute(providers[0].file);
      await page.route(providers[0].file, requestRoute => requestRoute.fulfill({ path: 'public/examples/ecoli-comparison.brigx-session.json' }));
      await page.getByRole('button', { name: 'Retry session URL' }).click();
      await expect(page.locator('canvas')).toBeVisible();
      await expect(page.getByRole('alert', { name: 'Public session error' })).toHaveCount(0);
    }
  });
}

test('a downloaded JSON with the wrong schema is rejected in preview and edit modes', async ({ page }) => {
  await page.route(providers[0].file, requestRoute => requestRoute.fulfill({ json: { not: 'a BRIGX session' } }));
  await page.goto(`/preview?url=${encodeURIComponent(providers[0].source)}`);
  await expect(page.getByRole('heading', { name: 'Invalid BRIGX result file' })).toBeVisible();
  await page.goto(`/app?url=${encodeURIComponent(providers[0].source)}`);
  await expect(page.getByRole('alert', { name: 'Public session error' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

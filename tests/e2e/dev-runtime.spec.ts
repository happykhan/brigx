import { expect, test } from '@playwright/test'
import path from 'node:path'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures')
const REFERENCE = path.join(FIXTURES, 'reference.fa')
const QUERY = path.join(FIXTURES, 'query.fa')
const BLAST_ASSETS = ['formatdb.js', 'formatdb.wasm', 'blastall.js', 'blastall.wasm']

test('Vite development mode completes an alignment without transforming public BLAST assets', async ({ page }) => {
  const pageErrors: string[] = []
  const assetRequests: Array<{ url: URL; resourceType: string }> = []

  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (BLAST_ASSETS.some(asset => url.pathname.endsWith(`/wasm/blast/${asset}`))) {
      assetRequests.push({ url, resourceType: request.resourceType() })
    }
  })

  await page.goto('/app')
  await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
  await page.getByRole('button', { name: 'Add New Ring' }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles(QUERY)
  await page.getByRole('button', { name: 'Run Alignments' }).click()

  await expect(page.getByText('Alignments completed successfully!')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Alignment error' })).toHaveCount(0)
  await expect(page.getByText(/Coverage: 100\.0%/)).toBeVisible()

  for (const asset of BLAST_ASSETS) {
    const matchingRequests = assetRequests.filter(request => request.url.pathname.endsWith(`/wasm/blast/${asset}`))
    expect(matchingRequests.length).toBeGreaterThan(0)
    for (const request of matchingRequests) {
      expect(request.url.searchParams.has('import')).toBe(false)
      expect(request.url.searchParams.get('v')).toMatch(/^[a-f0-9]{64}$/)
      expect(request.resourceType).toBe('fetch')
    }
  }
  expect(pageErrors).toEqual([])
})

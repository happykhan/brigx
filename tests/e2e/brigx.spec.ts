import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures')
const REFERENCE = path.join(FIXTURES, 'reference.fa')
const QUERY = path.join(FIXTURES, 'query.fa')
const BAKTA_GFF3 = path.join(FIXTURES, 'bakta.gff3')

test.describe('BRIGX e2e — circular genome plot', () => {
  test('landing page explains the web product', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Circular genome comparison for microbial genomics' })).toBeVisible()
    await expect(page.getByRole('img', { name: /repository example data/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open the web app' })).toHaveAttribute('href', '/app')
    await expect(page.getByText('Repository example data')).toBeVisible()
    await expect(page.locator('footer').getByText('BRIGX', { exact: true })).toBeVisible()
    await expect(page.getByText(/All processing runs locally in your browser/)).toBeVisible()
  })

  test('landing page uses the dedicated mobile composition without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Circular genome comparison for microbial genomics' })).toBeVisible()
    await expect(page.locator('.gx-nav-logo-sub')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('opens a published comparison as an interactive read-only viewer', async ({ page }) => {
    await page.goto('/publication/ecoli-comparison')

    await expect(page.getByRole('heading', { name: 'E. coli genome comparison' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Read-only interactive genome comparison' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom in (or scroll up)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reference Genome' })).toHaveCount(0)
  })

  test('loads the app with Reference Genome section visible', async ({ page }) => {
    await page.goto('/app')

    await expect(page.getByRole('heading', { name: 'Reference Genome' })).toBeVisible()
    await expect(page.getByText('Load a reference genome to begin')).toBeVisible()
  })

  test('shows bug reporting only inside the web app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Report a bug' })).toHaveCount(0)

    await page.goto('/app')
    await page.getByRole('button', { name: 'Report a bug' }).click()
    await expect(page.getByRole('dialog', { name: 'Report a bug' })).toBeVisible()
    await expect(page.getByLabel('What happened?')).toBeVisible()
    await expect(page.getByLabel(/Email address/)).toBeVisible()
    await expect(page.getByText(/Do not include confidential/)).toBeVisible()
  })

  test('uploading a reference FASTA shows the filename', async ({ page }) => {
    await page.goto('/app')

    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    await expect(page.getByText('reference.fa', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('uploading reference shows the Run button', async ({ page }) => {
    await page.goto('/app')

    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    await expect(page.getByText('reference.fa', { exact: true })).toBeVisible({ timeout: 10_000 })

    const runButton = page.getByRole('button', { name: /run|generate|build/i })
    await expect(runButton.first()).toBeVisible()
  })

  test('annotation table keeps edits, accepts spreadsheet paste, and deletes rows', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/app')

    const pageErrors: Error[] = []
    page.on('pageerror', error => pageErrors.push(error))

    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.getByRole('button', { name: 'Custom Ring Overlay' }).click()
    await expect(page.getByRole('heading', { name: 'Annotations for Ring 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Add New', exact: true }).click()

    const firstLabelCell = page.getByRole('textbox', { name: 'Label row 1' })
    await firstLabelCell.fill('edited gene')
    await expect(firstLabelCell).toHaveValue('edited gene')

    await page.getByRole('button', { name: 'Reset All' }).click()
    await expect(page.getByText(/^0 annotation\(s\) \| Reference:/)).toBeVisible()

    await page.evaluate(() => navigator.clipboard.writeText(
      '100\t200\tgene A\tblock\t#ff0000\n300\t450\tgene B\tarrow-forward\t#00ff00',
    ))
    const emptyStartCell = page.getByRole('spinbutton', { name: 'Paste annotations here' })
    await emptyStartCell.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
    await expect(page.getByText(/^2 annotation\(s\) \| Reference:/)).toBeVisible()

    const firstStartCell = page.getByRole('spinbutton', { name: 'Start row 1' })
    await firstStartCell.click()
    await page.getByRole('button', { name: 'Delete Selected' }).click()
    await expect(page.getByText(/^1 annotation\(s\) \| Reference:/)).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('loads Bakta GFF3 on the reference track', async ({ page }) => {
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })
    await page.getByLabel('Companion reference annotation file').setInputFiles(BAKTA_GFF3)

    await expect(page.getByText(/bakta\.gff3 — 2 CDS feature\(s\)/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Centre' })).toBeVisible()
  })

  test('about page discloses privacy, licences, and third-party software', async ({ page }) => {
    await page.goto('/about')

    await expect(page.getByRole('heading', { name: 'About BRIGX' })).toBeVisible()
    await expect(page.getByText(/Genome and annotation files are processed locally/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'GNU General Public License v3.0' })).toHaveAttribute('href', /LICENSE$/)
    await expect(page.getByRole('link', { name: 'complete third-party notice' })).toHaveAttribute('href', /THIRD_PARTY_NOTICES\.md$/)
    await expect(page.getByText(/editable annotation table are original BRIGX implementations/)).toBeVisible()
    await expect(page.getByRole('cell', { name: 'GenomicX UI' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Example data' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Attribution and trademarks' })).toHaveCount(0)
  })

  test('runs an alignment with the bundled integrity-checked BLAST assets', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', error => pageErrors.push(error))
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.locator('input[type="file"][multiple]').setInputFiles(QUERY)

    const assetNames = ['formatdb.js', 'formatdb.wasm', 'blastall.js', 'blastall.wasm']
    const assetResponses = assetNames.map(assetName => page.waitForResponse(
      response => response.url().endsWith(`/wasm/blast/${assetName}`) && response.status() === 200,
    ))

    await page.getByRole('button', { name: 'Run Alignments' }).click()
    await Promise.all(assetResponses)
    await expect(page.getByText('Alignments completed successfully!')).toBeVisible({ timeout: 30_000 })
    expect(pageErrors).toEqual([])
  })

  test('expanded plot controls remain clickable and SVG downloads', async ({ page }) => {
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Expand plot' }).click()
    await expect(page.getByRole('button', { name: 'Shrink plot' })).toBeVisible()
    await page.getByRole('button', { name: 'Zoom in (or scroll up)' }).click()
    await page.getByRole('button', { name: 'Zoom in (or scroll up)' }).click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'SVG', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^brig-plot-\d+\.svg$/)
    const downloadedPath = await download.path()
    expect(downloadedPath).not.toBeNull()
    const svg = await fs.readFile(downloadedPath!, 'utf8')
    expect(svg).toContain('id="main-content"')
    expect(svg).toContain('scale(1.44)')
    expect(svg).toContain('id="legends"')
    expect(svg).toContain('inkscape:label="Legends"')

    await page.getByRole('button', { name: 'Shrink plot' }).click()
    await expect(page.getByRole('button', { name: 'Expand plot' })).toBeVisible()
  })
})

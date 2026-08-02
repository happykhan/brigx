import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures')
const REFERENCE = path.join(FIXTURES, 'reference.fa')

test.describe('BRIGX e2e — circular genome plot', () => {
  test.beforeEach(async ({ page }) => {
    // Fonts are cosmetic and should not make local tests depend on Google being reachable.
    await page.route('https://fonts.googleapis.com/**', route => route.abort())
    await page.route('https://fonts.gstatic.com/**', route => route.abort())
  })

  test('loads the app with Reference Genome section visible', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Reference Genome' })).toBeVisible()
    await expect(page.getByText('Load a reference genome to begin')).toBeVisible()
  })

  test('uploading a reference FASTA shows the filename', async ({ page }) => {
    await page.goto('/')

    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    await expect(page.getByText('reference.fa')).toBeVisible({ timeout: 10_000 })
  })

  test('uploading reference shows the Run button', async ({ page }) => {
    await page.goto('/')

    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    await expect(page.getByText('reference.fa')).toBeVisible({ timeout: 10_000 })

    const runButton = page.getByRole('button', { name: /run|generate|build/i })
    await expect(runButton.first()).toBeVisible()
  })

  test('annotation table keeps edits, accepts spreadsheet paste, and deletes rows', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')

    const pageErrors: Error[] = []
    page.on('pageerror', error => pageErrors.push(error))

    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)
    await expect(page.getByText('reference.fa')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.getByRole('button', { name: 'Custom Annotations' }).click()
    await expect(page.getByRole('heading', { name: 'Annotations for Ring 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Add New', exact: true }).click()

    const firstLabelCell = page.locator('.ht_master tbody tr').first().locator('td').nth(2)
    await firstLabelCell.dblclick()
    const cellEditor = page.locator('textarea.handsontableInput')
    await cellEditor.fill('edited gene')
    await cellEditor.press('Enter')
    await expect(firstLabelCell).toContainText('edited gene')

    await page.getByRole('button', { name: 'Reset All' }).click()
    await expect(page.getByText(/^0 annotation\(s\) \| Reference:/)).toBeVisible()

    await page.evaluate(() => navigator.clipboard.writeText(
      '100\t200\tgene A\tblock\t#ff0000\n300\t450\tgene B\tarrow-forward\t#00ff00',
    ))
    const firstStartCell = page.locator('.ht_master tbody tr').first().locator('td').first()
    await firstStartCell.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
    await expect(page.getByText(/^2 annotation\(s\) \| Reference:/)).toBeVisible()

    await firstStartCell.click()
    await page.getByRole('button', { name: 'Delete Selected' }).click()
    await expect(page.getByText(/^1 annotation\(s\) \| Reference:/)).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})

import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REFERENCE = path.join(__dirname, '../fixtures/reference.fa')
const QUERY = path.join(__dirname, '../fixtures/query.fa')

test.describe('BRIGX e2e — circular genome plot', () => {
  test('loads the app with Reference Genome section visible', async ({ page }) => {
    await page.goto('/')

    // ReferenceInput card should be visible
    await expect(page.getByText('Reference Genome')).toBeVisible()
    await expect(page.getByText('Load a reference genome to begin')).toBeVisible()
  })

  test('uploading a reference FASTA shows the filename', async ({ page }) => {
    await page.goto('/')

    // ReferenceInput uses a plain file input with accept=".fasta,.fa,.fna,.gbk,.gb"
    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    // Filename should appear in the ReferenceInput confirmation element
    await expect(page.getByText('reference.fa')).toBeVisible({ timeout: 10_000 })
  })

  test('uploading reference then a query ring shows the Run button enabled', async ({ page }) => {
    await page.goto('/')

    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    await expect(page.getByText('reference.fa')).toBeVisible({ timeout: 10_000 })

    // The Run/Generate button in ControlPanel
    const runButton = page.getByRole('button', { name: /run|generate|build/i })
    await expect(runButton.first()).toBeVisible()
  })
})

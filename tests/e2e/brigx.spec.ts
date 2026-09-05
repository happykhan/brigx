import { test, expect, type Route } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures')
const REFERENCE = path.join(FIXTURES, 'reference.fa')
const QUERY = path.join(FIXTURES, 'query.fa')
const BAKTA_GFF3 = path.join(FIXTURES, 'bakta.gff3')
const EXAMPLE_SESSION = path.join(process.cwd(), 'public/examples/ecoli-comparison.brigx-session.json')
const GITHUB_SESSION_URL = 'https://github.com/happykhan/brigx/blob/master/public/examples/ecoli-comparison.brigx-session.json'
const RAW_GITHUB_SESSION_URL = 'https://raw.githubusercontent.com/happykhan/brigx/master/public/examples/ecoli-comparison.brigx-session.json'

test.describe('BRIGX e2e — circular genome plot', () => {
  test('landing page explains the web product', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('v0.9.6', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Circular genome comparison for microbial genomics' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Interactive read-only E. coli comparison' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom in (or scroll up)' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open the web app' })).toHaveAttribute('href', '/app')
    await expect(page.getByText('Repository example data')).toHaveCount(0)
    await expect(page.getByText('Rendered live by BRIGX')).toHaveCount(0)
    await expect(page.locator('footer').getByText('BRIGX', { exact: true })).toBeVisible()
    await expect(page.getByText(/All processing runs locally in your browser/)).toBeVisible()

    const previewBox = await page.getByRole('region', { name: 'Interactive read-only E. coli comparison' }).boundingBox()
    const canvasBox = await page.locator('.landing-preview canvas').boundingBox()
    expect(previewBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(Math.abs(previewBox!.width - canvasBox!.width)).toBeLessThan(4)
    expect(previewBox!.height - canvasBox!.height).toBeLessThan(60)
  })

  test('landing page uses the dedicated mobile composition without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Circular genome comparison for microbial genomics' })).toBeVisible()
    await expect(page.locator('.gx-nav-logo-sub')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('ring editor remains usable without horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app')

    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await expect(page.getByTitle('Hex colour code')).toBeVisible()
    await expect(page.getByTitle('Ring colour')).toBeVisible()
    await expect(page.getByTitle('Remove ring')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Float panel' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await expect(page.locator('.gx-console-body')).not.toContainText('[LOG]')
    await expect(page.locator('.gx-console-body')).not.toContainText('[RingConfiguration]')
    await expect(page.locator('.gx-console-body')).not.toContainText('Ring settings changed')
  })

  test('rings can be reordered with a drag handle', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1000 })
    await page.goto('/app')
    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.getByRole('button', { name: 'Add New Ring' }).click()

    const ringCards = page.locator('.ring-editor-card')
    const dragHandle = page.getByRole('button', { name: 'Drag Ring 3 to reorder' })
    const handleBox = await dragHandle.boundingBox()
    const firstCardBox = await ringCards.first().boundingBox()
    expect(handleBox).not.toBeNull()
    expect(firstCardBox).not.toBeNull()
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(firstCardBox!.x + firstCardBox!.width / 2, firstCardBox!.y + firstCardBox!.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect.poll(() => ringCards.locator('.ring-editor-name').evaluateAll(
      elements => elements.map(element => (element as HTMLInputElement).value),
    )).toEqual(['Ring 3', 'Ring 1', 'Ring 2'])
  })

  test('ring cards can collapse into a compact summary row', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: 'Add New Ring' }).click()

    const card = page.locator('.ring-editor-card').first()
    await page.getByRole('button', { name: 'Collapse Ring 1' }).click()

    await expect(card).toHaveClass(/is-collapsed/)
    await expect(card.getByText('Ring 1', { exact: true })).toBeVisible()
    await expect(card.locator('.ring-editor-collapsed-swatch')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Drag Ring 1 to reorder' })).toBeVisible()
    await expect(card.locator('.ring-editor-fields')).toHaveCount(0)

    await page.getByRole('button', { name: 'Expand Ring 1' }).click()
    await expect(card).not.toHaveClass(/is-collapsed/)
    await expect(card.locator('.ring-editor-fields')).toHaveCount(1)
  })

  test('ring configuration can float, move, resize, minimise, dock and close', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app')

    const panel = page.getByTestId('rings-panel')
    await page.getByRole('button', { name: 'Float panel' }).click()
    await expect(panel).toHaveClass(/is-floating/)

    const initialBox = await panel.boundingBox()
    const headingBox = await page.getByRole('heading', { name: 'Ring Configuration' }).boundingBox()
    expect(initialBox).not.toBeNull()
    expect(headingBox).not.toBeNull()

    await page.mouse.move(headingBox!.x + headingBox!.width / 2, headingBox!.y + headingBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(headingBox!.x - 150, headingBox!.y + 90, { steps: 8 })
    await page.mouse.up()

    const movedBox = await panel.boundingBox()
    expect(movedBox).not.toBeNull()
    expect(movedBox!.x).toBeLessThan(initialBox!.x - 100)
    expect(movedBox!.y).toBeGreaterThan(initialBox!.y + 50)

    const resizeHandle = page.getByRole('button', { name: 'Resize Ring Configuration panel' })
    const resizeBox = await resizeHandle.boundingBox()
    expect(resizeBox).not.toBeNull()
    await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y + resizeBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(resizeBox!.x + 80, resizeBox!.y + 50, { steps: 6 })
    await page.mouse.up()

    const resizedBox = await panel.boundingBox()
    expect(resizedBox).not.toBeNull()
    expect(resizedBox!.width).toBeGreaterThan(movedBox!.width + 50)
    expect(resizedBox!.height).toBeGreaterThan(movedBox!.height + 30)

    await page.reload()
    await page.getByRole('button', { name: 'Float panel' }).click()
    const restoredFrameBox = await page.getByTestId('rings-panel').boundingBox()
    expect(restoredFrameBox).not.toBeNull()
    expect(Math.abs(restoredFrameBox!.x - resizedBox!.x)).toBeLessThan(3)
    expect(Math.abs(restoredFrameBox!.y - resizedBox!.y)).toBeLessThan(3)
    expect(Math.abs(restoredFrameBox!.width - resizedBox!.width)).toBeLessThan(3)
    expect(Math.abs(restoredFrameBox!.height - resizedBox!.height)).toBeLessThan(3)

    await page.getByRole('button', { name: 'Minimise' }).click()
    await expect(panel).toHaveClass(/is-minimised/)
    expect((await panel.boundingBox())!.height).toBeLessThan(120)
    await expect(page.getByRole('button', { name: 'Add New Ring' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Restore' }).click()
    await page.getByRole('button', { name: 'Dock' }).click()
    await expect(panel).toHaveClass(/is-docked/)

    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(panel).toHaveCount(0)
    await page.getByRole('button', { name: 'Show Ring Configuration' }).click()
    await expect(page.getByTestId('rings-panel')).toHaveClass(/is-docked/)
  })

  test('floating ring panel keeps its resize handle pinned while rings scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app')

    await page.getByRole('button', { name: 'Float panel' }).click()
    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: 'Add New Ring' }).click()
    }

    const panel = page.getByTestId('rings-panel')
    const scrollArea = panel.locator('.rings-panel-scroll-area')
    await expect(scrollArea).toBeVisible()
    await scrollArea.evaluate(element => { element.scrollTop = element.scrollHeight })

    const panelBox = await panel.boundingBox()
    const handleBox = await page.getByRole('button', { name: 'Resize Ring Configuration panel' }).boundingBox()
    expect(panelBox).not.toBeNull()
    expect(handleBox).not.toBeNull()
    expect(Math.abs(panelBox!.x + panelBox!.width - handleBox!.x - handleBox!.width)).toBeLessThan(8)
    expect(Math.abs(panelBox!.y + panelBox!.height - handleBox!.y - handleBox!.height)).toBeLessThan(8)
  })

  test('opens a published comparison as an interactive read-only viewer', async ({ page }) => {
    await page.goto('/publication/ecoli-comparison')

    await expect(page.getByRole('heading', { name: 'BRIGX Example' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Read-only interactive genome comparison' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom in (or scroll up)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reference Genome' })).toHaveCount(0)
  })

  test('opens a portable result file in the read-only viewer', async ({ page }) => {
    await page.goto('/viewer')
    await expect(page.getByRole('link', { name: 'Viewer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Open a read-only BRIGX result' })).toBeVisible()
    await page.getByLabel('BRIGX result file').setInputFiles(path.join(process.cwd(), 'public/publications/ecoli-comparison.json'))

    await expect(page.getByRole('heading', { name: 'BRIGX Example' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Read-only interactive genome comparison' })).toBeVisible()
    await expect(page.getByText('BRIGX read-only result', { exact: true })).toHaveCount(0)
    const statistics = page.getByRole('region', { name: 'Comparison statistics' })
    await expect(statistics.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expect(statistics.getByText('Coverage: 78.5%')).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      statistics.getByRole('button', { name: 'Download' }).first().click(),
    ])
    expect(download.suggestedFilename()).toBe('Ring 1_alignment.txt')
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    const alignmentText = await fs.readFile(downloadPath!, 'utf8')
    expect(alignmentText).toMatch(/^#query\tsubject\t%identity\talignment_length/)
    expect(alignmentText.split('\n').length).toBeGreaterThan(100)
  })

  test('previews a GitHub session URL as a read-only result', async ({ page }) => {
    await page.route(RAW_GITHUB_SESSION_URL, route => route.fulfill({
      path: EXAMPLE_SESSION,
      contentType: 'application/json',
    }))
    await page.goto(`/viewer?url=${encodeURIComponent(GITHUB_SESSION_URL)}`)

    await expect(page.getByRole('heading', { name: 'BRIGX Example' })).toBeVisible()
    await expect(page.getByText('Loaded from a public GitHub session · read-only viewer')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Read-only interactive genome comparison' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit session' })).toHaveAttribute(
      'href',
      `/app?url=${encodeURIComponent(GITHUB_SESSION_URL)}`,
    )
    await expect(page.getByRole('heading', { name: 'Reference Genome' })).toHaveCount(0)
  })

  test('loads the same GitHub session URL into the editable app', async ({ page }) => {
    await page.route(RAW_GITHUB_SESSION_URL, route => route.fulfill({
      path: EXAMPLE_SESSION,
      contentType: 'application/json',
    }))
    await page.goto(`/app?url=${encodeURIComponent(GITHUB_SESSION_URL)}`)

    await expect(page.getByText('GitHub session and saved result loaded for editing.')).toBeVisible()
    await expect(page.getByPlaceholder('Plot title...')).toHaveValue('BRIGX Example')
    await expect(page.getByText('Ring 1', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Preview result' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Viewer' })).toBeVisible()

    const plotArea = page.getByTestId('plot-area')
    await plotArea.scrollIntoViewIfNeeded()
    const plotBox = await plotArea.boundingBox()
    const canvasBox = await plotArea.locator('canvas').boundingBox()
    expect(plotBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    const tooltip = page.getByTestId('plot-tooltip')
    let foundTooltip = false
    for (const radius of [0.34, 0.39, 0.43]) {
      for (let step = 0; step < 16; step += 1) {
        const angle = (step / 16) * Math.PI * 2
        await page.mouse.move(
          canvasBox!.x + canvasBox!.width * (0.5 + Math.cos(angle) * radius),
          canvasBox!.y + canvasBox!.height * (0.5 + Math.sin(angle) * radius),
        )
        if (await tooltip.count() === 1) {
          foundTooltip = true
          break
        }
      }
      if (foundTooltip) break
    }

    expect(foundTooltip).toBe(true)
    await expect(tooltip).toBeVisible()
    const tooltipBox = await tooltip.boundingBox()
    expect(tooltipBox).not.toBeNull()
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(plotBox!.x)
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(plotBox!.y)
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(plotBox!.x + plotBox!.width)
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(plotBox!.y + plotBox!.height)
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
    await expect(page.getByRole('link', { name: 'nabil@happykhan.com' })).toHaveAttribute('href', 'mailto:nabil@happykhan.com')
    const emailReportLink = page.getByRole('link', { name: 'Email bug report' })
    await expect(emailReportLink).toBeVisible()
    await expect(emailReportLink).toHaveAttribute('href', /^mailto:nabil@happykhan\.com\?subject=BRIGX%20bug%20report&body=/)
    await expect(page.getByText(/what happened and what you expected/)).toBeVisible()
    await expect(page.getByText(/steps needed to reproduce/)).toBeVisible()
    await expect(page.getByText(/error message and a screenshot/)).toBeVisible()
    await expect(page.getByText(/browser and operating system/)).toBeVisible()
    await expect(page.getByText(/Do not include confidential/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send report' })).toHaveCount(0)
  })

  test('uploading a reference FASTA shows the filename', async ({ page }) => {
    await page.goto('/app')

    await expect(page.getByRole('button', { name: 'Choose reference file' })).toBeVisible()
    await expect(page.getByText('No file selected', { exact: true })).toBeVisible()
    const refInput = page.locator('input[type="file"][accept*=".fa"]').first()
    await refInput.setInputFiles(REFERENCE)

    await expect(page.getByText('reference.fa', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Replace file' })).toBeVisible()
    const consoleBody = page.locator('.gx-console-body')
    await expect(consoleBody).toContainText('Parameters:')
    await expect(consoleBody).toContainText('• Minimum identity: 70')
    await expect(consoleBody).not.toContainText('{"minIdentity"')
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
    await page.getByRole('button', { name: 'Float panel' }).click()
    await page.getByRole('button', { name: 'Custom Ring Overlay' }).click()
    const annotationDialog = page.getByRole('dialog', { name: 'Annotations for Ring 1' })
    await expect(annotationDialog).toBeVisible()
    const modalLayer = await annotationDialog.evaluate(element => Number(getComputedStyle(element).zIndex))
    const floatingPanelLayer = await page.getByTestId('rings-panel').evaluate(element => Number(getComputedStyle(element).zIndex))
    expect(modalLayer).toBeGreaterThan(floatingPanelLayer)
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

  test('imports Bakta GFF3 through a custom ring overlay', async ({ page }) => {
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.getByRole('button', { name: 'Custom Ring Overlay' }).click()
    await page.getByRole('button', { name: 'Import GFF3 Features' }).click()
    await page.locator('input[accept=".gff3,.gff"]').setInputFiles(BAKTA_GFF3)

    await expect(page.getByTestId('annotation-row')).toHaveCount(2)
    await expect(page.getByText(/^2 annotation\(s\) \| Reference:/)).toBeVisible()
    await expect(page.getByLabel('Companion reference annotation file')).toHaveCount(0)
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
    const productionHeaders = await fs.readFile(path.join(process.cwd(), 'public/_headers'), 'utf8')
    const contentSecurityPolicy = productionHeaders.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]
    if (!contentSecurityPolicy) throw new Error('Production Content-Security-Policy header is missing')

    await page.route('**/*', async route => {
      if (route.request().resourceType() !== 'document') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'content-security-policy': contentSecurityPolicy,
        },
      })
    })

    const pageErrors: Error[] = []
    const consoleMessages: string[] = []
    page.on('pageerror', error => pageErrors.push(error))
    page.on('console', message => consoleMessages.push(message.text()))
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.locator('input[type="file"][multiple]').setInputFiles(QUERY)

    const assetNames = ['formatdb.js', 'formatdb.wasm', 'blastall.js', 'blastall.wasm']
    const requestedAssets: string[] = []
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname
      if (assetNames.some(assetName => pathname.endsWith(`/wasm/blast/${assetName}`))) {
        requestedAssets.push(pathname)
      }
    })
    const assetResponses = assetNames.map(assetName => page.waitForResponse(
      response => {
        const url = new URL(response.url())
        return url.pathname.endsWith(`/wasm/blast/${assetName}`)
          && /^[a-f0-9]{64}$/.test(url.searchParams.get('v') ?? '')
          && response.status() === 200
      },
    ))

    await page.getByRole('button', { name: 'Run Alignments' }).click()
    await Promise.all(assetResponses)
    await expect(page.getByText('Alignments completed successfully!')).toBeVisible({ timeout: 30_000 })

    const downloadAlignment = async () => {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download', exact: true }).click()
      const download = await downloadPromise
      const downloadPath = await download.path()
      expect(downloadPath).not.toBeNull()
      return fs.readFile(downloadPath!, 'utf8')
    }
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(1)
    const freshAlignment = await downloadAlignment()
    expect(freshAlignment).toContain('#query\tsubject\t%identity')

    await page.getByRole('button', { name: 'Run Alignments' }).click()
    await expect.poll(() => consoleMessages.some(message => message.includes('Using cached alignment'))).toBe(true)
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(1)
    const cachedAlignment = await downloadAlignment()
    expect(cachedAlignment).toBe(freshAlignment)

    for (const moduleName of ['formatdb', 'blastall']) {
      const jsRequests = requestedAssets.filter(pathname => pathname.endsWith(`/wasm/blast/${moduleName}.js`))
      const wasmRequests = requestedAssets.filter(pathname => pathname.endsWith(`/wasm/blast/${moduleName}.wasm`))
      expect(jsRequests.length).toBeGreaterThan(0)
      expect(jsRequests).toHaveLength(wasmRequests.length)
    }
    expect(pageErrors).toEqual([])
  })

  test('copies an alignment error and its diagnostic context', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const formatdbPattern = '**/wasm/blast/formatdb.js*'
    const failFormatdb = (route: Route) => route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'Deliberate test failure',
    })
    await page.route(formatdbPattern, failFormatdb)
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Add New Ring' }).click()
    await page.locator('input[type="file"][multiple]').setInputFiles(QUERY)
    await page.getByRole('button', { name: 'Run Alignments' }).click()

    const errorPanel = page.getByRole('region', { name: 'Alignment error' })
    await expect(errorPanel).toBeVisible({ timeout: 30_000 })
    await expect(errorPanel).toContainText('Failed to fetch formatdb.js: 503')
    await expect(page.getByText('Alignment failed. See error details below.')).toBeVisible()
    await expect(errorPanel.getByRole('button', { name: 'Retry alignment' })).toBeVisible()
    await errorPanel.getByRole('button', { name: 'Copy error details' }).click()
    await expect(errorPanel.getByRole('button', { name: 'Copied' })).toBeVisible()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('BRIGX error\n\nFailed to fetch formatdb.js: 503')
    expect(copied).toContain('Diagnostic log')
    expect(copied).toContain('[ERROR] [Page] Alignment error:')

    await page.unroute(formatdbPattern, failFormatdb)
    await errorPanel.getByRole('button', { name: 'Retry alignment' }).click()
    await expect(page.getByText('Alignments completed successfully!')).toBeVisible({ timeout: 30_000 })
    await expect(errorPanel).toBeHidden()
  })

  test('expanded plot controls remain clickable and SVG downloads', async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 722 })
    await page.goto('/app')

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })

    const inlinePlotArea = page.getByTestId('plot-area')
    await inlinePlotArea.scrollIntoViewIfNeeded()
    const inlineCanvasBox = await inlinePlotArea.locator('canvas').boundingBox()
    expect(inlineCanvasBox).not.toBeNull()
    const dragY = Math.max(1, Math.min(721, inlineCanvasBox!.y + inlineCanvasBox!.height / 2))
    await page.mouse.move(inlineCanvasBox!.x + inlineCanvasBox!.width / 2, dragY)
    await page.mouse.down()
    await page.mouse.move(inlineCanvasBox!.x + inlineCanvasBox!.width / 2 + 180, dragY, { steps: 6 })
    await page.mouse.up()
    await expect(inlinePlotArea).not.toHaveAttribute('data-plot-pan-x', '0')

    await page.getByRole('button', { name: 'Expand plot' }).click()
    await expect(page.getByRole('button', { name: 'Shrink plot' })).toBeVisible()
    const expandedPlotArea = page.getByTestId('plot-area')
    await expect(expandedPlotArea).toHaveAttribute('data-plot-pan-x', '0')
    await expect(expandedPlotArea).toHaveAttribute('data-plot-pan-y', '0')
    await expect.poll(async () => {
      const canvasRect = await expandedPlotArea.locator('canvas').evaluate(canvas => canvas.getBoundingClientRect())
      return Math.abs(canvasRect.width - canvasRect.height)
    }).toBeLessThan(2)
    const expandedLayout = await expandedPlotArea.evaluate(element => {
      const canvas = element.querySelector('canvas')!;
      const wrapperRect = element.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        wrapperCentre: wrapperRect.left + wrapperRect.width / 2,
        canvasCentre: canvasRect.left + canvasRect.width / 2,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        wrapperBackground: getComputedStyle(element).backgroundColor,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
      };
    })
    expect(Math.abs(expandedLayout.canvasWidth - expandedLayout.canvasHeight)).toBeLessThan(2)
    expect(Math.abs(expandedLayout.wrapperCentre - expandedLayout.canvasCentre)).toBeLessThan(2)
    expect(expandedLayout.wrapperBackground).not.toBe(expandedLayout.canvasBackground)
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

  test('SVG export matches disabled GC ring controls', async ({ page }) => {
    await page.goto('/app')
    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('GC Content').uncheck()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'SVG', exact: true }).click()
    const download = await downloadPromise
    const downloadedPath = await download.path()
    expect(downloadedPath).not.toBeNull()

    const svg = await fs.readFile(downloadedPath!, 'utf8')
    expect(svg).not.toContain('id="gc-content-ring"')
    expect(svg).toContain('id="gc-skew-ring"')

    const sessionDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save session' }).click()
    const sessionDownload = await sessionDownloadPromise
    const sessionPath = await sessionDownload.path()
    expect(sessionPath).not.toBeNull()
    const session = JSON.parse(await fs.readFile(sessionPath!, 'utf8'))
    expect(session.params.showGCContent).toBe(false)
    expect(session.result.plot.reference.gcContent.length).toBeGreaterThan(0)

    await page.getByLabel('Load session').setInputFiles(sessionPath!)
    await expect(page.getByText('Session and saved result loaded.')).toBeVisible()
    await expect(page.getByLabel('GC Content')).not.toBeChecked()
    await page.getByLabel('GC Content').check()

    const restoredDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'SVG', exact: true }).click()
    const restoredDownload = await restoredDownloadPromise
    const restoredPath = await restoredDownload.path()
    expect(restoredPath).not.toBeNull()
    expect(await fs.readFile(restoredPath!, 'utf8')).toContain('id="gc-content-ring"')
  })

  test('PNG export matches the live canvas after moving a legend', async ({ page }) => {
    await page.goto('/app')
    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })

    const plotArea = page.getByTestId('plot-area')
    await plotArea.scrollIntoViewIfNeeded()
    const canvas = plotArea.locator('canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    // Move the GC legend well away from its default corner, then zoom the map.
    const scale = canvasBox!.width / 1000
    const legendX = canvasBox!.x + 60 * scale
    const legendY = canvasBox!.y + 45 * scale
    await page.mouse.move(legendX, legendY)
    await page.mouse.down()
    await page.mouse.move(legendX + 360 * scale, legendY + 260 * scale, { steps: 8 })
    await page.mouse.up()
    await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2)
    await page.mouse.wheel(0, 100)
    await page.mouse.wheel(0, 100)
    await expect(page.getByTestId('plot-zoom')).toHaveText('81%')

    // Observe the pixels handed to the PNG encoder and compare them with the
    // live canvas rendered to the same 1200 x 1200 output dimensions.
    await page.evaluate(() => {
      const originalToBlob = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (this.width === 1200 && this.height === 1200) {
          const source = document.querySelector<HTMLCanvasElement>('[data-testid="plot-area"] canvas')
          const expected = document.createElement('canvas')
          expected.width = 1200
          expected.height = 1200
          const expectedContext = expected.getContext('2d')!
          expectedContext.fillStyle = 'white'
          expectedContext.fillRect(0, 0, expected.width, expected.height)
          expectedContext.drawImage(source!, 0, 0, expected.width, expected.height)

          const expectedPixels = expectedContext.getImageData(0, 0, 1200, 1200).data
          const actualPixels = this.getContext('2d')!.getImageData(0, 0, 1200, 1200).data
          let matches = true
          for (let index = 0; index < expectedPixels.length; index += 1) {
            if (expectedPixels[index] !== actualPixels[index]) {
              matches = false
              break
            }
          }
          document.body.dataset.pngExportMatchesCanvas = String(matches)
        }
        return originalToBlob.call(this, callback, type, quality)
      }
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PNG', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^brig-plot-\d+\.png$/)
    await expect(page.locator('body')).toHaveAttribute('data-png-export-matches-canvas', 'true')
  })

  test('legend and zoom resets are separate controls', async ({ page }) => {
    await page.goto('/app')
    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Zoom in (or scroll up)' }).click()
    await page.getByRole('button', { name: 'Zoom in (or scroll up)' }).click()
    await expect(page.getByTestId('plot-zoom')).toHaveText('144%')

    await page.getByRole('button', { name: 'Reset legends' }).click()
    await expect(page.getByTestId('plot-zoom')).toHaveText('144%')

    await page.getByRole('button', { name: 'Reset zoom' }).click()
    await expect(page.getByTestId('plot-zoom')).toHaveText('100%')
  })

  test('image property sliders drag smoothly and values can be typed directly', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: 'Fonts' }).click()

    const labelFontSlider = page.getByRole('slider', { name: 'Label Font slider' })
    await expect(labelFontSlider).toHaveValue('14')

    const sliderBox = await labelFontSlider.boundingBox()
    expect(sliderBox).not.toBeNull()
    await labelFontSlider.evaluate(element => { element.dataset.dragTest = 'same-element' })
    const sliderY = sliderBox!.y + sliderBox!.height / 2
    await page.mouse.move(sliderBox!.x + sliderBox!.width * 0.6, sliderY)
    await page.mouse.down()
    await page.mouse.move(sliderBox!.x + sliderBox!.width * 0.8, sliderY, { steps: 8 })
    await expect(labelFontSlider).toHaveAttribute('data-drag-test', 'same-element')
    await page.mouse.up()

    await page.getByRole('button', { name: 'Edit Label Font value' }).click()
    const labelFontValue = page.getByRole('spinbutton', { name: 'Label Font value' })
    await expect(labelFontValue).toBeFocused()
    await labelFontValue.fill('18')
    await labelFontValue.press('Enter')

    await expect(labelFontSlider).toHaveValue('18')
    await expect(page.getByRole('button', { name: 'Edit Label Font value' })).toHaveText('18px')

    await labelFontSlider.focus()
    await labelFontSlider.press('ArrowRight')
    await expect(labelFontSlider).toHaveValue('19')
    await expect(page.getByRole('button', { name: 'Edit Label Font value' })).toHaveText('19px')
  })
})

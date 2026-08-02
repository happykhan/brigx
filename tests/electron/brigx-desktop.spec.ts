import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const REFERENCE = path.join(process.cwd(), 'tests/fixtures/reference.fa');
const QUERY = path.join(process.cwd(), 'tests/fixtures/query.fa');

test.describe.serial('BRIGX desktop', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let temporaryDirectory: string;
  const pageErrors: string[] = [];
  const securityWarnings: string[] = [];

  test.beforeAll(async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'brigx-electron-e2e-'));
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        BRIGX_E2E_USER_DATA_DIR: path.join(temporaryDirectory, 'user-data'),
      },
    });
    page = await electronApp.firstWindow();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (/Electron Security Warning/i.test(message.text())) securityWarnings.push(message.text());
    });
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await page.evaluate(() => window.brigxDesktop?.setDirtyState(false));
      await electronApp.close();
    }
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  });

  test('uses the isolated offline shell', async () => {
    expect(page.url()).toBe('brigx://app/');
    await expect(page.getByText('Offline Desktop Ring Image Generator')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Desktop project controls' })).toBeVisible();
    await expect(page.getByTestId('desktop-project-name')).toHaveText('Unsaved project');

    const rendererBoundary = await page.evaluate(() => ({
      apiVersion: window.brigxDesktop?.apiVersion,
      platform: window.brigxDesktop?.platform,
      nodeRequire: typeof (window as Window & { require?: unknown }).require,
      nodeProcess: typeof (window as Window & { process?: unknown }).process,
    }));
    expect(rendererBoundary.apiVersion).toBe(1);
    expect(rendererBoundary.platform).toBe(process.platform);
    expect(rendererBoundary.nodeRequire).toBe('undefined');
    expect(rendererBoundary.nodeProcess).toBe('undefined');

    expect(securityWarnings).toEqual([]);
  });

  test('runs BLAST, saves and reopens a project, recovers changes, and exports natively', async () => {
    const projectPath = path.join(temporaryDirectory, 'desktop-roundtrip.brigx');
    const newProjectPath = path.join(temporaryDirectory, 'new-empty-project.brigx');
    const exportPath = path.join(temporaryDirectory, 'desktop-plot.svg');

    await page.getByLabel('Reference genome file').setInputFiles(REFERENCE);
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Add New Ring' }).click();
    await page.locator('input[type="file"][multiple]').setInputFiles(QUERY);
    await page.getByRole('button', { name: 'Run Alignments' }).click();
    await expect(page.getByText('Alignments completed successfully!')).toBeVisible({ timeout: 30_000 });

    await stubSaveDialog(electronApp, projectPath);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Project saved as desktop-roundtrip\.brigx/)).toBeVisible();
    await expect(page.getByTestId('desktop-project-name')).toHaveText('desktop-roundtrip.brigx');

    const manifest = JSON.parse(await readFile(projectPath, 'utf8')) as {
      type: string;
      files: Array<{ role: string; path: string; sha256?: string }>;
      plot?: { rings?: unknown[] };
    };
    expect(manifest.type).toBe('brigx-project');
    expect(manifest.files.map(file => file.role)).toEqual(['reference', 'ring']);
    expect(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256 ?? ''))).toBe(true);
    expect(manifest.plot?.rings).toHaveLength(1);
    const originalProjectContents = await readFile(projectPath, 'utf8');

    await stubOpenDialog(electronApp, projectPath);
    await page.getByRole('button', { name: 'Open Project' }).click();
    await expect(page.getByText('Project opened')).toBeVisible();
    await expect(page.getByText('reference.fa', { exact: true })).toBeVisible();
    await expect(page.getByText('query.fa', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();

    await page.getByPlaceholder('Plot title...').fill('Recovered title');
    await expect(page.getByLabel('unsaved changes')).toBeVisible();
    await expect.poll(async () => {
      try {
        return (await stat(path.join(temporaryDirectory, 'user-data', 'recovery.brigx'))).isFile();
      } catch {
        return false;
      }
    }, { timeout: 10_000 }).toBe(true);
    await expect(page.getByRole('button', { name: 'Recover autosave' })).toBeVisible();
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: 'Recover autosave' }).click();
    await expect(page.getByText('Recovered the last autosaved session')).toBeVisible();
    await expect(page.getByPlaceholder('Plot title...')).toHaveValue('Recovered title');
    await expect(page.getByLabel('unsaved changes')).toBeVisible();

    await stubSaveDialog(electronApp, exportPath);
    await page.getByRole('button', { name: 'SVG', exact: true }).click();
    await expect(page.getByText('SVG exported successfully!')).toBeVisible();
    expect(await readFile(exportPath, 'utf8')).toContain('id="main-content"');

    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page.getByText('New project created')).toBeVisible();
    await expect(page.getByTestId('desktop-project-name')).toHaveText('Unsaved project');
    await expect(page.getByText('Load a reference genome to begin')).toBeVisible();

    await stubSaveDialog(electronApp, newProjectPath);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Project saved as new-empty-project\.brigx/)).toBeVisible();
    await expect(page.getByTestId('desktop-project-name')).toHaveText('new-empty-project.brigx');
    expect(await readFile(projectPath, 'utf8')).toBe(originalProjectContents);
    expect(JSON.parse(await readFile(newProjectPath, 'utf8')).files).toEqual([]);

    expect(pageErrors).toEqual([]);
    expect(securityWarnings).toEqual([]);
  });
});

async function stubSaveDialog(electronApp: ElectronApplication, filePath: string): Promise<void> {
  await electronApp.evaluate(({ dialog }, destination) => {
    Object.defineProperty(dialog, 'showSaveDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePath: destination }),
    });
  }, filePath);
}

async function stubOpenDialog(electronApp: ElectronApplication, filePath: string): Promise<void> {
  await electronApp.evaluate(({ dialog }, source) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [source] }),
    });
  }, filePath);
}

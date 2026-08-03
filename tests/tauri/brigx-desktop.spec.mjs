/* global process, describe, before, after, it, window, document */
import { browser, $, expect } from '@wdio/globals';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const testRoot = process.env.BRIGX_E2E_ROOT;
if (!testRoot) throw new Error('BRIGX_E2E_ROOT is not configured');

const projectPath = path.join(testRoot, 'desktop-roundtrip.brigx');
const newProjectPath = path.join(testRoot, 'new-empty-project.brigx');
const exportPath = path.join(testRoot, 'desktop-plot.svg');
const recoveryPath = path.join(testRoot, 'user-data', 'recovery.brigx');

describe('BRIGX Tauri desktop', () => {
  before(async () => {
    await mkdir(testRoot, { recursive: true });
    await browser.waitUntil(async () => (
      browser.execute(() => document.readyState === 'complete')
    ), { timeout: 30_000, timeoutMsg: 'BRIGX did not finish loading' });
    await browser.execute(() => {
      window.__brigxE2eErrors = [];
      window.__brigxE2eConsoleErrors = [];
      window.__brigxE2eRecoveryCalls = [];
      window.confirm = () => true;
      const browserConsole = globalThis.console;
      const originalConsoleError = browserConsole.error.bind(browserConsole);
      browserConsole.error = (...values) => {
        window.__brigxE2eConsoleErrors.push(values.map(String).join(' '));
        originalConsoleError(...values);
      };
      const desktop = window.brigxDesktop;
      if (desktop) {
        const saveRecoverySnapshot = desktop.saveRecoverySnapshot.bind(desktop);
        desktop.saveRecoverySnapshot = async request => {
          try {
            await saveRecoverySnapshot(request);
            window.__brigxE2eRecoveryCalls.push('ok');
          } catch (error) {
            window.__brigxE2eRecoveryCalls.push(String(error));
            throw error;
          }
        };
      }
      window.addEventListener('error', event => {
        window.__brigxE2eErrors.push(event.error?.message ?? event.message);
      });
      window.addEventListener('unhandledrejection', event => {
        window.__brigxE2eErrors.push(String(event.reason));
      });
    });
  });

  after(async () => {
    await browser.execute(async () => {
      await window.brigxDesktop?.setDirtyState(false);
    });
  });

  it('uses an isolated, least-privilege system-webview shell', async () => {
    const url = await browser.getUrl();
    expect(
      url === 'tauri://localhost'
        || url.startsWith('tauri://localhost/')
        || url.startsWith('http://tauri.localhost/'),
    ).toBe(true);
    await expect($('h1=BRIGX')).toBeDisplayed();
    await expect($('nav[aria-label="Desktop project controls"]')).toBeDisplayed();
    await expect($('footer[aria-label="Application status"]')).toBeDisplayed();
    await expect($('[data-testid="desktop-project-name"]')).toHaveText('Unsaved project');
    expect((await browser.$$('.gx-nav')).length).toBe(0);
    expect((await browser.$$('.gx-footer')).length).toBe(0);
    expect(await browser.getTitle()).toContain('BRIGX Desktop Beta');

    const boundary = await browser.execute(() => ({
      apiVersion: window.brigxDesktop?.apiVersion,
      platform: window.brigxDesktop?.platform,
      versions: window.brigxDesktop?.versions,
      nodeRequire: typeof window.require,
      nodeProcess: typeof window.process,
      hasTauriInternals: typeof window.__TAURI_INTERNALS__ === 'object',
    }));
    expect(boundary.apiVersion).toBe(1);
    expect(boundary.platform).toBe(process.platform);
    expect(boundary.versions.tauri).toBe('2.11');
    expect(boundary.versions.webview).toContain('(system)');
    expect(boundary.nodeRequire).toBe('undefined');
    expect(boundary.nodeProcess).toBe('undefined');
    expect(boundary.hasTauriInternals).toBe(true);

    const rejected = await browser.tauri.execute(async ({ core }) => {
      const errors = [];
      for (const [command, args] of [
        ['read_input_file', { token: 'not-a-token' }],
        ['open_external', { url: 'http://example.com' }],
        ['plugin:dialog|open', { options: {} }],
      ]) {
        try {
          await core.invoke(command, args);
          errors.push('unexpected success');
        } catch (error) {
          errors.push(String(error));
        }
      }
      return errors;
    });
    expect(rejected[0]).toContain('Invalid file token');
    expect(rejected[1]).toContain('Only HTTPS and mailto');
    expect(rejected[2]).toMatch(/not allowed|denied|permission/i);
  });

  it('runs WASM BLAST, round-trips a project, recovers, and exports', async () => {
    await $('aria/Reference genome file').click();
    await expect($('h2=Statistics')).toBeDisplayed({ wait: 30_000 });
    await $('button=+ Add New Ring').click();
    await $('aria/Add files to Ring 1').click();
    const runAlignments = await $('button=Run Alignments');
    await runAlignments.click();
    await expect($('h3=Query Genome Coverage')).toBeDisplayed({ wait: 60_000 });
    await expect(runAlignments).toBeEnabled({ wait: 60_000 });

    await $('button=Save').click();
    await waitForText('Project saved as desktop-roundtrip.brigx');
    await expect($('[data-testid="desktop-project-name"]')).toHaveText('desktop-roundtrip.brigx');
    await waitForFile(projectPath);

    const manifest = JSON.parse(await readFile(projectPath, 'utf8'));
    expect(manifest.type).toBe('brigx-project');
    expect(manifest.files.map(file => file.role)).toEqual(['reference', 'ring']);
    expect(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256 ?? ''))).toBe(true);
    expect(manifest.plot?.rings).toHaveLength(1);
    const originalProjectContents = await readFile(projectPath, 'utf8');

    await $('button=Open Project').click();
    await waitForText('Project opened');
    await expect($('div=reference.fa')).toBeDisplayed();
    await expect($('span=query.fa')).toBeDisplayed();
    await expect($('h2=Statistics')).toBeDisplayed();

    await $('input[placeholder="Plot title..."]').setValue('Recovered title');
    await expect($('[aria-label="unsaved changes"]')).toBeDisplayed();
    await browser.pause(2_500);
    expect(await browser.execute(() => window.__brigxE2eConsoleErrors ?? [])).toEqual([]);
    expect(await browser.execute(() => window.__brigxE2eRecoveryCalls ?? [])).toEqual(['ok']);
    await waitForFile(recoveryPath, 15_000);
    await expect($('button=Recover autosave')).toBeDisplayed();
    await $('button=Recover autosave').click();
    await waitForText('Recovered the last autosaved session');
    await expect($('input[placeholder="Plot title..."]')).toHaveValue('Recovered title');
    await expect($('[aria-label="unsaved changes"]')).toBeDisplayed();

    await $('button=SVG').click();
    await waitForText('SVG exported successfully!');
    await waitForFile(exportPath);
    expect(await readFile(exportPath, 'utf8')).toContain('id="main-content"');

    await $('button=New Project').click();
    await waitForText('New project created');
    await expect($('[data-testid="desktop-project-name"]')).toHaveText('Unsaved project');
    await waitForText('Load a reference genome to begin');

    await $('button=Save').click();
    await waitForText('Project saved as new-empty-project.brigx');
    await expect($('[data-testid="desktop-project-name"]')).toHaveText('new-empty-project.brigx');
    await waitForFile(newProjectPath);
    expect(await readFile(projectPath, 'utf8')).toBe(originalProjectContents);
    expect(JSON.parse(await readFile(newProjectPath, 'utf8')).files).toEqual([]);

    const pageErrors = await browser.execute(() => window.__brigxE2eErrors ?? []);
    expect(pageErrors).toEqual([]);
    const consoleErrors = await browser.execute(() => window.__brigxE2eConsoleErrors ?? []);
    expect(consoleErrors).toEqual([]);
  });
});

async function waitForText(text, timeout = 30_000) {
  await browser.waitUntil(
    () => browser.execute(value => document.body.innerText.includes(value), text),
    { timeout, timeoutMsg: `Expected page text was not displayed: ${text}` },
  );
}

async function waitForFile(filename, timeout = 10_000) {
  await browser.waitUntil(async () => {
    try {
      return (await stat(filename)).isFile();
    } catch {
      return false;
    }
  }, { timeout, timeoutMsg: `${filename} was not created` });
}

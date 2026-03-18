const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

const appRoot = path.resolve(__dirname, '..', '..');
const sampleCvPath = path.join(appRoot, 'samples', 'sample-cv.txt');
const sampleJdPath = path.join(appRoot, 'samples', 'sample-jd.txt');
const structuredCvPath = path.join(appRoot, 'samples', 'structured-cv.txt');
const defaultSystemPrompt =
  'You are an executive search recruiter assistant. Produce grounded, evidence-based candidate profile summaries for hiring managers. Do not invent facts. Call out strengths and gaps clearly.';

test.describe('Candidate Match Workbench', () => {
  let electronApp;
  let page;
  let userDataPath;

  test.beforeEach(async () => {
    userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-playwright-'));
    await fs.writeFile(
      path.join(userDataPath, 'llm-settings.json'),
      JSON.stringify({
        providerId: 'deepseek',
        providerLabel: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        apiKeyMode: 'plain',
        apiKey: 'playwright-test-key',
        temperature: 0.2,
        maxTokens: 1200,
        systemPrompt: defaultSystemPrompt,
        outputTemplatePath: '',
        outputTemplateName: '',
        outputTemplateExtension: ''
      }),
      'utf8'
    );

    electronApp = await electron.launch({
      args: ['.'],
      cwd: appRoot,
      env: {
        ...process.env,
        ELECTRON_USER_DATA_PATH: userDataPath
      }
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }

    if (userDataPath) {
      await fs.rm(userDataPath, { recursive: true, force: true });
    }
  });

  test('opens on the summary-first workbench and supports main review tabs', async () => {
    await expect(page.locator('#workbench-view')).toBeVisible();
    await expect(page.locator('#summary-panel')).toBeVisible();
    await expect(page.locator('#briefing-panel')).toBeHidden();
    await expect(page.locator('#cv-panel')).toBeHidden();
    await expect(page.locator('#jd-panel')).toBeHidden();
    await expect(page.locator('#source-panel-status')).toHaveText(/Awaiting Documents/);
    await expect(page.locator('#summary-editor')).toHaveAttribute('contenteditable', 'true');

    await page.locator('#open-briefing-tab').click();
    await expect(page.locator('#briefing-panel')).toBeVisible();
    await expect(page.locator('#summary-panel')).toBeHidden();

    await page.locator('#open-cv-tab').click();
    await expect(page.locator('#cv-panel')).toBeVisible();
    await expect(page.locator('#briefing-panel')).toBeHidden();
    await expect(page.locator('#cv-preview-text')).toHaveClass(/rich-document/);

    await page.locator('#open-jd-tab').click();
    await expect(page.locator('#jd-panel')).toBeVisible();
    await expect(page.locator('#cv-panel')).toBeHidden();

    await page.locator('#open-summary-tab').click();
    await expect(page.locator('#summary-panel')).toBeVisible();
    await expect(page.locator('#jd-panel')).toBeHidden();
  });

  test('opens settings and switches between LLM and template configuration tabs', async () => {
    await page.locator('#open-settings-view').click();
    await expect(page.locator('#settings-view')).toBeVisible();
    await expect(page.locator('#llm-settings-panel')).toBeVisible();

    await page.locator('#open-template-settings-tab').click();
    await expect(page.locator('#template-settings-panel')).toBeVisible();
    await expect(page.locator('#llm-settings-panel')).toBeHidden();

    await page.locator('#open-llm-settings-tab').click();
    await expect(page.locator('#llm-settings-panel')).toBeVisible();
    await expect(page.locator('#template-settings-panel')).toBeHidden();

    await page.locator('#return-to-workbench-button').click();
    await expect(page.locator('#workbench-view')).toBeVisible();
    await expect(page.locator('#summary-panel')).toBeVisible();
  });

  test('keeps long-form reading inside the main panels and keeps generation progress available in the summary view', async () => {
    const layout = await page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      const summaryEditorStyle = window.getComputedStyle(document.getElementById('summary-editor'));
      const cvReaderStyle = window.getComputedStyle(document.getElementById('cv-preview-text'));
      const jdReaderStyle = window.getComputedStyle(document.getElementById('jd-preview-text'));
      const progress = document.getElementById('generation-progress');

      return {
        bodyOverflow: bodyStyle.overflow,
        summaryOverflowY: summaryEditorStyle.overflowY,
        cvOverflowY: cvReaderStyle.overflowY,
        jdOverflowY: jdReaderStyle.overflowY,
        progressExists: Boolean(progress),
        progressHidden: progress?.classList.contains('is-hidden') || false
      };
    });

    expect(layout.bodyOverflow).toBe('hidden');
    expect(layout.summaryOverflowY).toBe('auto');
    expect(layout.cvOverflowY).toBe('auto');
    expect(layout.jdOverflowY).toBe('auto');
    expect(layout.progressExists).toBe(true);
    expect(layout.progressHidden).toBe(true);
  });

  test('accepts Finder-style file URI drops for source intake', async () => {
    await page.locator('#cv-card').evaluate((element, fileUri) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/uri-list', fileUri);
      element.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
      }));
    }, pathToFileURL(sampleCvPath).href);

    await expect(page.locator('#cv-file-pill')).toHaveText(/sample-cv\.txt/i);

    await page.locator('#dropzone').evaluate((element, fileUris) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/uri-list', fileUris);
      element.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
      }));
    }, [
      pathToFileURL(sampleCvPath).href,
      pathToFileURL(sampleJdPath).href
    ].join('\n'));

    await expect(page.locator('#cv-file-pill')).toHaveText(/sample-cv\.txt/i);
    await expect(page.locator('#jd-file-pill')).toHaveText(/sample-jd\.txt/i);
    await expect(page.locator('#source-panel-status')).toHaveText(/Ready to Generate/);
  });

  test('renders structured CV experience entries without turning every short line into a heading', async () => {
    await page.locator('#cv-card').evaluate((element, fileUri) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/uri-list', fileUri);
      element.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
      }));
    }, pathToFileURL(structuredCvPath).href);

    await page.locator('#open-cv-tab').click();

    await expect(page.locator('#cv-preview-text .cv-entry-title')).toHaveCount(2);
    await expect(page.locator('#cv-preview-text .cv-entry-title').first()).toHaveText(/Director of Product/i);
    await expect(page.locator('#cv-preview-text .cv-entry-meta').first()).toHaveText(/Atom Search Partners.*2022 - Present/i);
    await expect(page.locator('#cv-preview-text h3')).toHaveText(['Employment Experience', 'Education', 'Skills']);
  });
});

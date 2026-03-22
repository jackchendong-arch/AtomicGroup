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
const sampleWorkspacePath = path.join(appRoot, 'samples', 'role-workspace');
const sampleWorkspaceJdPath = path.join(sampleWorkspacePath, 'JD-role.txt');
const sampleWorkspaceAlexCvPath = path.join(sampleWorkspacePath, 'CV-alex.txt');
const sampleWorkspaceJordanCvPath = path.join(sampleWorkspacePath, 'CV-jordan.txt');
const smallWorkspacePath = path.join(appRoot, 'samples', 'two-file-workspace');
const smallWorkspaceJdPath = path.join(smallWorkspacePath, 'JD-small.txt');
const smallWorkspaceCvPath = path.join(smallWorkspacePath, 'CV-small.txt');
const defaultSystemPrompt =
  'You are an executive search recruiter assistant. Produce grounded, evidence-based candidate profile summaries for hiring managers. Do not invent facts. Call out strengths and gaps clearly.';

function getSlowMoMs() {
  const parsedValue = Number.parseInt(process.env.E2E_SLOW_MO_MS || '0', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

async function dispatchUriDrop(page, selector, filePaths) {
  const uriList = filePaths.map((filePath) => pathToFileURL(filePath).href).join('\n');
  await page.locator(selector).evaluate((element, payload) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/uri-list', payload);
    element.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer
    }));
  }, uriList);
}

async function openSourceFolderViaTestApi(page, folderPath) {
  await page.evaluate(async (nextFolderPath) => {
    await window.__atomicgroupTest.openSourceFolder(nextFolderPath);
  }, folderPath);
}

async function getSummaryEditorText(page) {
  return page.locator('#summary-editor').innerText();
}

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
        apiKeyMode: 'empty',
        apiKey: '',
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
      slowMo: getSlowMoMs(),
      env: {
        ...process.env,
        ELECTRON_USER_DATA_PATH: userDataPath,
        ATOMICGROUP_E2E_MOCK_LLM: '1',
        ATOMICGROUP_E2E_TEST_API: '1',
        ATOMICGROUP_E2E_IMPORT_DELAY_MS: '250'
      }
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(window.recruitmentApi));
    await page.evaluate(async (systemPrompt) => {
      await window.recruitmentApi.saveLlmSettings({
        providerId: 'deepseek',
        providerLabel: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        apiKey: 'test-only-placeholder',
        temperature: 0.2,
        maxTokens: 1200,
        systemPrompt,
        referenceTemplateMode: 'default',
        referenceTemplatePath: '',
        referenceTemplateName: '',
        referenceTemplateExtension: '',
        outputTemplatePath: '',
        outputTemplateName: '',
        outputTemplateExtension: '',
        outputBriefingFolderPath: ''
      });
    }, defaultSystemPrompt);
    await page.evaluate(async () => {
      await window.__atomicgroupTest.reloadConfiguration();
    });
    await page.locator('#return-to-workbench-button').click();
    await expect(page.locator('#workbench-view')).toBeVisible();
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }

    if (userDataPath) {
      await fs.rm(userDataPath, { recursive: true, force: true });
    }
  });

  test('opens on the summary-first workbench and supports settings navigation', async () => {
    await expect(page.locator('#workbench-view')).toBeVisible();
    await expect(page.locator('#summary-panel')).toBeVisible();
    await expect(page.locator('#briefing-panel')).toBeHidden();
    await expect(page.locator('#cv-panel')).toBeHidden();
    await expect(page.locator('#jd-panel')).toBeHidden();
    await expect(page.locator('#summary-message')).toHaveText(/Load the CV and JD/i);
    await expect(page.locator('#generation-progress')).toHaveClass(/is-hidden/);

    await page.locator('#open-briefing-tab').click();
    await expect(page.locator('#briefing-panel')).toBeVisible();

    await page.locator('#open-settings-view').click();
    await expect(page.locator('#settings-view')).toBeVisible();
    await expect(page.locator('#llm-settings-panel')).toBeVisible();

    await page.locator('#open-summary-guidance-settings-tab').click();
    await expect(page.locator('#summary-guidance-settings-panel')).toBeVisible();

    await page.locator('#open-word-template-settings-tab').click();
    await expect(page.locator('#word-template-settings-panel')).toBeVisible();

    await page.locator('#return-to-workbench-button').click();
    await expect(page.locator('#workbench-view')).toBeVisible();
    await page.locator('#open-summary-tab').click();
    await expect(page.locator('#summary-panel')).toBeVisible();
  });

  test('supports manual import, deterministic generation, evidence, translation, and recent-work reopen', async () => {
    await page.locator('#open-manual-context-tab').click();
    await dispatchUriDrop(page, '#dropzone', [sampleCvPath, sampleJdPath]);

    await expect(page.locator('#cv-preview-status')).toHaveText(/Ready/i);
    await expect(page.locator('#jd-preview-status')).toHaveText(/Ready/i);
    await expect(page.locator('#current-context-panel')).toBeVisible();
    await expect(page.locator('#current-role-name')).toContainText('Senior Product Manager');
    await expect(page.locator('#current-candidate-name')).toContainText('Jordan Lee');

    await page.locator('#open-briefing-tab').click();
    await expect(page.locator('#briefing-panel')).toBeVisible();
    await page.locator('#generate-summary-button').click();
    await expect(page.locator('#summary-status')).toHaveText('Ready');
    await expect(page.locator('#briefing-panel')).toBeVisible();
    await expect(page.locator('#briefing-status')).toHaveText('Ready');
    await expect(page.locator('#briefing-preview')).toContainText('Jordan Lee');
    await expect(page.locator('#summary-message')).toHaveText(/ready/i);
    await expect(page.locator('#summary-editor')).toContainText('Jordan Lee');
    await expect(page.locator('#summary-editor')).toContainText('Senior Product Manager');

    await page.locator('#open-summary-tab').click();
    await expect(page.locator('#summary-evidence-panel')).not.toHaveClass(/is-hidden/);
    await page.locator('#summary-evidence-panel summary').click();
    await expect(page.locator('#summary-evidence-summary-list .evidence-item').first()).toBeVisible();

    await page.locator('#toggle-output-language-button').click();
    await expect(page.locator('#summary-status')).toHaveText('Ready');
    await expect(page.locator('#summary-editor')).toContainText('Jordan Lee');
    await expect(page.locator('#summary-editor')).toContainText(/候选人|匹配|下一步/);
    await expect(page.locator('#briefing-preview')).toContainText(/候选人|目标岗位|简报/);

    await page.locator('#reset-workspace-button').click();
    await expect(page.locator('#current-context-panel')).toHaveClass(/is-hidden/);

    await page.locator('#open-recent-context-tab').click();
    await expect(page.locator('#recent-work-list .recent-work-item').first()).toContainText('Jordan Lee');
    await page.locator('#recent-work-list .recent-work-item').first().click();

    await expect(page.locator('#current-context-panel')).toBeVisible();
    await expect(page.locator('#current-candidate-name')).toContainText('Jordan Lee');
    await expect(page.locator('#summary-status')).toHaveText(/Ready|Approved/);
    await expect(page.locator('#summary-editor')).toContainText('Jordan Lee');
  });

  test('supports role workspace candidate switching without stale previews', async () => {
    await openSourceFolderViaTestApi(page, sampleWorkspacePath);

    await expect(page.locator('#source-folder-name')).toContainText('role-workspace');
    await expect(page.locator('#current-context-panel')).toBeVisible();
    await expect(page.locator('#current-role-name')).toContainText('Senior Product Manager');

    await expect(page.locator('#source-folder-jd-select')).toHaveValue(sampleWorkspaceJdPath);
    await page.locator('#source-folder-cv-select').selectOption(sampleWorkspaceAlexCvPath);
    await expect(page.locator('#current-candidate-name')).toContainText('Alex Tan');

    await page.locator('#open-cv-tab').click();
    await expect(page.locator('#cv-preview-text')).toContainText('Alex Tan');
    await expect(page.locator('#cv-preview-text')).toContainText('Director of Product');

    await page.locator('#source-folder-cv-select').selectOption(sampleWorkspaceJordanCvPath);
    await expect(page.locator('#current-context-panel')).toHaveClass(/is-hidden/);
    await expect(page.locator('#current-candidate-name')).toContainText('Jordan Lee');
    await expect(page.locator('#cv-preview-text')).toContainText('Jordan Lee');
    await expect(page.locator('#cv-preview-text')).not.toContainText('Alex Tan');

    await page.locator('#generate-summary-button').click();
    await expect(page.locator('#summary-status')).toHaveText('Ready');
    await expect(page.locator('#open-summary-tab')).toBeVisible();
    await expect(page.locator('#summary-editor')).toContainText('Jordan Lee');
    await expect(page.locator('#summary-editor')).not.toContainText('Alex Tan');
  });

  test('recovers correctly when a two-file workspace is temporarily assigned into the wrong JD/CV slots', async () => {
    await openSourceFolderViaTestApi(page, smallWorkspacePath);

    await expect(page.locator('#source-folder-jd-select')).toHaveValue(smallWorkspaceJdPath);
    await expect(page.locator('#source-folder-cv-select')).toHaveValue(smallWorkspaceCvPath);
    await expect(page.locator('#current-candidate-name')).toContainText('Jordan Lee');

    await page.locator('#source-folder-jd-select').selectOption(smallWorkspaceCvPath);
    await expect(page.locator('#source-folder-cv-select')).toHaveValue(smallWorkspaceJdPath);

    await page.locator('#source-folder-jd-select').selectOption(smallWorkspaceJdPath);
    await expect(page.locator('#source-folder-cv-select')).toHaveValue(smallWorkspaceCvPath);
    await expect(page.locator('#current-candidate-name')).toContainText('Jordan Lee');

    await page.locator('#open-cv-tab').click();
    await expect(page.locator('#cv-preview-text')).toContainText('Jordan Lee');
    await expect(page.locator('#cv-preview-text')).not.toContainText('Senior Product Manager, Recruitment Intelligence');
  });

  test('renders structured CV experience entries without turning every short line into a heading', async () => {
    await page.locator('#open-manual-context-tab').click();
    await dispatchUriDrop(page, '#dropzone', [structuredCvPath]);

    await page.locator('#open-cv-tab').click();

    await expect(page.locator('#cv-preview-text .cv-entry-title')).toHaveCount(2);
    await expect(page.locator('#cv-preview-text .cv-entry-title').first()).toHaveText(/Director of Product/i);
    await expect(page.locator('#cv-preview-text .cv-entry-meta').first()).toHaveText(/Atom Search Partners.*2022 - Present/i);
    await expect(page.locator('#cv-preview-text h3')).toHaveText(['Employment Experience', 'Education', 'Skills']);
  });

  test('keeps long-form reading inside the main panels', async () => {
    const layout = await page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      const summaryEditorStyle = window.getComputedStyle(document.getElementById('summary-editor'));
      const cvReaderStyle = window.getComputedStyle(document.getElementById('cv-preview-text'));
      const jdReaderStyle = window.getComputedStyle(document.getElementById('jd-preview-text'));

      return {
        bodyOverflow: bodyStyle.overflow,
        summaryOverflowY: summaryEditorStyle.overflowY,
        cvOverflowY: cvReaderStyle.overflowY,
        jdOverflowY: jdReaderStyle.overflowY
      };
    });

    expect(layout.bodyOverflow).toBe('hidden');
    expect(layout.summaryOverflowY).toBe('auto');
    expect(layout.cvOverflowY).toBe('auto');
    expect(layout.jdOverflowY).toBe('auto');
  });
});

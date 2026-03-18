const { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('path');

const { importDocument, SUPPORTED_EXTENSIONS } = require('./services/document-service');
const {
  buildSuggestedOutputFilename,
  describeEmploymentExtraction,
  renderHiringManagerWordDocument
} = require('./services/hiring-manager-template-service');
const {
  buildBriefingRequest,
  buildFallbackBriefing,
  mergeBriefingWithFallback,
  parseBriefingResponse,
  prepareHiringManagerBriefingOutput,
  validateBriefing
} = require('./services/briefing-service');
const { generateWithConfiguredProvider, getProviderOptions } = require('./services/llm-service');
const { LlmSettingsStore, validateSettings } = require('./services/llm-settings-service');
const {
  buildSummaryRequest,
  normalizeGeneratedSummary
} = require('./services/summary-service');

let settingsStore;
const EXPORT_DEBUG_LOG_PATH = path.join(__dirname, 'debug', 'word-draft-export.log');

function expandHomeDirectory(filePath) {
  if (typeof filePath !== 'string') {
    return filePath;
  }

  if (filePath === '~') {
    return app.getPath('home');
  }

  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(app.getPath('home'), filePath.slice(2));
  }

  return filePath;
}

async function pathPointsToDirectory(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function resolveWordDraftOutputPath(filePath, suggestedName) {
  const expandedPath = expandHomeDirectory(filePath);

  if (await pathPointsToDirectory(expandedPath)) {
    return path.join(expandedPath, suggestedName);
  }

  const extension = path.extname(expandedPath).toLowerCase();

  if (extension === '.docx') {
    return expandedPath;
  }

  if (extension === '.dotx') {
    return `${expandedPath.slice(0, -extension.length)}.docx`;
  }

  return `${expandedPath}.docx`;
}

async function appendExportDebugLog(lines) {
  const content = [
    `=== ${new Date().toISOString()} ===`,
    ...lines,
    ''
  ].join('\n');

  await fs.mkdir(path.dirname(EXPORT_DEBUG_LOG_PATH), { recursive: true });
  await fs.appendFile(EXPORT_DEBUG_LOG_PATH, `${content}\n`, 'utf8');
}

function getSettingsStore() {
  if (!settingsStore) {
    const userDataPath = process.env.ELECTRON_USER_DATA_PATH &&
      process.env.ELECTRON_USER_DATA_PATH.trim()
      ? path.resolve(process.env.ELECTRON_USER_DATA_PATH)
      : app.getPath('userData');

    settingsStore = new LlmSettingsStore({
      userDataPath,
      safeStorage
    });
  }

  return settingsStore;
}

async function prepareWordDraftTemplateData({ payload, settings, debugTrace }) {
  const validation = validateSettings(settings);

  if (!validation.isValid) {
    debugTrace.push(`Settings validation failed: ${validation.errors.join(' | ')}`);
    throw new Error(validation.errors.join(' '));
  }

  if (!settings.outputTemplatePath) {
    debugTrace.push('No configured Word template path was available.');
    throw new Error('Configure a Word .docx or .dotx template before exporting the hiring-manager draft.');
  }

  if (!['.docx', '.dotx'].includes(settings.outputTemplateExtension)) {
    debugTrace.push(`Unsupported template extension: ${settings.outputTemplateExtension}`);
    throw new Error('Only .docx and .dotx hiring-manager templates are supported for automated output.');
  }

  if (!payload.summary || !payload.summary.trim()) {
    debugTrace.push('Summary payload was empty at export time.');
    throw new Error('Generate and review the recruiter summary before exporting the hiring-manager draft.');
  }

  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const requestedBriefing = payload.briefing
    ? mergeBriefingWithFallback(payload.briefing, fallbackBriefing)
    : fallbackBriefing;
  let composedOutput;

  try {
    composedOutput = prepareHiringManagerBriefingOutput({
      briefing: requestedBriefing,
      recruiterSummary: payload.summary
    });
  } catch (error) {
    debugTrace.push(`Structured briefing validation failed: ${error instanceof Error ? error.message : 'Unknown validation failure.'}`);
    throw error;
  }

  const templateData = composedOutput.templateData;
  const employmentDebug = describeEmploymentExtraction(payload.cvDocument);
  debugTrace.push(`Configured template: ${settings.outputTemplatePath}`);
  debugTrace.push(`Template extension: ${settings.outputTemplateExtension}`);
  debugTrace.push(`CV source file: ${employmentDebug.cvFileName || '(unknown)'}`);
  debugTrace.push(`CV line count: ${employmentDebug.cvLineCount}`);
  debugTrace.push(`Experience section line count: ${employmentDebug.experienceSectionLineCount}`);

  if (employmentDebug.experienceSectionPreview.length > 0) {
    debugTrace.push(`Experience section preview: ${employmentDebug.experienceSectionPreview.join(' || ')}`);
  }

  employmentDebug.dateWindows.forEach((window, index) => {
    debugTrace.push(`CV date window ${index + 1}: ${window}`);
  });

  debugTrace.push(`Derived candidate name: ${templateData.candidate_name}`);
  debugTrace.push(`Derived role title: ${templateData.role_title}`);
  debugTrace.push(`Derived employment history count: ${templateData.employment_history.length}`);

  templateData.employment_history.forEach((entry, index) => {
    debugTrace.push(
      `Employment entry ${index + 1}: title="${entry.job_title || ''}" company="${entry.company_name || ''}" dates="${[entry.start_date, entry.end_date].filter(Boolean).join(' - ')}" responsibilities=${entry.responsibilities.length}`
    );

    entry.responsibilities.forEach((responsibility, responsibilityIndex) => {
      debugTrace.push(
        `Employment entry ${index + 1} responsibility ${responsibilityIndex + 1}: ${responsibility.responsibility || ''}`
      );
    });
  });

  debugTrace.push(`Summary length: ${payload.summary.trim().length} characters`);

  return {
    templateData,
    suggestedName: buildSuggestedOutputFilename(templateData)
  };
}

async function writeWordDraftToPath({ settings, outputPath, templateData, debugTrace }) {
  const renderResult = await renderHiringManagerWordDocument({
    templatePath: settings.outputTemplatePath,
    outputPath,
    templateData
  });

  debugTrace.push('Word template rendered successfully.');
  debugTrace.push(`Template placeholders populated: ${renderResult.populatedTemplateTags.map((tag) => `{{${tag}}}`).join(', ') || '(none)'}`);

  if (renderResult.blankTemplateTags.length > 0) {
    debugTrace.push(`Template placeholders left blank: ${renderResult.blankTemplateTags.map((tag) => `{{${tag}}}`).join(', ')}`);
  }

  await fs.access(outputPath);
  const stat = await fs.stat(outputPath);
  debugTrace.push(`File write verified: yes (${stat.size} bytes)`);

  return {
    filePath: outputPath,
    templateName: settings.outputTemplateName,
    debugLogPath: EXPORT_DEBUG_LOG_PATH,
    debugTrace
  };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#eef2f3',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('document:pick', async (_event, { slot }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: slot === 'jd' ? 'Select job description' : 'Select candidate CV',
    properties: ['openFile'],
    filters: [
      {
        name: 'Supported documents',
        extensions: [...SUPPORTED_EXTENSIONS].map((extension) => extension.replace('.', ''))
      }
    ]
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const filePath = filePaths[0];
  return importDocument(filePath);
});

ipcMain.handle('document:import', async (_event, { filePath }) => {
  return importDocument(filePath);
});

ipcMain.handle('llm:get-providers', async () => {
  return getProviderOptions();
});

ipcMain.handle('llm:load-settings', async () => {
  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);

  return {
    settings,
    validation
  };
});

ipcMain.handle('llm:save-settings', async (_event, payload) => {
  return getSettingsStore().save(payload);
});

ipcMain.handle('template:pick-word-template', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select hiring manager Word template (.docx or .dotx)',
    properties: ['openFile'],
    filters: [
      {
        name: 'Word templates',
        extensions: ['docx', 'dotx']
      }
    ]
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const filePath = filePaths[0];
  const extension = path.extname(filePath).toLowerCase();

  return {
    path: filePath,
    name: path.basename(filePath),
    extension
  };
});

ipcMain.handle('hiring-manager:export-word-draft', async (_event, payload) => {
  const debugTrace = [
    `Export started at ${new Date().toISOString()}`
  ];

  const settings = await getSettingsStore().load();
  let templateData;
  let suggestedName;

  try {
    ({ templateData, suggestedName } = await prepareWordDraftTemplateData({
      payload,
      settings,
      debugTrace
    }));
  } catch (error) {
    await appendExportDebugLog(debugTrace);
    throw new Error(`${error instanceof Error ? error.message : 'Unable to prepare the hiring-manager draft.'}\nDebug trace:\n- ${debugTrace.join('\n- ')}`);
  }

  debugTrace.push(`Suggested output filename: ${suggestedName}`);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save hiring-manager Word draft',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [
      {
        name: 'Word documents',
        extensions: ['docx']
      }
    ]
  });
  debugTrace.push(`Save dialog canceled: ${canceled ? 'yes' : 'no'}`);
  debugTrace.push(`Save dialog returned path: ${filePath || '(none)'}`);

  if (canceled || !filePath) {
    await appendExportDebugLog(debugTrace);
    return {
      canceled: true,
      debugTrace
    };
  }

  const outputPath = await resolveWordDraftOutputPath(filePath, suggestedName);
  debugTrace.push(`Resolved output path: ${outputPath}`);

  try {
    const result = await writeWordDraftToPath({
      settings,
      outputPath,
      templateData,
      debugTrace
    });
    shell.showItemInFolder(outputPath);
    debugTrace.push('Finder reveal requested.');
    debugTrace.push(`Debug log path: ${EXPORT_DEBUG_LOG_PATH}`);
    await appendExportDebugLog(debugTrace);

    return {
      canceled: false,
      ...result
    };
  } catch (error) {
    debugTrace.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown export failure.'}`);
    debugTrace.push(`Debug log path: ${EXPORT_DEBUG_LOG_PATH}`);
    await appendExportDebugLog(debugTrace);
    throw new Error(
      `${error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'}\nDebug trace:\n- ${debugTrace.join('\n- ')}`
    );
  }
});

ipcMain.handle('summary:generate', async (_event, payload) => {
  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const summaryRequest = buildSummaryRequest({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    systemPrompt: settings.systemPrompt
  });
  const briefingRequest = buildBriefingRequest({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    systemPrompt: settings.systemPrompt
  });
  const [summaryResult, structuredBriefingResult] = await Promise.all([
    generateWithConfiguredProvider({
      settings,
      messages: summaryRequest.messages,
      fetchImpl: (...args) => net.fetch(...args)
    }),
    generateWithConfiguredProvider({
      settings,
      messages: briefingRequest.messages,
      fetchImpl: (...args) => net.fetch(...args)
    })
  ]);
  const recruiterSummary = normalizeGeneratedSummary(summaryResult.text);

  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  let briefing;

  try {
    briefing = mergeBriefingWithFallback(parseBriefingResponse(structuredBriefingResult.text), fallbackBriefing);
  } catch (_error) {
    briefing = fallbackBriefing;
  }

  const briefingValidation = validateBriefing(briefing);

  if (!briefingValidation.isValid) {
    throw new Error(briefingValidation.errors.join(' '));
  }

  const validatedBriefing = briefingValidation.briefing;
  const hiringManagerBriefing = prepareHiringManagerBriefingOutput({
    briefing: validatedBriefing,
    recruiterSummary
  });

  return {
    templateLabel: summaryRequest.templateLabel,
    summary: recruiterSummary,
    hiringManagerBriefingReview: hiringManagerBriefing.review,
    prompt: summaryRequest.prompt,
    providerLabel: settings.providerLabel,
    model: settings.model,
    briefing: validatedBriefing
  };
});

ipcMain.handle('briefing:render-review', async (_event, payload) => {
  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const requestedBriefing = payload.briefing
    ? mergeBriefingWithFallback(payload.briefing, fallbackBriefing)
    : fallbackBriefing;
  const composed = prepareHiringManagerBriefingOutput({
    briefing: requestedBriefing,
    recruiterSummary: payload.summary
  });

  return {
    briefing: composed.briefing,
    hiringManagerBriefingReview: composed.review
  };
});

ipcMain.handle('clipboard:write-text', async (_event, value) => {
  clipboard.writeText(value);
  return true;
});

ipcMain.handle('shell:reveal-in-folder', async (_event, filePath) => {
  if (!filePath) {
    throw new Error('A file path is required to reveal the saved draft.');
  }

  await fs.access(filePath);
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('shell:open-path', async (_event, filePath) => {
  if (!filePath) {
    throw new Error('A file path is required to open the generated briefing.');
  }

  await fs.access(filePath);
  const shellResult = await shell.openPath(filePath);

  if (shellResult) {
    throw new Error(shellResult);
  }

  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

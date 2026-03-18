const { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('path');

const { importDocument, SUPPORTED_EXTENSIONS } = require('./services/document-service');
const {
  buildSuggestedOutputFilename,
  buildTemplateData,
  describeEmploymentExtraction,
  renderHiringManagerWordDocument
} = require('./services/hiring-manager-template-service');
const { generateWithConfiguredProvider, getProviderOptions } = require('./services/llm-service');
const { LlmSettingsStore, validateSettings } = require('./services/llm-settings-service');
const { buildSummaryRequest, normalizeGeneratedSummary } = require('./services/summary-service');

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

  function appendDebug(message) {
    debugTrace.push(message);
  }

  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);

  if (!validation.isValid) {
    appendDebug(`Settings validation failed: ${validation.errors.join(' | ')}`);
    await appendExportDebugLog(debugTrace);
    throw new Error(`${validation.errors.join(' ')}\nDebug trace:\n- ${debugTrace.join('\n- ')}`);
  }

  if (!settings.outputTemplatePath) {
    appendDebug('No configured Word template path was available.');
    await appendExportDebugLog(debugTrace);
    throw new Error('Configure a Word .docx or .dotx template before exporting the hiring-manager draft.\nDebug trace:\n- ' + debugTrace.join('\n- '));
  }

  if (!['.docx', '.dotx'].includes(settings.outputTemplateExtension)) {
    appendDebug(`Unsupported template extension: ${settings.outputTemplateExtension}`);
    await appendExportDebugLog(debugTrace);
    throw new Error('Only .docx and .dotx hiring-manager templates are supported for automated output.\nDebug trace:\n- ' + debugTrace.join('\n- '));
  }

  if (!payload.summary || !payload.summary.trim()) {
    appendDebug('Summary payload was empty at export time.');
    await appendExportDebugLog(debugTrace);
    throw new Error('Generate and review the recruiter summary before exporting the hiring-manager draft.\nDebug trace:\n- ' + debugTrace.join('\n- '));
  }

  const templateData = buildTemplateData({
    summary: payload.summary,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const employmentDebug = describeEmploymentExtraction(payload.cvDocument);
  appendDebug(`Configured template: ${settings.outputTemplatePath}`);
  appendDebug(`Template extension: ${settings.outputTemplateExtension}`);
  appendDebug(`CV source file: ${employmentDebug.cvFileName || '(unknown)'}`);
  appendDebug(`CV line count: ${employmentDebug.cvLineCount}`);
  appendDebug(`Experience section line count: ${employmentDebug.experienceSectionLineCount}`);

  if (employmentDebug.experienceSectionPreview.length > 0) {
    appendDebug(`Experience section preview: ${employmentDebug.experienceSectionPreview.join(' || ')}`);
  }

  employmentDebug.dateWindows.forEach((window, index) => {
    appendDebug(`CV date window ${index + 1}: ${window}`);
  });

  appendDebug(`Derived candidate name: ${templateData.candidate_name}`);
  appendDebug(`Derived role title: ${templateData.role_title}`);
  appendDebug(`Derived employment history count: ${templateData.employment_history.length}`);

  templateData.employment_history.forEach((entry, index) => {
    appendDebug(
      `Employment entry ${index + 1}: title="${entry.job_title || ''}" company="${entry.company_name || ''}" dates="${[entry.start_date, entry.end_date].filter(Boolean).join(' - ')}" responsibilities=${entry.responsibilities.length}`
    );

    entry.responsibilities.forEach((responsibility, responsibilityIndex) => {
      appendDebug(
        `Employment entry ${index + 1} responsibility ${responsibilityIndex + 1}: ${responsibility.responsibility || ''}`
      );
    });
  });

  appendDebug(`Summary length: ${payload.summary.trim().length} characters`);
  const suggestedName = buildSuggestedOutputFilename(templateData);
  appendDebug(`Suggested output filename: ${suggestedName}`);
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
  appendDebug(`Save dialog canceled: ${canceled ? 'yes' : 'no'}`);
  appendDebug(`Save dialog returned path: ${filePath || '(none)'}`);

  if (canceled || !filePath) {
    await appendExportDebugLog(debugTrace);
    return {
      canceled: true,
      debugTrace
    };
  }

  const outputPath = await resolveWordDraftOutputPath(filePath, suggestedName);
  appendDebug(`Resolved output path: ${outputPath}`);

  try {
    const renderResult = await renderHiringManagerWordDocument({
      templatePath: settings.outputTemplatePath,
      outputPath,
      templateData
    });
    appendDebug('Word template rendered successfully.');
    appendDebug(`Template placeholders populated: ${renderResult.populatedTemplateTags.map((tag) => `{{${tag}}}`).join(', ') || '(none)'}`);

    if (renderResult.blankTemplateTags.length > 0) {
      appendDebug(`Template placeholders left blank: ${renderResult.blankTemplateTags.map((tag) => `{{${tag}}}`).join(', ')}`);
    }

    await fs.access(outputPath);
    const stat = await fs.stat(outputPath);
    appendDebug(`File write verified: yes (${stat.size} bytes)`);

    shell.showItemInFolder(outputPath);
    appendDebug('Finder reveal requested.');
    appendDebug(`Debug log path: ${EXPORT_DEBUG_LOG_PATH}`);
    await appendExportDebugLog(debugTrace);

    return {
      canceled: false,
      filePath: outputPath,
      templateName: settings.outputTemplateName,
      debugLogPath: EXPORT_DEBUG_LOG_PATH,
      debugTrace
    };
  } catch (error) {
    appendDebug(`Export failed: ${error instanceof Error ? error.message : 'Unknown export failure.'}`);
    appendDebug(`Debug log path: ${EXPORT_DEBUG_LOG_PATH}`);
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

  const request = buildSummaryRequest({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    systemPrompt: settings.systemPrompt
  });
  const result = await generateWithConfiguredProvider({
    settings,
    messages: request.messages,
    fetchImpl: (...args) => net.fetch(...args)
  });

  return {
    templateLabel: request.templateLabel,
    summary: normalizeGeneratedSummary(result.text),
    prompt: request.prompt,
    providerLabel: settings.providerLabel,
    model: settings.model
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

const { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('path');

const {
  importDocument,
  importReferenceTemplateDocument,
  REFERENCE_TEMPLATE_EXTENSIONS,
  SUPPORTED_EXTENSIONS
} = require('./services/document-service');
const {
  buildSuggestedOutputFilename,
  describeEmploymentExtraction,
  renderHiringManagerWordDocument
} = require('./services/hiring-manager-template-service');
const {
  applySummaryOverridesToBriefing,
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
const {
  buildAnonymizedGenerationInputs,
  anonymizeDraftOutput
} = require('./services/anonymization-service');
const {
  buildEmailDraftRequest,
  buildFallbackEmailDraft,
  finalizeEmailDraft,
  parseEmailDraftResponse
} = require('./services/email-draft-service');
const {
  buildDraftTranslationRepairRequest,
  buildDraftTranslationRequest,
  parseTranslatedDraftResponse
} = require('./services/draft-translation-service');
const { normalizeOutputLanguage } = require('./services/output-language-service');

let settingsStore;

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

function getUserDataPath() {
  return process.env.ELECTRON_USER_DATA_PATH &&
    process.env.ELECTRON_USER_DATA_PATH.trim()
    ? path.resolve(process.env.ELECTRON_USER_DATA_PATH)
    : app.getPath('userData');
}

function getExportDebugLogPath() {
  return path.join(getUserDataPath(), 'debug', 'word-draft-export.log');
}

function getManagedGeneratedBriefingsPath() {
  return path.join(getUserDataPath(), 'generated-briefings');
}

function getConfiguredBriefingOutputFolder(settings) {
  if (settings?.outputBriefingFolderPath) {
    return expandHomeDirectory(settings.outputBriefingFolderPath);
  }

  return path.join(app.getPath('documents'), 'AtomicGroup Briefings');
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
  const exportDebugLogPath = getExportDebugLogPath();
  const content = [
    `=== ${new Date().toISOString()} ===`,
    ...lines,
    ''
  ].join('\n');

  await fs.mkdir(path.dirname(exportDebugLogPath), { recursive: true });
  await fs.appendFile(exportDebugLogPath, `${content}\n`, 'utf8');
}

function buildManagedGeneratedBriefingFilename(suggestedName) {
  const parsed = path.parse(suggestedName || 'hiring-manager-briefing.docx');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = parsed.ext && parsed.ext.toLowerCase() === '.docx' ? parsed.ext : '.docx';
  const safeName = parsed.name || 'hiring-manager-briefing';
  return `${safeName}-${timestamp}${ext}`;
}

function getSettingsStore() {
  if (!settingsStore) {
    settingsStore = new LlmSettingsStore({
      userDataPath: getUserDataPath(),
      safeStorage
    });
  }

  return settingsStore;
}

async function loadReferenceTemplateGuidance(settings) {
  if (settings.referenceTemplateMode !== 'local-file') {
    return null;
  }

  if (!settings.referenceTemplatePath) {
    throw new Error('Choose a local reference template file or switch back to the built-in default template.');
  }

  const importedTemplate = await importReferenceTemplateDocument(settings.referenceTemplatePath);

  if (importedTemplate.error) {
    throw new Error(`Unable to load the selected reference template. ${importedTemplate.error}`);
  }

  if (!importedTemplate.text || !importedTemplate.text.trim()) {
    throw new Error('The selected reference template did not yield readable text.');
  }

  return {
    label: settings.referenceTemplateName || importedTemplate.file.name,
    content: importedTemplate.text,
    sourcePath: importedTemplate.file.path
  };
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

  const outputLanguage = normalizeOutputLanguage(payload.outputLanguage);
  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    outputLanguage
  });
  const requestedBriefing = payload.briefing
    ? mergeBriefingWithFallback(payload.briefing, fallbackBriefing)
    : fallbackBriefing;
  let composedOutput;

  try {
    composedOutput = prepareHiringManagerBriefingOutput({
      briefing: requestedBriefing,
      recruiterSummary: payload.summary,
      outputLanguage
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
    debugLogPath: getExportDebugLogPath(),
    debugTrace
  };
}

function normalizeOutputMode(value) {
  return value === 'anonymous' ? 'anonymous' : 'named';
}

function applyDraftOutputMode({ outputMode, recruiterSummary, briefing, cvDocument, jdDocument }) {
  const normalizedOutputMode = normalizeOutputMode(outputMode);

  if (normalizedOutputMode === 'anonymous') {
    return {
      outputMode: normalizedOutputMode,
      ...anonymizeDraftOutput({
        recruiterSummary,
        briefing,
        cvDocument,
        jdDocument
      })
    };
  }

  return {
    outputMode: normalizedOutputMode,
    summary: recruiterSummary,
    briefing,
    warnings: [],
    modeLabel: 'Named Draft'
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

ipcMain.handle('template:pick-reference-template', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select recruiter Markdown reference template',
    properties: ['openFile'],
    filters: [
      {
        name: 'Markdown templates',
        extensions: [...REFERENCE_TEMPLATE_EXTENSIONS].map((extension) => extension.replace('.', ''))
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

ipcMain.handle('template:pick-briefing-output-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select hiring-manager briefing output folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return {
    path: filePaths[0]
  };
});

ipcMain.handle('hiring-manager:export-word-draft', async (_event, payload) => {
  const debugTrace = [
    `Export started at ${new Date().toISOString()}`
  ];

  const settings = await getSettingsStore().load();
  const preparedPayload = normalizeOutputMode(payload.outputMode) === 'anonymous'
    ? {
      ...payload,
      ...applyDraftOutputMode({
        outputMode: payload.outputMode,
        recruiterSummary: payload.summary,
        briefing: payload.briefing,
        cvDocument: payload.cvDocument,
        jdDocument: payload.jdDocument
      })
    }
    : payload;
  let templateData;
  let suggestedName;

  try {
    ({ templateData, suggestedName } = await prepareWordDraftTemplateData({
      payload: preparedPayload,
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
    debugTrace.push(`Debug log path: ${getExportDebugLogPath()}`);
    await appendExportDebugLog(debugTrace);

    return {
      canceled: false,
      ...result
    };
  } catch (error) {
    debugTrace.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown export failure.'}`);
    debugTrace.push(`Debug log path: ${getExportDebugLogPath()}`);
    await appendExportDebugLog(debugTrace);
    throw new Error(
      `${error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'}\nDebug trace:\n- ${debugTrace.join('\n- ')}`
    );
  }
});

ipcMain.handle('email:share-draft', async (_event, payload) => {
  const debugTrace = [
    `Email draft handoff started at ${new Date().toISOString()}`
  ];
  const settings = await getSettingsStore().load();
  const outputMode = normalizeOutputMode(payload.outputMode);
  const outputLanguage = normalizeOutputLanguage(payload.outputLanguage);
  const preparedPayload = outputMode === 'anonymous'
    ? {
      ...payload,
      ...applyDraftOutputMode({
        outputMode,
        recruiterSummary: payload.summary,
        briefing: payload.briefing,
        cvDocument: payload.cvDocument,
        jdDocument: payload.jdDocument
      })
    }
    : payload;
  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: preparedPayload.cvDocument,
    jdDocument: preparedPayload.jdDocument,
    outputLanguage
  });
  const requestedBriefing = preparedPayload.briefing
    ? mergeBriefingWithFallback(preparedPayload.briefing, fallbackBriefing)
    : fallbackBriefing;
  const composedOutput = prepareHiringManagerBriefingOutput({
    briefing: requestedBriefing,
    recruiterSummary: preparedPayload.summary,
    outputLanguage
  });

  let attachmentPath = '';

  if (settings.outputTemplatePath && ['.docx', '.dotx'].includes(settings.outputTemplateExtension)) {
    let templateData;
    let suggestedName;

    ({ templateData, suggestedName } = await prepareWordDraftTemplateData({
      payload: preparedPayload,
      settings,
      debugTrace
    }));

    const configuredOutputFolder = getConfiguredBriefingOutputFolder(settings);
    await fs.mkdir(configuredOutputFolder, { recursive: true });
    attachmentPath = path.join(
      configuredOutputFolder,
      buildManagedGeneratedBriefingFilename(suggestedName)
    );
    debugTrace.push(`Managed email attachment path: ${attachmentPath}`);

    await writeWordDraftToPath({
      settings,
      outputPath: attachmentPath,
      templateData,
      debugTrace
    });
  } else {
    debugTrace.push('No Word template configured; email draft will be opened without a generated attachment.');
  }

  let emailDraft;

  try {
    const emailDraftRequest = buildEmailDraftRequest({
      summary: preparedPayload.summary,
      briefing: composedOutput.briefing,
      outputMode,
      systemPrompt: settings.systemPrompt,
      attachmentExpected: Boolean(attachmentPath),
      outputLanguage
    });
    const emailResult = await generateWithConfiguredProvider({
      settings,
      messages: emailDraftRequest.messages,
      fetchImpl: (...args) => net.fetch(...args)
    });
    const parsedEmailDraft = parseEmailDraftResponse(emailResult.text);

    emailDraft = finalizeEmailDraft({
      ...parsedEmailDraft,
      attachmentPath
    });
    debugTrace.push('LLM email draft generated successfully.');
  } catch (error) {
    debugTrace.push(`Email draft fallback used: ${error instanceof Error ? error.message : 'Unknown LLM email draft failure.'}`);
    emailDraft = buildFallbackEmailDraft({
      summary: preparedPayload.summary,
      briefing: composedOutput.briefing,
      outputMode,
      attachmentPath,
      attachmentExpected: Boolean(attachmentPath),
      outputLanguage
    });
  }

  try {
    await shell.openExternal(emailDraft.mailtoUrl);
    debugTrace.push('Default email client open requested.');
    await appendExportDebugLog(debugTrace);

    return {
      mode: 'mailto',
      subject: emailDraft.subject,
      body: emailDraft.body,
      attachmentPath,
      debugTrace
    };
  } catch (error) {
    clipboard.writeText(emailDraft.clipboardText);
    debugTrace.push(`Email handoff fallback used: ${error instanceof Error ? error.message : 'Unknown email client handoff failure.'}`);
    await appendExportDebugLog(debugTrace);

    return {
      mode: 'clipboard',
      subject: emailDraft.subject,
      body: emailDraft.body,
      attachmentPath,
      clipboardText: emailDraft.clipboardText,
      debugTrace
    };
  }
});

ipcMain.handle('summary:generate', async (_event, payload) => {
  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const outputMode = normalizeOutputMode(payload.outputMode);
  const outputLanguage = normalizeOutputLanguage(payload.outputLanguage);
  const generationInputs = outputMode === 'anonymous'
    ? buildAnonymizedGenerationInputs({
      cvDocument: payload.cvDocument,
      jdDocument: payload.jdDocument
    })
    : {
      cvDocument: payload.cvDocument,
      jdDocument: payload.jdDocument
    };
  const templateGuidance = await loadReferenceTemplateGuidance(validation.settings);
  const summaryRequest = buildSummaryRequest({
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    systemPrompt: settings.systemPrompt,
    templateGuidance,
    outputMode,
    outputLanguage
  });
  const briefingRequest = buildBriefingRequest({
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    systemPrompt: settings.systemPrompt,
    templateGuidance,
    outputMode,
    outputLanguage
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
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    outputLanguage
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
  const preparedOutput = applyDraftOutputMode({
    outputMode,
    recruiterSummary,
    briefing: validatedBriefing,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const hiringManagerBriefing = prepareHiringManagerBriefingOutput({
    briefing: preparedOutput.briefing,
    recruiterSummary: preparedOutput.summary,
    outputLanguage
  });

  return {
    templateLabel: summaryRequest.templateLabel,
    summary: preparedOutput.summary,
    hiringManagerBriefingReview: hiringManagerBriefing.review,
    prompt: summaryRequest.prompt,
    providerLabel: settings.providerLabel,
    model: settings.model,
    briefing: preparedOutput.briefing,
    outputMode: preparedOutput.outputMode,
    outputLanguage,
    modeLabel: preparedOutput.modeLabel,
    approvalWarnings: preparedOutput.warnings
  };
});

ipcMain.handle('draft:translate-output', async (_event, payload) => {
  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const sourceLanguage = normalizeOutputLanguage(payload.sourceLanguage);
  const targetLanguage = normalizeOutputLanguage(payload.targetLanguage);

  if (sourceLanguage === targetLanguage) {
    const composed = prepareHiringManagerBriefingOutput({
      briefing: payload.briefing,
      recruiterSummary: payload.summary,
      outputLanguage: targetLanguage
    });

    return {
      summary: payload.summary,
      briefing: composed.briefing,
      hiringManagerBriefingReview: composed.review,
      outputLanguage: targetLanguage,
      approvalWarnings: payload.approvalWarnings || []
    };
  }

  const currentBriefing = payload.briefing
    ? applySummaryOverridesToBriefing(payload.briefing, payload.summary)
    : buildFallbackBriefing({
      cvDocument: payload.cvDocument,
      jdDocument: payload.jdDocument,
      outputLanguage: sourceLanguage
    });
  const translationRequest = buildDraftTranslationRequest({
    summary: payload.summary,
    briefing: currentBriefing,
    outputMode: payload.outputMode,
    sourceLanguage,
    targetLanguage
  });
  const translationSettings = {
    ...settings,
    temperature: 0,
    maxTokens: Math.max(Number(settings.maxTokens) || 0, 2400)
  };
  const translationResult = await generateWithConfiguredProvider({
    settings: translationSettings,
    messages: translationRequest.messages,
    fetchImpl: (...args) => net.fetch(...args)
  });
  let translated;

  try {
    translated = parseTranslatedDraftResponse(translationResult.text, currentBriefing);
  } catch (error) {
    const repairRequest = buildDraftTranslationRepairRequest({
      malformedResponse: translationResult.text,
      expectedPayload: translationRequest.payload
    });
    const repairedResult = await generateWithConfiguredProvider({
      settings: translationSettings,
      messages: repairRequest.messages,
      fetchImpl: (...args) => net.fetch(...args)
    });
    translated = parseTranslatedDraftResponse(repairedResult.text, currentBriefing);
  }

  const composed = prepareHiringManagerBriefingOutput({
    briefing: translated.briefing,
    recruiterSummary: translated.summary,
    outputLanguage: targetLanguage
  });
  const approvalWarnings = payload.outputMode === 'anonymous'
    ? anonymizeDraftOutput({
      recruiterSummary: translated.summary,
      briefing: translated.briefing,
      cvDocument: payload.cvDocument,
      jdDocument: payload.jdDocument
    }).warnings
    : [];

  return {
    summary: translated.summary,
    briefing: composed.briefing,
    hiringManagerBriefingReview: composed.review,
    outputLanguage: targetLanguage,
    approvalWarnings
  };
});

ipcMain.handle('briefing:render-review', async (_event, payload) => {
  const outputLanguage = normalizeOutputLanguage(payload.outputLanguage);
  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    outputLanguage
  });
  const requestedBriefing = payload.briefing
    ? mergeBriefingWithFallback(payload.briefing, fallbackBriefing)
    : fallbackBriefing;
  const preparedOutput = applyDraftOutputMode({
    outputMode: payload.outputMode,
    recruiterSummary: payload.summary,
    briefing: requestedBriefing,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const composed = prepareHiringManagerBriefingOutput({
    briefing: preparedOutput.briefing,
    recruiterSummary: preparedOutput.summary,
    outputLanguage
  });

  return {
    briefing: composed.briefing,
    hiringManagerBriefingReview: composed.review,
    summary: preparedOutput.summary,
    modeLabel: preparedOutput.modeLabel,
    approvalWarnings: preparedOutput.warnings
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

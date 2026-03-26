const { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, shell } = require('electron');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('path');

const {
  importDocument,
  importReferenceTemplateDocument,
  REFERENCE_TEMPLATE_EXTENSIONS,
  SUPPORTED_EXTENSIONS
} = require('./services/document-service');
const { listSourceFolderDocuments } = require('./services/source-folder-service');
const { RoleWorkspaceStore } = require('./services/role-workspace-service');
const {
  buildSuggestedOutputFilename,
  describeEmploymentExtraction,
  extractDocumentDerivedProfile,
  renderHiringManagerWordDocument
} = require('./services/hiring-manager-template-service');
const {
  applySummaryOverridesToBriefing,
  buildBriefingGenerationSettings,
  buildBriefingRequest,
  buildBriefingRepairRequest,
  buildFallbackBriefing,
  composeDeterministicReportBriefing,
  mergeBriefingWithFallback,
  parseBriefingResponse,
  prepareHiringManagerBriefingOutput,
  renderSummaryFromBriefing,
  validateBriefing
} = require('./services/briefing-service');
const { generateWithConfiguredProvider, getProviderOptions } = require('./services/llm-service');
const { LlmSettingsStore, validateSettings } = require('./services/llm-settings-service');
const {
  buildSummaryRequest,
  generateSummaryDraft,
  normalizeGeneratedSummary
} = require('./services/summary-service');
const {
  anonymizeDraftOutput
} = require('./services/anonymization-service');
const { buildDraftReviewWarnings } = require('./services/draft-review-service');
const {
  buildEmailDraftRequest,
  buildFallbackEmailDraft,
  finalizeEmailDraft,
  parseEmailDraftResponse
} = require('./services/email-draft-service');
const {
  formatWordReportQualityError,
  validateWordReportQuality
} = require('./services/word-report-quality-service');
const {
  buildDraftTranslationRepairRequest,
  buildDraftTranslationRequest,
  buildSummaryTranslationRequest,
  mergeTranslatedBriefing,
  mergeTranslatedEmploymentHistorySlice,
  parseTranslatedDraftResponse,
  parseTranslatedSummaryResponse
} = require('./services/draft-translation-service');
const {
  categorizeOperationError,
  createDiagnosticRunId,
  pushDiagnosticContext,
  pushDiagnosticResult
} = require('./services/diagnostic-log-service');
const {
  appendPerformanceRecord,
  buildPerformancePayload,
  buildPerformanceRecord,
  roundDurationMs
} = require('./services/performance-log-service');
const { briefingNeedsLanguageNormalization } = require('./services/briefing-language-service');
const {
  validateClipboardTextPayload,
  validateDocumentImportPayload,
  validateDocumentPickPayload,
  validateDraftTranslationPayload,
  validateLlmSettingsPayload,
  validateLoadWorkspaceSnapshotPayload,
  validateRenderBriefingPayload,
  validateShellPathPayload,
  validateSourceFolderListPayload,
  validateSummaryGenerationPayload,
  validateWorkspaceProfilePayload,
  validateWorkspaceSnapshotPayload
} = require('./services/ipc-validation-service');
const { normalizeOutputLanguage } = require('./services/output-language-service');

let settingsStore;
let roleWorkspaceStore;
let e2eMockSummaryMode = 'normal';

function getCliFlagValue(flagName) {
  const normalizedFlag = `--${String(flagName || '').trim()}`;
  const prefix = `${normalizedFlag}=`;
  const matchingArgument = process.argv.find((argument) => argument === normalizedFlag || argument.startsWith(prefix));

  if (!matchingArgument) {
    return '';
  }

  return matchingArgument === normalizedFlag
    ? '1'
    : matchingArgument.slice(prefix.length);
}

function hasCliFlag(flagName) {
  return Boolean(getCliFlagValue(flagName));
}

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
  return getCliFlagValue('atomicgroup-user-data-path')
    ? path.resolve(getCliFlagValue('atomicgroup-user-data-path'))
    : app.getPath('userData');
}

function getExportDebugLogPath() {
  return path.join(getUserDataPath(), 'debug', 'word-draft-export.log');
}

function getSummaryGenerationDebugLogPath() {
  return path.join(getUserDataPath(), 'debug', 'summary-generation.log');
}

function getPerformanceStatsLogPath() {
  return path.join(getUserDataPath(), 'debug', 'performance-stats.jsonl');
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

function getRoleWorkspaceStore() {
  if (!roleWorkspaceStore) {
    roleWorkspaceStore = new RoleWorkspaceStore({
      userDataPath: getUserDataPath()
    });
  }

  return roleWorkspaceStore;
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

async function appendSummaryGenerationDebugLog(lines) {
  const summaryGenerationDebugLogPath = getSummaryGenerationDebugLogPath();
  const content = [
    `=== ${new Date().toISOString()} ===`,
    ...lines,
    ''
  ].join('\n');

  await fs.mkdir(path.dirname(summaryGenerationDebugLogPath), { recursive: true });
  await fs.appendFile(summaryGenerationDebugLogPath, `${content}\n`, 'utf8');
}

async function appendOperationPerformanceRecord({
  operation,
  runId,
  startedAt,
  status,
  totalMs,
  phases = {},
  context = {},
  error = null
}) {
  const record = buildPerformanceRecord({
    operation,
    runId,
    status,
    startedAt,
    errorCategory: error ? categorizeOperationError(error) : 'none',
    totalMs,
    phases,
    context
  });

  await appendPerformanceRecord(getPerformanceStatsLogPath(), record);
  return record.performance;
}

function getDebugFileLabel(filePath) {
  const value = String(filePath || '').trim();
  return value ? path.basename(value) : '(none)';
}

function getDebugTextDigest(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '0 chars';
  }

  return `${normalized.length} chars sha256=${createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}

function startTimer() {
  const startedAt = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function formatDuration(durationMs) {
  return `${Number(durationMs || 0).toFixed(1)} ms`;
}

function pushTimingDebugTrace(debugTrace, label, durationMs) {
  debugTrace.push(`${label}: ${formatDuration(durationMs)}`);
}

function recordTimingPhase(debugTrace, phases, key, label, durationMs) {
  const roundedDuration = roundDurationMs(durationMs);
  phases[key] = roundedDuration;
  pushTimingDebugTrace(debugTrace, label, roundedDuration);
}

function extractDocumentPerformanceContext(document, prefix) {
  const fileLabel = getDebugFileLabel(document?.file?.path || document?.file?.name || '');
  const performance = document?.performance || {};

  return {
    [`${prefix}File`]: fileLabel,
    [`${prefix}ImportTotalMs`]: performance.totalMs,
    [`${prefix}ImportExtractMs`]: performance.extractMs,
    [`${prefix}ImportNormalizeMs`]: performance.normalizeMs
  };
}

async function measureAsync(operation) {
  const stopTimer = startTimer();
  const result = await operation();

  return {
    result,
    durationMs: stopTimer()
  };
}

function buildTranslationSettings(settings) {
  return {
    ...settings,
    temperature: 0,
    maxTokens: Math.max(Number(settings.maxTokens) || 0, 4000)
  };
}

async function translateDraftArtifacts({
  settings,
  summary = '',
  briefing,
  sourceLanguage,
  targetLanguage,
  includeSummaryTranslation = true,
  debugTrace = [],
  fetchImpl
}) {
  const normalizedSourceLanguage = normalizeOutputLanguage(sourceLanguage);
  const normalizedTargetLanguage = normalizeOutputLanguage(targetLanguage);
  const currentBriefing = briefing || {};
  const employmentHistory = Array.isArray(currentBriefing.employment_history)
    ? currentBriefing.employment_history
    : [];
  const employmentBatchSize = 3;
  const coreBriefingForTranslation = {
    ...currentBriefing,
    employment_history: []
  };
  const coreBriefingTranslationRequest = buildDraftTranslationRequest({
    summary: '',
    briefing: coreBriefingForTranslation,
    outputMode: 'named',
    sourceLanguage: normalizedSourceLanguage,
    targetLanguage: normalizedTargetLanguage,
    includeSummary: false
  });
  const translationSettings = buildTranslationSettings(settings);
  const totalTimer = startTimer();
  const performancePhases = {};

  debugTrace.push(`Translation model: ${translationSettings.model}`);
  debugTrace.push(`Translation max tokens: ${translationSettings.maxTokens}`);
  debugTrace.push(`Employment history entries to translate: ${employmentHistory.length}`);
  debugTrace.push(`Employment history batch size: ${employmentBatchSize}`);

  const work = [
    measureAsync(() => generateWithConfiguredProvider({
      settings: translationSettings,
      messages: coreBriefingTranslationRequest.messages,
      fetchImpl
    }))
  ];

  if (includeSummaryTranslation) {
    const summaryTranslationRequest = buildSummaryTranslationRequest({
      summary,
      sourceLanguage: normalizedSourceLanguage,
      targetLanguage: normalizedTargetLanguage
    });

    work.unshift(
      measureAsync(() => generateWithConfiguredProvider({
        settings: translationSettings,
        messages: summaryTranslationRequest.messages,
        fetchImpl
      }))
    );
  }

  const results = await Promise.all(work);
  const summaryTranslationOperation = includeSummaryTranslation ? results[0] : null;
  const coreBriefingTranslationOperation = includeSummaryTranslation ? results[1] : results[0];
  const summaryTranslationResult = includeSummaryTranslation ? summaryTranslationOperation.result : null;
  const coreBriefingTranslationResult = coreBriefingTranslationOperation.result;
  let translatedBriefing;
  let translatedSummary = includeSummaryTranslation ? '' : normalizeGeneratedSummary(summary);

  if (summaryTranslationOperation) {
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'summaryTranslationMs',
      'Summary translation call',
      summaryTranslationOperation.durationMs
    );
  }

  recordTimingPhase(
    debugTrace,
    performancePhases,
    'coreBriefingTranslationMs',
    'Core briefing translation call',
    coreBriefingTranslationOperation.durationMs
  );

  if (includeSummaryTranslation && summaryTranslationResult) {
    try {
      translatedSummary = parseTranslatedSummaryResponse(summaryTranslationResult.text);
    } catch (error) {
      debugTrace.push(`Summary translation response could not be parsed: ${error instanceof Error ? error.message : 'Unknown summary translation parse error.'}`);
      translatedSummary = '';
    }
  }

  try {
    const translatedCore = parseTranslatedDraftResponse(coreBriefingTranslationResult.text, coreBriefingForTranslation);
    translatedBriefing = mergeTranslatedBriefing(currentBriefing, translatedCore.briefing);
  } catch (error) {
    debugTrace.push(`Core briefing translation response could not be parsed: ${error instanceof Error ? error.message : 'Unknown parse error.'}`);
    const repairRequest = buildDraftTranslationRepairRequest({
      malformedResponse: coreBriefingTranslationResult.text,
      expectedPayload: coreBriefingTranslationRequest.payload
    });
    const repairedOperation = await measureAsync(() => generateWithConfiguredProvider({
      settings: translationSettings,
      messages: repairRequest.messages,
      fetchImpl
    }));
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'coreBriefingTranslationRepairMs',
      'Core briefing translation repair',
      repairedOperation.durationMs
    );
    const repairedResult = repairedOperation.result;
    const translatedCore = parseTranslatedDraftResponse(repairedResult.text, coreBriefingForTranslation);
    translatedBriefing = mergeTranslatedBriefing(currentBriefing, translatedCore.briefing);
  }

  for (let startIndex = 0; startIndex < employmentHistory.length; startIndex += employmentBatchSize) {
    const employmentSlice = employmentHistory.slice(startIndex, startIndex + employmentBatchSize);
    const sliceBriefing = {
      candidate: {},
      role: {},
      fit_summary: '',
      relevant_experience: [],
      match_requirements: [],
      potential_concerns: [],
      recommended_next_step: '',
      employment_history: employmentSlice
    };
    const sliceRequest = buildDraftTranslationRequest({
      summary: '',
      briefing: sliceBriefing,
      outputMode: 'named',
      sourceLanguage: normalizedSourceLanguage,
      targetLanguage: normalizedTargetLanguage,
      includeSummary: false
    });

    debugTrace.push(`Employment translation batch ${Math.floor(startIndex / employmentBatchSize) + 1}: entries ${startIndex + 1}-${startIndex + employmentSlice.length}`);

    try {
      const sliceOperation = await measureAsync(() => generateWithConfiguredProvider({
        settings: translationSettings,
        messages: sliceRequest.messages,
        fetchImpl
      }));
      recordTimingPhase(
        debugTrace,
        performancePhases,
        `employmentBatch${Math.floor(startIndex / employmentBatchSize) + 1}Ms`,
        `Employment translation batch ${Math.floor(startIndex / employmentBatchSize) + 1} call`,
        sliceOperation.durationMs
      );
      const sliceResult = sliceOperation.result;
      let translatedSlice;

      try {
        translatedSlice = parseTranslatedDraftResponse(sliceResult.text, sliceBriefing);
      } catch (error) {
        debugTrace.push(`Employment translation batch ${Math.floor(startIndex / employmentBatchSize) + 1} parse failed: ${error instanceof Error ? error.message : 'Unknown parse error.'}`);
        const repairRequest = buildDraftTranslationRepairRequest({
          malformedResponse: sliceResult.text,
          expectedPayload: sliceRequest.payload
        });
        const repairedOperation = await measureAsync(() => generateWithConfiguredProvider({
          settings: translationSettings,
          messages: repairRequest.messages,
          fetchImpl
        }));
        recordTimingPhase(
          debugTrace,
          performancePhases,
          `employmentBatch${Math.floor(startIndex / employmentBatchSize) + 1}RepairMs`,
          `Employment translation batch ${Math.floor(startIndex / employmentBatchSize) + 1} repair`,
          repairedOperation.durationMs
        );
        const repairedResult = repairedOperation.result;
        translatedSlice = parseTranslatedDraftResponse(repairedResult.text, sliceBriefing);
      }

      translatedBriefing = mergeTranslatedEmploymentHistorySlice({
        briefing: translatedBriefing,
        translatedBriefing: translatedSlice.briefing,
        startIndex
      });
    } catch (error) {
      throw new Error(`Employment translation batch ${Math.floor(startIndex / employmentBatchSize) + 1} failed. ${error instanceof Error ? error.message : 'Unknown translation failure.'}`);
    }
  }

  if (includeSummaryTranslation && !translatedSummary) {
    translatedSummary = renderSummaryFromBriefing(translatedBriefing, normalizedTargetLanguage);
    debugTrace.push('Summary translation fallback used: rendered recruiter summary from translated briefing.');
  }

  const totalDurationMs = totalTimer();
  recordTimingPhase(
    debugTrace,
    performancePhases,
    'totalTranslationMs',
    'Total draft translation',
    totalDurationMs
  );

  return {
    summary: translatedSummary,
    briefing: translatedBriefing,
    performance: buildPerformancePayload({
      totalMs: totalDurationMs,
      phases: performancePhases
    })
  };
}

function pushEmploymentHistoryDebugTrace(debugTrace, label, employmentHistory = []) {
  debugTrace.push(`${label} employment history count: ${Array.isArray(employmentHistory) ? employmentHistory.length : 0}`);

  if (!Array.isArray(employmentHistory)) {
    return;
  }

  employmentHistory.forEach((entry, index) => {
    const responsibilities = Array.isArray(entry.responsibilities)
      ? entry.responsibilities
      : [];

    debugTrace.push(
      `${label} employment ${index + 1}: has_title=${Boolean(entry.job_title || entry.jobTitle)} has_company=${Boolean(entry.company_name || entry.companyName)} has_dates=${Boolean(entry.start_date || entry.startDate || entry.end_date || entry.endDate)} responsibilities=${responsibilities.length}`
    );
  });
}

function pushBriefingDebugTrace(debugTrace, label, briefing = {}) {
  const candidate = briefing?.candidate || {};
  const role = briefing?.role || {};

  debugTrace.push(`${label} candidate fields present: name=${Boolean(candidate.name)} location=${Boolean(candidate.location)} preferred_location=${Boolean(candidate.preferred_location)} nationality=${Boolean(candidate.nationality)}`);
  debugTrace.push(`${label} role fields present: title=${Boolean(role.title)} company=${Boolean(role.company)} hiring_manager=${Boolean(role.hiring_manager)}`);
  pushEmploymentHistoryDebugTrace(debugTrace, label, briefing?.employment_history);
}

function pushRetrievalManifestDebugTrace(debugTrace, label, retrievalManifest = []) {
  debugTrace.push(`${label} retrieval block count: ${Array.isArray(retrievalManifest) ? retrievalManifest.length : 0}`);

  if (!Array.isArray(retrievalManifest)) {
    return;
  }

  retrievalManifest.forEach((entry, index) => {
    debugTrace.push(
      `${label} retrieval ${index + 1}: [${entry.documentType}:${entry.sectionKey}] ${entry.blockId} score=${entry.score}`
    );
  });
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
    ? composeDeterministicReportBriefing(payload.briefing, fallbackBriefing)
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
  const reportQualityValidation = validateWordReportQuality(templateData);

  if (!reportQualityValidation.isValid) {
    debugTrace.push(`Word report quality blockers: ${reportQualityValidation.blockers.join(' | ')}`);
    throw new Error(formatWordReportQualityError(reportQualityValidation));
  }

  const employmentDebug = describeEmploymentExtraction(payload.cvDocument);
  debugTrace.push(`Configured template file: ${getDebugFileLabel(settings.outputTemplatePath)}`);
  debugTrace.push(`Template extension: ${settings.outputTemplateExtension}`);
  debugTrace.push(`CV source file: ${getDebugFileLabel(employmentDebug.cvFileName)}`);
  debugTrace.push(`CV line count: ${employmentDebug.cvLineCount}`);
  debugTrace.push(`Experience section line count: ${employmentDebug.experienceSectionLineCount}`);
  debugTrace.push(`Experience section preview lines captured: ${employmentDebug.experienceSectionPreview.length}`);
  debugTrace.push(`CV date-window count: ${employmentDebug.dateWindows.length}`);
  debugTrace.push(`Derived employment history count: ${templateData.employment_history.length}`);

  templateData.employment_history.forEach((entry, index) => {
    debugTrace.push(
      `Employment entry ${index + 1}: has_title=${Boolean(entry.job_title)} has_company=${Boolean(entry.company_name)} has_dates=${Boolean(entry.start_date || entry.end_date)} responsibilities=${entry.responsibilities.length}`
    );
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

function buildReviewPresentation({
  briefing,
  recruiterSummary,
  outputLanguage,
  outputMode,
  cvDocument = null,
  jdDocument = null,
  existingWarnings = [],
  summaryRetrievalManifest = [],
  briefingRetrievalManifest = []
}) {
  const reviewBriefing = cvDocument && jdDocument
    ? composeDeterministicReportBriefing(
      briefing,
      buildFallbackBriefing({
        cvDocument,
        jdDocument,
        outputLanguage
      })
    )
    : briefing;
  const hiringManagerBriefing = prepareHiringManagerBriefingOutput({
    briefing: reviewBriefing,
    recruiterSummary,
    outputLanguage
  });
  const reportQualityValidation = validateWordReportQuality(hiringManagerBriefing.templateData);
  const reviewWarnings = buildDraftReviewWarnings({
    recruiterSummary,
    briefing: reviewBriefing,
    outputMode,
    existingWarnings,
    reportQualityBlockers: reportQualityValidation.blockers,
    summaryRetrievalManifest,
    briefingRetrievalManifest
  });

  return {
    hiringManagerBriefing,
    reviewWarnings,
    reportQualityBlockers: reportQualityValidation.blockers
  };
}

function buildWorkspaceDerivedProfilePayload({ cvDocument, jdDocument }) {
  const profile = extractDocumentDerivedProfile({
    cvDocument: cvDocument || null,
    jdDocument: jdDocument || null
  });

  return {
    candidateName: String(profile.candidateName || '').trim(),
    roleTitle: String(profile.roleTitle || '').trim(),
    candidateLocation: String(profile.candidateLocation || '').trim(),
    candidatePreferredLocation: String(profile.candidatePreferredLocation || '').trim(),
    candidateNationality: String(profile.candidateNationality || '').trim(),
    candidateLanguages: Array.isArray(profile.candidateLanguages) ? profile.candidateLanguages.filter(Boolean) : [],
    noticePeriod: String(profile.noticePeriod || '').trim(),
    jobTitle: String(profile.jobTitle || '').trim(),
    companyName: String(profile.companyName || '').trim()
  };
}

function isE2EMockLlmEnabled() {
  return hasCliFlag('atomicgroup-e2e-mock-llm');
}

function getE2EMockDelayMs() {
  const parsedValue = Number.parseInt(getCliFlagValue('atomicgroup-e2e-delay-ms') || '0', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function getE2EImportDelayMs() {
  const parsedValue = Number.parseInt(getCliFlagValue('atomicgroup-e2e-import-delay-ms') || '0', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

async function waitForE2EMockDelay() {
  const delayMs = getE2EMockDelayMs();

  if (!delayMs) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function waitForE2EImportDelay() {
  const delayMs = getE2EImportDelayMs();

  if (!delayMs) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function buildE2EMockSummaryResult({ payload, settings, templateGuidance, outputMode, outputLanguage, debugTrace }) {
  const totalTimer = startTimer();
  const generationInputs = {
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  };
  const summaryRequest = buildSummaryRequest({
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    systemPrompt: settings.systemPrompt,
    templateGuidance,
    outputMode: 'named',
    outputLanguage
  });
  const briefingRequest = buildBriefingRequest({
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    systemPrompt: settings.systemPrompt,
    templateGuidance,
    outputMode: 'named',
    outputLanguage
  });
  let recruiterSummary = generateSummaryDraft({
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    outputLanguage
  }).summary;
  let validatedBriefing = validateBriefing(buildFallbackBriefing({
    cvDocument: generationInputs.cvDocument,
    jdDocument: generationInputs.jdDocument,
    outputLanguage
  })).briefing;
  let summaryRetrievalManifest = summaryRequest.retrievalManifest;
  let briefingRetrievalManifest = briefingRequest.retrievalManifest;

  if (e2eMockSummaryMode === 'weak-review') {
    recruiterSummary = outputLanguage === 'zh'
      ? '候选人概览\n候选人具备一定相关背景，但当前草稿未完整展开关键匹配点。'
      : 'Candidate snapshot\nThe candidate appears relevant, but this draft intentionally omits the normal structured recruiter sections.';
    validatedBriefing = {
      ...validatedBriefing,
      employment_history: [],
      role_requirements_match: []
    };
    summaryRetrievalManifest = [];
    briefingRetrievalManifest = [];
    debugTrace.push('E2E mock summary mode: weak-review');
  }

  const preparedOutput = applyDraftOutputMode({
    outputMode,
    recruiterSummary,
    briefing: validatedBriefing,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const reviewPresentation = buildReviewPresentation({
    briefing: preparedOutput.briefing,
    recruiterSummary: preparedOutput.summary,
    outputLanguage,
    outputMode,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    existingWarnings: preparedOutput.warnings,
    summaryRetrievalManifest,
    briefingRetrievalManifest
  });
  const reviewWarnings = reviewPresentation.reviewWarnings;
  const hiringManagerBriefing = reviewPresentation.hiringManagerBriefing;

  debugTrace.push('E2E mock LLM mode enabled for deterministic summary generation.');
  debugTrace.push(`Summary template label: ${summaryRequest.templateLabel}`);
  debugTrace.push(`Briefing template label: ${briefingRequest.templateLabel}`);
  pushRetrievalManifestDebugTrace(debugTrace, 'Summary request', summaryRetrievalManifest);
  pushRetrievalManifestDebugTrace(debugTrace, 'Briefing request', briefingRetrievalManifest);
  pushBriefingDebugTrace(debugTrace, 'Prepared output briefing', preparedOutput.briefing);

  await waitForE2EMockDelay();

  const totalDurationMs = totalTimer();

  return {
    templateLabel: summaryRequest.templateLabel,
    summary: recruiterSummary,
    hiringManagerBriefingReview: hiringManagerBriefing.review,
    summaryRetrievalManifest,
    briefingRetrievalManifest,
    prompt: summaryRequest.prompt,
    providerLabel: 'E2E Mock',
    model: 'deterministic-local',
    briefing: validatedBriefing,
    outputMode,
    outputLanguage,
    modeLabel: preparedOutput.modeLabel,
    approvalWarnings: reviewWarnings,
    performance: buildPerformancePayload({
      totalMs: totalDurationMs,
      phases: {
        totalGenerationMs: totalDurationMs
      }
    })
  };
}

async function buildE2EMockTranslatedDraftResult({ payload, targetLanguage, debugTrace }) {
  const totalTimer = startTimer();
  const recruiterSummary = generateSummaryDraft({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    outputLanguage: targetLanguage
  }).summary;
  const translatedBriefing = validateBriefing(buildFallbackBriefing({
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    outputLanguage: targetLanguage
  })).briefing;
  const preparedOutput = applyDraftOutputMode({
    outputMode: payload.outputMode,
    recruiterSummary,
    briefing: translatedBriefing,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument
  });
  const reviewPresentation = buildReviewPresentation({
    briefing: preparedOutput.briefing,
    recruiterSummary: preparedOutput.summary,
    outputLanguage: targetLanguage,
    outputMode: payload.outputMode,
    cvDocument: payload.cvDocument,
    jdDocument: payload.jdDocument,
    existingWarnings: preparedOutput.warnings,
    summaryRetrievalManifest: payload.summaryRetrievalManifest,
    briefingRetrievalManifest: payload.briefingRetrievalManifest
  });
  const reviewWarnings = reviewPresentation.reviewWarnings;
  const composed = reviewPresentation.hiringManagerBriefing;

  debugTrace.push('E2E mock LLM mode enabled for deterministic draft translation.');
  pushBriefingDebugTrace(debugTrace, 'Translated mock briefing', preparedOutput.briefing);

  await waitForE2EMockDelay();

  const totalDurationMs = totalTimer();

  return {
    summary: recruiterSummary,
    briefing: translatedBriefing,
    hiringManagerBriefingReview: composed.review,
    outputLanguage: targetLanguage,
    approvalWarnings: reviewWarnings,
    performance: buildPerformancePayload({
      totalMs: totalDurationMs,
      phases: {
        totalTranslationMs: totalDurationMs
      }
    })
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
      nodeIntegration: false,
      sandbox: true,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: hasCliFlag('atomicgroup-e2e-test-api')
        ? ['--atomicgroup-e2e-test-api']
        : []
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = mainWindow.webContents.getURL();

    if (currentUrl && navigationUrl !== currentUrl) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('document:pick', async (_event, payload) => {
  const { slot } = validateDocumentPickPayload(payload);
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

ipcMain.handle('document:import', async (_event, payload) => {
  const { filePath } = validateDocumentImportPayload(payload);

  if (isE2EMockLlmEnabled()) {
    await waitForE2EImportDelay();
  }

  return importDocument(filePath);
});

ipcMain.handle('workspace:pick-source-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select source folder',
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return listSourceFolderDocuments(filePaths[0]);
});

ipcMain.handle('workspace:list-source-folder', async (_event, payload) => {
  const { folderPath } = validateSourceFolderListPayload(payload);
  return listSourceFolderDocuments(folderPath);
});

ipcMain.handle('workspace:derive-profile', async (_event, payload = {}) => {
  const normalizedPayload = validateWorkspaceProfilePayload(payload);
  const stopTimer = startTimer();

  return {
    profile: buildWorkspaceDerivedProfilePayload({
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument
    }),
    performance: {
      totalMs: stopTimer()
    }
  };
});

ipcMain.handle('workspace:list-recent', async () => {
  return getRoleWorkspaceStore().list();
});

ipcMain.handle('workspace:save-snapshot', async (_event, payload) => {
  return getRoleWorkspaceStore().save(validateWorkspaceSnapshotPayload(payload));
});

ipcMain.handle('workspace:load-snapshot', async (_event, payload) => {
  const { workspaceId } = validateLoadWorkspaceSnapshotPayload(payload);
  return getRoleWorkspaceStore().load(workspaceId);
});

ipcMain.handle('workspace:clear-recent', async () => {
  return getRoleWorkspaceStore().clear();
});

ipcMain.handle('llm:get-providers', async () => {
  return getProviderOptions();
});

ipcMain.handle('llm:load-settings', async () => {
  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);

  return {
    settings,
    validation,
    apiKeyStatus: {
      storageMode: settings.apiKeyStorageMode || 'empty',
      statusCode: settings.apiKeyStatusCode || '',
      message: settings.apiKeyStatusMessage || ''
    }
  };
});

ipcMain.handle('llm:save-settings', async (_event, payload) => {
  return getSettingsStore().save(validateLlmSettingsPayload(payload));
});

if (hasCliFlag('atomicgroup-e2e-test-api')) {
  ipcMain.handle('e2e:set-secure-storage-mode', async (_event, payload) => {
    const mode = String(payload?.mode || 'normal').trim().toLowerCase();
    getSettingsStore().setTestSecureStorageMode(mode || 'normal');
    return { mode: mode || 'normal' };
  });

  ipcMain.handle('e2e:set-mock-summary-mode', async (_event, payload) => {
    const mode = String(payload?.mode || 'normal').trim().toLowerCase();
    e2eMockSummaryMode = mode || 'normal';
    return { mode: e2eMockSummaryMode };
  });
}

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
  const normalizedPayload = validateRenderBriefingPayload(payload);
  const runId = createDiagnosticRunId('export');
  const debugTrace = [];
  pushDiagnosticContext(debugTrace, {
    operation: 'Word export',
    runId
  });

  const settings = await getSettingsStore().load();
  const preparedPayload = normalizeOutputMode(normalizedPayload.outputMode) === 'anonymous'
    ? {
      ...normalizedPayload,
      ...applyDraftOutputMode({
        outputMode: normalizedPayload.outputMode,
        recruiterSummary: normalizedPayload.summary,
        briefing: normalizedPayload.briefing,
        cvDocument: normalizedPayload.cvDocument,
        jdDocument: normalizedPayload.jdDocument
      })
    }
    : normalizedPayload;
  let templateData;
  let suggestedName;

  try {
    ({ templateData, suggestedName } = await prepareWordDraftTemplateData({
      payload: preparedPayload,
      settings,
      debugTrace
    }));
  } catch (error) {
    pushDiagnosticResult(debugTrace, {
      status: 'failed',
      error
    });
    await appendExportDebugLog(debugTrace);
    throw new Error(`${error instanceof Error ? error.message : 'Unable to prepare the hiring-manager draft.'}\nDebug trace:\n- ${debugTrace.join('\n- ')}`);
  }

  debugTrace.push(`Suggested output filename: ${getDebugFileLabel(suggestedName)}`);

  if (isE2EMockLlmEnabled()) {
    const outputDirectory = path.join(getUserDataPath(), 'e2e-generated-briefings');
    await fs.mkdir(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, suggestedName);
    debugTrace.push(`E2E mock Word export path: ${getDebugFileLabel(outputPath)}`);

    try {
      const result = await writeWordDraftToPath({
        settings,
        outputPath,
        templateData,
        debugTrace
      });
      debugTrace.push('E2E mock Word export completed without save dialog or shell reveal.');
      pushDiagnosticResult(debugTrace, {
        status: 'success'
      });
      debugTrace.push(`Debug log path: ${getExportDebugLogPath()}`);
      await appendExportDebugLog(debugTrace);

      return {
        canceled: false,
        ...result
      };
    } catch (error) {
      debugTrace.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown export failure.'}`);
      pushDiagnosticResult(debugTrace, {
        status: 'failed',
        error
      });
      debugTrace.push(`Debug log path: ${getExportDebugLogPath()}`);
      await appendExportDebugLog(debugTrace);
      throw new Error(
        `${error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'}\nDebug trace:\n- ${debugTrace.join('\n- ')}`
      );
    }
  }

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
  debugTrace.push(`Save dialog returned file: ${getDebugFileLabel(filePath)}`);

  if (canceled || !filePath) {
    pushDiagnosticResult(debugTrace, {
      status: 'canceled'
    });
    await appendExportDebugLog(debugTrace);
    return {
      canceled: true,
      debugTrace
    };
  }

  const outputPath = await resolveWordDraftOutputPath(filePath, suggestedName);
  debugTrace.push(`Resolved output file: ${getDebugFileLabel(outputPath)}`);

  try {
    const result = await writeWordDraftToPath({
      settings,
      outputPath,
      templateData,
      debugTrace
    });
    shell.showItemInFolder(outputPath);
    debugTrace.push('Finder reveal requested.');
    pushDiagnosticResult(debugTrace, {
      status: 'success'
    });
    debugTrace.push(`Debug log path: ${getExportDebugLogPath()}`);
    await appendExportDebugLog(debugTrace);

    return {
      canceled: false,
      ...result
    };
  } catch (error) {
    debugTrace.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown export failure.'}`);
    pushDiagnosticResult(debugTrace, {
      status: 'failed',
      error
    });
    debugTrace.push(`Debug log path: ${getExportDebugLogPath()}`);
    await appendExportDebugLog(debugTrace);
    throw new Error(
      `${error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'}\nDebug trace:\n- ${debugTrace.join('\n- ')}`
    );
  }
});

ipcMain.handle('email:share-draft', async (_event, payload) => {
  const normalizedPayload = validateRenderBriefingPayload(payload);
  const runId = createDiagnosticRunId('email');
  const debugTrace = [];
  pushDiagnosticContext(debugTrace, {
    operation: 'Email draft handoff',
    runId
  });
  const settings = await getSettingsStore().load();
  const outputMode = normalizeOutputMode(normalizedPayload.outputMode);
  const outputLanguage = normalizeOutputLanguage(normalizedPayload.outputLanguage);
  const preparedPayload = outputMode === 'anonymous'
    ? {
      ...normalizedPayload,
      ...applyDraftOutputMode({
        outputMode,
        recruiterSummary: normalizedPayload.summary,
        briefing: normalizedPayload.briefing,
        cvDocument: normalizedPayload.cvDocument,
        jdDocument: normalizedPayload.jdDocument
      })
    }
    : normalizedPayload;
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
    debugTrace.push(`Managed email attachment file: ${getDebugFileLabel(attachmentPath)}`);

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
    if (isE2EMockLlmEnabled()) {
      emailDraft = buildFallbackEmailDraft({
        summary: preparedPayload.summary,
        briefing: composedOutput.briefing,
        outputMode,
        attachmentPath,
        attachmentExpected: Boolean(attachmentPath),
        outputLanguage
      });
      debugTrace.push('E2E mock email draft generated from deterministic fallback.');
    } else {
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
    }
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

  if (isE2EMockLlmEnabled()) {
    debugTrace.push('E2E mock email handoff completed without shell open.');
    pushDiagnosticResult(debugTrace, {
      status: 'success'
    });
    await appendExportDebugLog(debugTrace);

    return {
      mode: 'mailto',
      subject: emailDraft.subject,
      body: emailDraft.body,
      attachmentPath,
      debugTrace
    };
  }

  try {
    await shell.openExternal(emailDraft.mailtoUrl);
    debugTrace.push('Default email client open requested.');
    pushDiagnosticResult(debugTrace, {
      status: 'success'
    });
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
    pushDiagnosticResult(debugTrace, {
      status: 'fallback',
      error
    });
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
  const normalizedPayload = validateSummaryGenerationPayload(payload);
  const totalTimer = startTimer();
  const runId = createDiagnosticRunId('summary');
  const startedAt = new Date().toISOString();
  const debugTrace = [];
  const performancePhases = {};
  pushDiagnosticContext(debugTrace, {
    operation: 'Summary generation',
    runId,
    startedAt
  });

  try {
    const settings = await getSettingsStore().load();
    const validation = validateSettings(settings);

    if (!validation.isValid) {
      debugTrace.push(`Settings validation failed: ${validation.errors.join(' | ')}`);
      throw new Error(validation.errors.join(' '));
    }

    const outputMode = normalizeOutputMode(normalizedPayload.outputMode);
    const outputLanguage = normalizeOutputLanguage(normalizedPayload.outputLanguage);
    debugTrace.push(`Output mode: ${outputMode}`);
    debugTrace.push(`Output language: ${outputLanguage}`);
    debugTrace.push(`CV source file: ${getDebugFileLabel(normalizedPayload.cvDocument?.file?.name || normalizedPayload.cvDocument?.file?.path)}`);
    debugTrace.push(`JD source file: ${getDebugFileLabel(normalizedPayload.jdDocument?.file?.name || normalizedPayload.jdDocument?.file?.path)}`);
    debugTrace.push('Recruiter summary generation is always grounded on the named CV/JD inputs.');

    const generationInputs = {
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument
    };
    const requestBuildTimer = startTimer();
    const templateGuidance = await loadReferenceTemplateGuidance(validation.settings);
    const summaryRequest = buildSummaryRequest({
      cvDocument: generationInputs.cvDocument,
      jdDocument: generationInputs.jdDocument,
      systemPrompt: settings.systemPrompt,
      templateGuidance,
      outputMode: 'named',
      outputLanguage
    });
    const briefingRequest = buildBriefingRequest({
      cvDocument: generationInputs.cvDocument,
      jdDocument: generationInputs.jdDocument,
      systemPrompt: settings.systemPrompt,
      templateGuidance,
      outputMode: 'named',
      outputLanguage
    });
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'promptPreparationMs',
      'Prompt and retrieval preparation',
      requestBuildTimer()
    );

    if (isE2EMockLlmEnabled()) {
      const mockResult = await buildE2EMockSummaryResult({
        payload: normalizedPayload,
        settings,
        templateGuidance,
        outputMode,
        outputLanguage,
        debugTrace
      });
      await appendOperationPerformanceRecord({
        operation: 'summary-generation',
        runId,
        startedAt,
        status: 'success',
        totalMs: mockResult.performance?.totalMs,
        phases: mockResult.performance?.phases,
        context: {
          outputMode,
          outputLanguage,
          providerLabel: 'E2E Mock',
          model: 'deterministic-local',
          templateLabel: summaryRequest.templateLabel,
          ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
          ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
        }
      });
      debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
      debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
      await appendSummaryGenerationDebugLog(debugTrace);
      return mockResult;
    }

    debugTrace.push(`Summary template label: ${summaryRequest.templateLabel}`);
    debugTrace.push(`Briefing template label: ${briefingRequest.templateLabel}`);
    pushRetrievalManifestDebugTrace(debugTrace, 'Summary request', summaryRequest.retrievalManifest);
    pushRetrievalManifestDebugTrace(debugTrace, 'Briefing request', briefingRequest.retrievalManifest);

    const briefingGenerationSettings = buildBriefingGenerationSettings(settings);
    debugTrace.push(`Structured briefing max tokens: ${briefingGenerationSettings.maxTokens}`);

    const providerWaitTimer = startTimer();
    const [summaryOperation, structuredBriefingOperation] = await Promise.all([
      measureAsync(() => generateWithConfiguredProvider({
        settings,
        messages: summaryRequest.messages,
        fetchImpl: (...args) => net.fetch(...args)
      })),
      measureAsync(() => generateWithConfiguredProvider({
        settings: briefingGenerationSettings,
        messages: briefingRequest.messages,
        fetchImpl: (...args) => net.fetch(...args)
      }))
    ]);
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'summaryLlmMs',
      'Summary LLM call',
      summaryOperation.durationMs
    );
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'structuredBriefingLlmMs',
      'Structured briefing LLM call',
      structuredBriefingOperation.durationMs
    );
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'combinedProviderWaitMs',
      'Combined provider wait',
      providerWaitTimer()
    );
    const summaryResult = summaryOperation.result;
    const structuredBriefingResult = structuredBriefingOperation.result;
    const recruiterSummary = normalizeGeneratedSummary(summaryResult.text);
    debugTrace.push(`Recruiter summary length: ${recruiterSummary.length}`);
    debugTrace.push(`Structured briefing raw response digest: ${getDebugTextDigest(structuredBriefingResult.text)}`);

    const fallbackBriefingTimer = startTimer();
    const fallbackBriefing = buildFallbackBriefing({
      cvDocument: generationInputs.cvDocument,
      jdDocument: generationInputs.jdDocument,
      outputLanguage
    });
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'fallbackBriefingBuildMs',
      'Fallback briefing build',
      fallbackBriefingTimer()
    );
    pushBriefingDebugTrace(debugTrace, 'Fallback briefing', fallbackBriefing);

    let briefing;

    try {
      const parsedStructuredBriefing = parseBriefingResponse(structuredBriefingResult.text);
      pushBriefingDebugTrace(debugTrace, 'Parsed structured briefing', parsedStructuredBriefing);
      briefing = mergeBriefingWithFallback(parsedStructuredBriefing, fallbackBriefing);
    } catch (error) {
      debugTrace.push(`Structured briefing parse failed: ${error instanceof Error ? error.message : 'Unknown parsing failure.'}`);
      try {
        const repairRequest = buildBriefingRepairRequest({
          malformedResponse: structuredBriefingResult.text,
          expectedBriefing: fallbackBriefing
        });
        const repairedOperation = await measureAsync(() => generateWithConfiguredProvider({
          settings: {
            ...briefingGenerationSettings,
            temperature: 0
          },
          messages: repairRequest.messages,
          fetchImpl: (...args) => net.fetch(...args)
        }));
        recordTimingPhase(
          debugTrace,
          performancePhases,
          'structuredBriefingRepairMs',
          'Structured briefing repair call',
          repairedOperation.durationMs
        );
        const repairedResult = repairedOperation.result;
        debugTrace.push(`Structured briefing repair response length: ${(repairedResult.text || '').trim().length}`);
        const repairedStructuredBriefing = parseBriefingResponse(repairedResult.text);
        pushBriefingDebugTrace(debugTrace, 'Repaired structured briefing', repairedStructuredBriefing);
        briefing = mergeBriefingWithFallback(repairedStructuredBriefing, fallbackBriefing);
      } catch (repairError) {
        debugTrace.push(`Structured briefing repair failed: ${repairError instanceof Error ? repairError.message : 'Unknown repair failure.'}`);
        briefing = fallbackBriefing;
      }
    }

    pushBriefingDebugTrace(debugTrace, 'Merged briefing', briefing);

    const briefingValidation = validateBriefing(briefing);

    if (!briefingValidation.isValid) {
      debugTrace.push(`Structured briefing validation failed: ${briefingValidation.errors.join(' | ')}`);
      throw new Error(briefingValidation.errors.join(' '));
    }

    let validatedBriefing = briefingValidation.briefing;

    if (briefingNeedsLanguageNormalization(validatedBriefing, outputLanguage)) {
      debugTrace.push(`Structured briefing language normalization triggered for target language: ${outputLanguage}`);

      try {
        const normalizationTimer = startTimer();
        const normalizedTranslation = await translateDraftArtifacts({
          settings,
          summary: '',
          briefing: validatedBriefing,
          sourceLanguage: outputLanguage === 'zh' ? 'en' : 'zh',
          targetLanguage: outputLanguage,
          includeSummaryTranslation: false,
          debugTrace,
          fetchImpl: (...args) => net.fetch(...args)
        });
        recordTimingPhase(
          debugTrace,
          performancePhases,
          'briefingLanguageNormalizationMs',
          'Structured briefing language normalization',
          normalizationTimer()
        );

        validatedBriefing = normalizedTranslation.briefing;
        pushBriefingDebugTrace(debugTrace, 'Language-normalized briefing', validatedBriefing);
      } catch (error) {
        debugTrace.push(`Structured briefing language normalization failed: ${error instanceof Error ? error.message : 'Unknown normalization failure.'}`);
      }
    }

    const preparedOutput = applyDraftOutputMode({
      outputMode,
      recruiterSummary,
      briefing: validatedBriefing,
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument
    });
    const reviewAssemblyTimer = startTimer();
    const reviewPresentation = buildReviewPresentation({
      briefing: preparedOutput.briefing,
      recruiterSummary: preparedOutput.summary,
      outputLanguage,
      outputMode,
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument,
      existingWarnings: preparedOutput.warnings,
      summaryRetrievalManifest: summaryRequest.retrievalManifest,
      briefingRetrievalManifest: briefingRequest.retrievalManifest
    });
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'reviewAssemblyMs',
      'Review presentation assembly',
      reviewAssemblyTimer()
    );
    const reviewWarnings = reviewPresentation.reviewWarnings;
    pushBriefingDebugTrace(debugTrace, 'Prepared output briefing', preparedOutput.briefing);
    const hiringManagerBriefing = reviewPresentation.hiringManagerBriefing;
    if (reviewPresentation.reportQualityBlockers.length > 0) {
      debugTrace.push(`Word report review required: ${reviewPresentation.reportQualityBlockers.join(' | ')}`);
    }
    debugTrace.push('Prepared hiring-manager briefing review successfully.');
    pushDiagnosticResult(debugTrace, {
      status: 'success'
    });
    const totalDurationMs = totalTimer();
    const performance = await appendOperationPerformanceRecord({
      operation: 'summary-generation',
      runId,
      startedAt,
      status: 'success',
      totalMs: totalDurationMs,
      phases: {
        ...performancePhases,
        totalGenerationMs: totalDurationMs
      },
      context: {
        outputMode,
        outputLanguage,
        providerLabel: settings.providerLabel,
        model: settings.model,
        templateLabel: summaryRequest.templateLabel,
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      }
    });
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'totalGenerationMs',
      'Total summary generation',
      totalDurationMs
    );
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    await appendSummaryGenerationDebugLog(debugTrace);

    return {
      templateLabel: summaryRequest.templateLabel,
      summary: recruiterSummary,
      hiringManagerBriefingReview: hiringManagerBriefing.review,
      summaryRetrievalManifest: summaryRequest.retrievalManifest,
      briefingRetrievalManifest: briefingRequest.retrievalManifest,
      prompt: summaryRequest.prompt,
      providerLabel: settings.providerLabel,
      model: settings.model,
      briefing: validatedBriefing,
      outputMode,
      outputLanguage,
      modeLabel: preparedOutput.modeLabel,
      approvalWarnings: reviewWarnings,
      performance
    };
  } catch (error) {
    debugTrace.push(`Summary generation failed: ${error instanceof Error ? error.message : 'Unknown summary generation failure.'}`);
    pushDiagnosticResult(debugTrace, {
      status: 'failed',
      error
    });
    const totalDurationMs = totalTimer();
    await appendOperationPerformanceRecord({
      operation: 'summary-generation',
      runId,
      startedAt,
      status: 'failed',
      totalMs: totalDurationMs,
      phases: {
        ...performancePhases,
        totalGenerationMs: totalDurationMs
      },
      context: {
        outputMode: normalizeOutputMode(normalizedPayload.outputMode),
        outputLanguage: normalizeOutputLanguage(normalizedPayload.outputLanguage),
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      },
      error
    });
    recordTimingPhase(
      debugTrace,
      performancePhases,
      'totalGenerationMs',
      'Total summary generation',
      totalDurationMs
    );
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    await appendSummaryGenerationDebugLog(debugTrace);
    throw error;
  }
});

ipcMain.handle('draft:translate-output', async (_event, payload) => {
  const normalizedPayload = validateDraftTranslationPayload(payload);
  const settings = await getSettingsStore().load();
  const validation = validateSettings(settings);
  const runId = createDiagnosticRunId('translation');
  const startedAt = new Date().toISOString();
  const totalTimer = startTimer();
  const debugTrace = [];
  pushDiagnosticContext(debugTrace, {
    operation: 'Draft translation',
    runId,
    startedAt
  });
  debugTrace.push(`Source language: ${normalizeOutputLanguage(normalizedPayload.sourceLanguage)}`);
  debugTrace.push(`Target language: ${normalizeOutputLanguage(normalizedPayload.targetLanguage)}`);
  debugTrace.push(`Output mode: ${normalizedPayload.outputMode === 'anonymous' ? 'anonymous' : 'named'}`);
  debugTrace.push(`CV source file: ${path.basename(normalizedPayload?.cvDocument?.file?.path || normalizedPayload?.cvDocument?.file?.name || '') || '(unknown)'}`);
  debugTrace.push(`JD source file: ${path.basename(normalizedPayload?.jdDocument?.file?.path || normalizedPayload?.jdDocument?.file?.name || '') || '(unknown)'}`);
  debugTrace.push(`Summary length: ${String(normalizedPayload.summary || '').length}`);
  debugTrace.push(`Briefing payload length: ${JSON.stringify(normalizedPayload.briefing || {}).length}`);

  if (!validation.isValid) {
    debugTrace.push(`Settings validation failed: ${validation.errors.join(' | ')}`);
    const totalDurationMs = totalTimer();
    await appendOperationPerformanceRecord({
      operation: 'draft-translation',
      runId,
      startedAt,
      status: 'failed',
      totalMs: totalDurationMs,
      phases: {
        totalTranslationMs: totalDurationMs
      },
      context: {
        outputMode: normalizedPayload.outputMode,
        sourceLanguage: normalizeOutputLanguage(normalizedPayload.sourceLanguage),
        targetLanguage: normalizeOutputLanguage(normalizedPayload.targetLanguage),
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      },
      error: new Error(validation.errors.join(' '))
    });
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    await appendSummaryGenerationDebugLog(debugTrace);
    throw new Error(validation.errors.join(' '));
  }

  const sourceLanguage = normalizeOutputLanguage(normalizedPayload.sourceLanguage);
  const targetLanguage = normalizeOutputLanguage(normalizedPayload.targetLanguage);

  if (sourceLanguage === targetLanguage) {
    const preparedOutput = applyDraftOutputMode({
      outputMode: normalizedPayload.outputMode,
      recruiterSummary: normalizedPayload.summary,
      briefing: normalizedPayload.briefing,
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument
    });
    const reviewPresentation = buildReviewPresentation({
      briefing: preparedOutput.briefing,
      recruiterSummary: preparedOutput.summary,
      outputLanguage: targetLanguage,
      outputMode: normalizedPayload.outputMode,
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument,
      existingWarnings: preparedOutput.warnings,
      summaryRetrievalManifest: normalizedPayload.summaryRetrievalManifest,
      briefingRetrievalManifest: normalizedPayload.briefingRetrievalManifest
    });
    const reviewWarnings = reviewPresentation.reviewWarnings;
    const composed = reviewPresentation.hiringManagerBriefing;

    pushDiagnosticResult(debugTrace, {
      status: 'skipped'
    });
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    const performance = await appendOperationPerformanceRecord({
      operation: 'draft-translation',
      runId,
      startedAt,
      status: 'skipped',
      totalMs: 0,
      phases: {
        totalTranslationMs: 0
      },
      context: {
        outputMode: normalizedPayload.outputMode,
        sourceLanguage,
        targetLanguage,
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      }
    });
    await appendSummaryGenerationDebugLog(debugTrace);
    return {
      summary: normalizedPayload.summary,
      briefing: normalizedPayload.briefing,
      hiringManagerBriefingReview: composed.review,
      outputLanguage: targetLanguage,
      approvalWarnings: reviewWarnings,
      performance
    };
  }

  const currentBriefing = normalizedPayload.briefing
    ? applySummaryOverridesToBriefing(normalizedPayload.briefing, normalizedPayload.summary)
    : buildFallbackBriefing({
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument,
      outputLanguage: sourceLanguage
    });

  if (isE2EMockLlmEnabled()) {
    const mockResult = await buildE2EMockTranslatedDraftResult({
      payload: normalizedPayload,
      targetLanguage,
      debugTrace
    });
    pushDiagnosticResult(debugTrace, {
      status: 'success'
    });
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    await appendOperationPerformanceRecord({
      operation: 'draft-translation',
      runId,
      startedAt,
      status: 'success',
      totalMs: mockResult.performance?.totalMs,
      phases: mockResult.performance?.phases,
      context: {
        outputMode: normalizedPayload.outputMode,
        sourceLanguage,
        targetLanguage,
        providerLabel: 'E2E Mock',
        model: 'deterministic-local',
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      }
    });
    await appendSummaryGenerationDebugLog(debugTrace);
    return mockResult;
  }

  try {
    const translated = await translateDraftArtifacts({
      settings,
      summary: normalizedPayload.summary,
      briefing: currentBriefing,
      sourceLanguage,
      targetLanguage,
      includeSummaryTranslation: true,
      debugTrace,
      fetchImpl: (...args) => net.fetch(...args)
    });

    const preparedOutput = applyDraftOutputMode({
      outputMode: normalizedPayload.outputMode,
      recruiterSummary: translated.summary,
      briefing: translated.briefing,
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument
    });
    const reviewPresentation = buildReviewPresentation({
      briefing: preparedOutput.briefing,
      recruiterSummary: preparedOutput.summary,
      outputLanguage: targetLanguage,
      outputMode: normalizedPayload.outputMode,
      cvDocument: normalizedPayload.cvDocument,
      jdDocument: normalizedPayload.jdDocument,
      existingWarnings: preparedOutput.warnings,
      summaryRetrievalManifest: normalizedPayload.summaryRetrievalManifest,
      briefingRetrievalManifest: normalizedPayload.briefingRetrievalManifest
    });
    const reviewWarnings = reviewPresentation.reviewWarnings;
    const composed = reviewPresentation.hiringManagerBriefing;

    pushDiagnosticResult(debugTrace, {
      status: 'success'
    });
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    const performance = await appendOperationPerformanceRecord({
      operation: 'draft-translation',
      runId,
      startedAt,
      status: 'success',
      totalMs: translated.performance?.totalMs,
      phases: translated.performance?.phases,
      context: {
        outputMode: normalizedPayload.outputMode,
        sourceLanguage,
        targetLanguage,
        providerLabel: settings.providerLabel,
        model: settings.model,
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      }
    });
    await appendSummaryGenerationDebugLog(debugTrace);
    return {
      summary: translated.summary,
      briefing: translated.briefing,
      hiringManagerBriefingReview: composed.review,
      outputLanguage: targetLanguage,
      approvalWarnings: reviewWarnings,
      performance
    };
  } catch (error) {
    debugTrace.push(`Draft translation failed: ${error instanceof Error ? error.message : 'Unknown translation failure.'}`);
    pushDiagnosticResult(debugTrace, {
      status: 'failed',
      error
    });
    const totalDurationMs = totalTimer();
    await appendOperationPerformanceRecord({
      operation: 'draft-translation',
      runId,
      startedAt,
      status: 'failed',
      totalMs: totalDurationMs,
      phases: {
        totalTranslationMs: totalDurationMs
      },
      context: {
        outputMode: normalizedPayload.outputMode,
        sourceLanguage,
        targetLanguage,
        ...extractDocumentPerformanceContext(normalizedPayload.cvDocument, 'cv'),
        ...extractDocumentPerformanceContext(normalizedPayload.jdDocument, 'jd')
      },
      error
    });
    debugTrace.push(`Summary generation debug log path: ${getSummaryGenerationDebugLogPath()}`);
    debugTrace.push(`Performance stats log path: ${getPerformanceStatsLogPath()}`);
    await appendSummaryGenerationDebugLog(debugTrace);
    throw error;
  }
});

ipcMain.handle('briefing:render-review', async (_event, payload) => {
  const normalizedPayload = validateRenderBriefingPayload(payload);
  const outputLanguage = normalizeOutputLanguage(normalizedPayload.outputLanguage);
  const fallbackBriefing = buildFallbackBriefing({
    cvDocument: normalizedPayload.cvDocument,
    jdDocument: normalizedPayload.jdDocument,
    outputLanguage
  });
  const requestedBriefing = normalizedPayload.briefing
    ? mergeBriefingWithFallback(normalizedPayload.briefing, fallbackBriefing)
    : fallbackBriefing;
  const preparedOutput = applyDraftOutputMode({
    outputMode: normalizedPayload.outputMode,
    recruiterSummary: normalizedPayload.summary,
    briefing: requestedBriefing,
    cvDocument: normalizedPayload.cvDocument,
    jdDocument: normalizedPayload.jdDocument
  });
  const reviewPresentation = buildReviewPresentation({
    briefing: preparedOutput.briefing,
    recruiterSummary: preparedOutput.summary,
    outputLanguage,
    outputMode: normalizedPayload.outputMode,
    cvDocument: normalizedPayload.cvDocument,
    jdDocument: normalizedPayload.jdDocument,
    existingWarnings: preparedOutput.warnings,
    summaryRetrievalManifest: normalizedPayload.summaryRetrievalManifest,
    briefingRetrievalManifest: normalizedPayload.briefingRetrievalManifest
  });
  const reviewWarnings = reviewPresentation.reviewWarnings;
  const composed = reviewPresentation.hiringManagerBriefing;

  return {
    briefing: requestedBriefing,
    hiringManagerBriefingReview: composed.review,
    summary: normalizedPayload.summary,
    modeLabel: preparedOutput.modeLabel,
    approvalWarnings: reviewWarnings
  };
});

ipcMain.handle('clipboard:write-text', async (_event, value) => {
  clipboard.writeText(validateClipboardTextPayload(value));
  return true;
});

ipcMain.handle('shell:reveal-in-folder', async (_event, filePath) => {
  const normalizedPath = validateShellPathPayload(filePath);
  await fs.access(normalizedPath);
  shell.showItemInFolder(normalizedPath);
  return true;
});

ipcMain.handle('shell:open-path', async (_event, filePath) => {
  const normalizedPath = validateShellPathPayload(filePath);
  await fs.access(normalizedPath);
  const shellResult = await shell.openPath(normalizedPath);

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

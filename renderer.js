function createEmptyDraftVariants() {
  return {
    named: {
      en: null,
      zh: null
    },
    anonymous: {
      en: null,
      zh: null
    }
  };
}

function createEmptyRetrievalEvidence() {
  return {
    summary: [],
    briefing: []
  };
}

function createEmptySourceFolderState() {
  return {
    path: '',
    name: '',
    files: [],
    error: '',
    selectedJdPath: '',
    selectedCvPath: ''
  };
}

const state = {
  view: 'workbench',
  workbenchTab: 'summary',
  contextTab: 'workspace',
  settingsTab: 'llm',
  providers: [],
  settings: null,
  settingsValidation: {
    isValid: false,
    errors: []
  },
  documents: {
    cv: createEmptyDocumentSlot('cv'),
    jd: createEmptyDocumentSlot('jd')
  },
  sourceFolder: createEmptySourceFolderState(),
  currentContextProfile: null,
  recentWorkspaces: [],
  currentWorkspaceId: '',
  briefing: null,
  briefingReview: '',
  summary: '',
  outputMode: 'named',
  outputLanguage: 'en',
  pendingOutputLanguage: '',
  draftVariants: createEmptyDraftVariants(),
  retrievalEvidence: createEmptyRetrievalEvidence(),
  draftLifecycle: 'empty',
  approvalWarnings: [],
  lastExportPath: '',
  debugTrace: [],
  isLoadingWorkspace: false,
  isGenerating: false,
  isTranslating: false,
  isSwitchingMode: false,
  isSavingWordDraft: false,
  isSharingEmail: false,
  progressLabel: 'Generating summary with the configured model...',
  summaryStatus: 'No Draft',
  summaryMessage: 'Load the CV and JD, then generate the summary.',
  generationError: '',
  lastFailure: null,
  settingsIssue: null,
  templateLabel: 'Default Recruiter Profile Template'
};

let currentContextProfileRequestId = 0;
const e2eFailureInjection = {
  loadConfiguration: '',
  saveSettings: '',
  chooseReferenceTemplate: '',
  chooseWordTemplate: '',
  chooseBriefingOutputFolder: '',
  refreshBriefingReview: ''
};

const elements = {
  workbenchView: document.getElementById('workbench-view'),
  settingsView: document.getElementById('settings-view'),
  openCvTab: document.getElementById('open-cv-tab'),
  openJdTab: document.getElementById('open-jd-tab'),
  openSummaryTab: document.getElementById('open-summary-tab'),
  openBriefingTab: document.getElementById('open-briefing-tab'),
  cvPanel: document.getElementById('cv-panel'),
  jdPanel: document.getElementById('jd-panel'),
  summaryPanel: document.getElementById('summary-panel'),
  briefingPanel: document.getElementById('briefing-panel'),
  cvNavStatus: document.getElementById('cv-nav-status'),
  jdNavStatus: document.getElementById('jd-nav-status'),
  summaryNavStatus: document.getElementById('summary-nav-status'),
  briefingNavStatus: document.getElementById('briefing-nav-status'),
  openSettingsView: document.getElementById('open-settings-view'),
  returnToWorkbenchButton: document.getElementById('return-to-workbench-button'),
  settingsStatusChip: document.getElementById('settings-status-chip'),
  settingsStatusMessage: document.getElementById('settings-status-message'),
  providerHelpText: document.getElementById('provider-help-text'),
  providerSelect: document.getElementById('provider-select'),
  baseUrlInput: document.getElementById('base-url-input'),
  modelInput: document.getElementById('model-input'),
  apiKeyInput: document.getElementById('api-key-input'),
  temperatureInput: document.getElementById('temperature-input'),
  maxTokensInput: document.getElementById('max-tokens-input'),
  systemPromptInput: document.getElementById('system-prompt-input'),
  saveSettingsButton: document.getElementById('save-settings-button'),
  openLlmSettingsTab: document.getElementById('open-llm-settings-tab'),
  openSummaryGuidanceSettingsTab: document.getElementById('open-summary-guidance-settings-tab'),
  openWordTemplateSettingsTab: document.getElementById('open-word-template-settings-tab'),
  llmSettingsPanel: document.getElementById('llm-settings-panel'),
  summaryGuidanceSettingsPanel: document.getElementById('summary-guidance-settings-panel'),
  wordTemplateSettingsPanel: document.getElementById('word-template-settings-panel'),
  settingsIssuePanel: document.getElementById('settings-issue-panel'),
  settingsIssueTitle: document.getElementById('settings-issue-title'),
  settingsIssueMessage: document.getElementById('settings-issue-message'),
  retrySettingsIssueButton: document.getElementById('retry-settings-issue-button'),
  dismissSettingsIssueButton: document.getElementById('dismiss-settings-issue-button'),
  chooseWordTemplateButton: document.getElementById('choose-word-template-button'),
  clearWordTemplateButton: document.getElementById('clear-word-template-button'),
  chooseBriefingOutputFolderButton: document.getElementById('choose-briefing-output-folder-button'),
  clearBriefingOutputFolderButton: document.getElementById('clear-briefing-output-folder-button'),
  referenceTemplateModeSelect: document.getElementById('reference-template-mode-select'),
  chooseReferenceTemplateButton: document.getElementById('choose-reference-template-button'),
  clearReferenceTemplateButton: document.getElementById('clear-reference-template-button'),
  referenceTemplateName: document.getElementById('reference-template-name'),
  referenceTemplatePath: document.getElementById('reference-template-path'),
  referenceTemplateNote: document.getElementById('reference-template-note'),
  wordTemplateName: document.getElementById('word-template-name'),
  wordTemplatePath: document.getElementById('word-template-path'),
  briefingOutputFolderName: document.getElementById('briefing-output-folder-name'),
  briefingOutputFolderPath: document.getElementById('briefing-output-folder-path'),
  templateConfigNote: document.getElementById('template-config-note'),
  currentContextPanel: document.getElementById('current-context-panel'),
  currentWorkspaceNote: document.getElementById('current-workspace-note'),
  currentContextFilesInline: document.getElementById('current-context-files-inline'),
  currentContextStatus: document.getElementById('current-context-status'),
  currentRoleField: document.getElementById('current-role-field'),
  currentRoleName: document.getElementById('current-role-name'),
  currentCandidateField: document.getElementById('current-candidate-field'),
  currentCandidateName: document.getElementById('current-candidate-name'),
  dropzone: document.getElementById('dropzone'),
  openWorkspaceContextTab: document.getElementById('open-workspace-context-tab'),
  openManualContextTab: document.getElementById('open-manual-context-tab'),
  openRecentContextTab: document.getElementById('open-recent-context-tab'),
  workspaceContextPanel: document.getElementById('workspace-context-panel'),
  manualContextPanel: document.getElementById('manual-context-panel'),
  recentContextPanel: document.getElementById('recent-context-panel'),
  swapSourceButton: document.getElementById('swap-source-button'),
  chooseSourceFolderButton: document.getElementById('choose-source-folder-button'),
  refreshSourceFolderButton: document.getElementById('refresh-source-folder-button'),
  sourceFolderName: document.getElementById('source-folder-name'),
  sourceFolderPath: document.getElementById('source-folder-path'),
  sourceFolderWorkspace: document.getElementById('source-folder-workspace'),
  sourceFolderJdSelect: document.getElementById('source-folder-jd-select'),
  sourceFolderCvSelect: document.getElementById('source-folder-cv-select'),
  sourceFolderEmptyNote: document.getElementById('source-folder-empty-note'),
  recentWorkSection: document.getElementById('recent-work-section'),
  recentWorkList: document.getElementById('recent-work-list'),
  recentWorkEmpty: document.getElementById('recent-work-empty'),
  clearRecentWorkspacesButton: document.getElementById('clear-recent-workspaces-button'),
  toggleAnonymousModeButton: document.getElementById('toggle-anonymous-mode-button'),
  anonymousModeValue: document.getElementById('anonymous-mode-value'),
  toggleOutputLanguageButton: document.getElementById('toggle-output-language-button'),
  outputLanguageFlag: document.getElementById('output-language-flag'),
  generateButton: document.getElementById('generate-summary-button'),
  resetButton: document.getElementById('reset-workspace-button'),
  summaryStatus: document.getElementById('summary-status'),
  summaryMessage: document.getElementById('summary-message'),
  generationProgress: document.getElementById('generation-progress'),
  generationProgressLabel: document.getElementById('generation-progress-label'),
  operationFailurePanel: document.getElementById('operation-failure-panel'),
  operationFailureTitle: document.getElementById('operation-failure-title'),
  operationFailureMessage: document.getElementById('operation-failure-message'),
  retryFailureActionButton: document.getElementById('retry-failure-action-button'),
  dismissFailureActionButton: document.getElementById('dismiss-failure-action-button'),
  summaryEditor: document.getElementById('summary-editor'),
  approveDraftButton: document.getElementById('approve-draft-button'),
  copySummaryButton: document.getElementById('copy-summary-button'),
  shareByEmailButton: document.getElementById('share-by-email-button'),
  exportWordDraftButton: document.getElementById('export-word-draft-button'),
  revealWordDraftButton: document.getElementById('reveal-word-draft-button'),
  openWordDraftButton: document.getElementById('open-word-draft-button'),
  debugTrace: document.getElementById('debug-trace'),
  summaryEvidencePanel: document.getElementById('summary-evidence-panel'),
  summaryEvidenceSummaryList: document.getElementById('summary-evidence-summary-list'),
  summaryEvidenceBriefingList: document.getElementById('summary-evidence-briefing-list'),
  draftModePill: document.getElementById('draft-mode-pill'),
  draftLifecyclePill: document.getElementById('draft-lifecycle-pill'),
  templateLabel: document.getElementById('template-label'),
  draftMeta: document.getElementById('draft-meta'),
  approvalWarningPanel: document.getElementById('approval-warning-panel'),
  approvalWarningList: document.getElementById('approval-warning-list'),
  briefingStatus: document.getElementById('briefing-status'),
  briefingPreview: document.getElementById('briefing-preview'),
  cv: {
    chooseButton: document.getElementById('choose-cv-button'),
    previewStatus: document.getElementById('cv-preview-status'),
    previewText: document.getElementById('cv-preview-text')
  },
  jd: {
    chooseButton: document.getElementById('choose-jd-button'),
    previewStatus: document.getElementById('jd-preview-status'),
    previewText: document.getElementById('jd-preview-text')
  }
};

function createEmptyDocumentSlot(slot) {
  return {
    slot,
    file: null,
    text: '',
    previewText: '',
    warnings: [],
    error: null
  };
}

const SUPPORTED_SOURCE_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

function formatExtension(extension) {
  if (!extension || extension === 'unknown') {
    return 'File type pending';
  }

  return extension.replace('.', '').toUpperCase();
}

function formatFileSize(sizeBytes) {
  const numeric = Number(sizeBytes) || 0;

  if (numeric < 1024) {
    return `${numeric} B`;
  }

  if (numeric < 1024 * 1024) {
    return `${(numeric / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  }

  return `${(numeric / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

function getPathExtension(filePath) {
  const normalizedPath = String(filePath || '').trim().toLowerCase();
  const lastDotIndex = normalizedPath.lastIndexOf('.');
  const lastSlashIndex = Math.max(normalizedPath.lastIndexOf('/'), normalizedPath.lastIndexOf('\\'));

  if (lastDotIndex === -1 || lastDotIndex < lastSlashIndex) {
    return '';
  }

  return normalizedPath.slice(lastDotIndex);
}

function buildUnsupportedImportResult(filePath) {
  const normalizedPath = String(filePath || '').trim();
  const extension = getPathExtension(normalizedPath) || 'unknown';

  return {
    file: {
      path: normalizedPath,
      name: normalizedPath.split(/[\\/]/).pop() || normalizedPath || 'Unsupported file',
      extension,
      sizeBytes: 0,
      importStatus: 'error'
    },
    text: '',
    previewText: '',
    warnings: [],
    error: 'Unsupported file type. Only PDF, DOCX, and TXT files can be loaded as source documents.'
  };
}

function getSlotDefaultNote(slot) {
  return 'Drop or choose a file.';
}

function getSlotDefaultPreview(slot) {
  return '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRichText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cloneDraftData(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeDraftVariantMode(mode) {
  return mode === 'anonymous' ? 'anonymous' : 'named';
}

function normalizeDraftVariantLanguage(language) {
  return language === 'zh' ? 'zh' : 'en';
}

function normalizeCurrentContextProfile(profile = {}) {
  return {
    candidateName: String(profile.candidateName || '').trim(),
    roleTitle: String(profile.roleTitle || '').trim(),
    candidateLocation: String(profile.candidateLocation || '').trim(),
    candidatePreferredLocation: String(profile.candidatePreferredLocation || '').trim(),
    candidateNationality: String(profile.candidateNationality || '').trim(),
    candidateLanguages: Array.isArray(profile.candidateLanguages)
      ? profile.candidateLanguages.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [],
    noticePeriod: String(profile.noticePeriod || '').trim(),
    jobTitle: String(profile.jobTitle || '').trim(),
    companyName: String(profile.companyName || '').trim()
  };
}

function normalizeRetrievalManifest(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    blockId: String(entry?.blockId || '').trim(),
    documentType: String(entry?.documentType || '').trim(),
    documentLabel: String(entry?.documentLabel || '').trim(),
    sourceName: String(entry?.sourceName || '').trim(),
    sectionKey: String(entry?.sectionKey || '').trim(),
    sectionLabel: String(entry?.sectionLabel || '').trim(),
    preview: String(entry?.preview || '').trim(),
    order: Number(entry?.order) || 0,
    score: Number(entry?.score) || 0
  }));
}

function cacheDraftVariant(mode = state.outputMode, language = state.outputLanguage) {
  const normalizedMode = normalizeDraftVariantMode(mode);
  const normalizedLanguage = normalizeDraftVariantLanguage(language);

  if (!state.summary.trim()) {
    state.draftVariants[normalizedMode][normalizedLanguage] = null;
    return;
  }

  state.draftVariants[normalizedMode][normalizedLanguage] = {
    summary: state.summary,
    briefing: cloneDraftData(state.briefing),
    briefingReview: state.briefingReview,
    approvalWarnings: [...state.approvalWarnings],
    draftLifecycle: state.draftLifecycle
  };
}

function cloneDraftVariantsSnapshot(input) {
  const snapshot = createEmptyDraftVariants();

  if (!input || typeof input !== 'object') {
    return snapshot;
  }

  ['named', 'anonymous'].forEach((mode) => {
    ['en', 'zh'].forEach((language) => {
      const variant = input?.[mode]?.[language];

      if (!variant || typeof variant !== 'object') {
        snapshot[mode][language] = null;
        return;
      }

      snapshot[mode][language] = {
        summary: String(variant.summary || ''),
        briefing: cloneDraftData(variant.briefing),
        briefingReview: String(variant.briefingReview || ''),
        approvalWarnings: Array.isArray(variant.approvalWarnings)
          ? variant.approvalWarnings.map((warning) => String(warning || '').trim()).filter(Boolean)
          : [],
        draftLifecycle: String(variant.draftLifecycle || '').trim() || (variant.summary ? 'generated' : 'empty')
      };
    });
  });

  return snapshot;
}

function clearCachedDraftVariants() {
  state.draftVariants = createEmptyDraftVariants();
}

function getCachedDraftVariant(mode, language) {
  const normalizedMode = normalizeDraftVariantMode(mode);
  const normalizedLanguage = normalizeDraftVariantLanguage(language);
  return state.draftVariants[normalizedMode][normalizedLanguage];
}

function applyCachedDraftVariant(mode, language, snapshot, message) {
  if (!snapshot) {
    return;
  }

  state.summary = snapshot.summary || '';
  state.briefing = cloneDraftData(snapshot.briefing);
  state.briefingReview = snapshot.briefingReview || '';
  state.outputMode = normalizeDraftVariantMode(mode);
  state.outputLanguage = normalizeDraftVariantLanguage(language);
  state.pendingOutputLanguage = '';
  state.approvalWarnings = [...(snapshot.approvalWarnings || [])];
  state.draftLifecycle = snapshot.draftLifecycle || (state.summary ? 'generated' : 'empty');
  state.lastExportPath = '';
  state.summaryStatus = 'Ready';
  state.summaryMessage = message || 'Restored the existing draft variant without regeneration.';
  state.generationError = '';
}

const CV_SECTION_TITLES = new Set([
  'experience',
  'employment experience',
  'professional experience',
  'project experience',
  'education',
  'skills',
  'summary',
  'profile',
  'languages',
  'language',
  'certifications',
  'availability',
  'notice period'
]);

const CV_EXPERIENCE_SECTION_TITLES = new Set([
  'experience',
  'employment experience',
  'professional experience',
  'project experience'
]);

const CV_DATE_RANGE_PATTERN =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}(?:[./-]\d{1,2})?\s*[–-]\s*(?:present|current|now|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}(?:[./-]\d{1,2})?)\b/i;

function normalizeHeadingKey(value) {
  return String(value || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .toLowerCase();
}

function isCvSectionHeading(line) {
  return CV_SECTION_TITLES.has(normalizeHeadingKey(line));
}

function isCvDateLine(line) {
  return CV_DATE_RANGE_PATTERN.test(line.trim());
}

function isCvBulletLine(line) {
  return /^[-*•]\s+/.test(line.trim());
}

function looksLikeCvName(line) {
  const value = line.trim();

  if (!value || value.length > 56 || /\d|@/.test(value)) {
    return false;
  }

  return /^[A-Z][A-Za-z'-]+(?: [A-Z][A-Za-z'-]+){1,4}$/.test(value);
}

function isContactLikeLine(line) {
  const value = line.trim();

  if (!value) {
    return false;
  }

  return /@|https?:\/\/|linkedin|www\.|^\+?[\d()\s-]{7,}$/.test(value);
}

function looksLikeCompanyName(line) {
  return /\b(group|company|corp|corporation|inc|inc\.|ltd|limited|llc|plc|pte|partners|solutions|technologies|technology|systems|bank|capital|consulting|advisors|advisory|university|college|school)\b/i.test(line.trim());
}

function splitCvRoleCompanyLine(value) {
  const normalized = value.trim();
  const separators = [/\s+\|\s+/i, /\s+at\s+/i, /\s+@\s+/i];

  for (const separator of separators) {
    const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
      return {
        title: parts[0],
        company: parts.slice(1).join(' | ')
      };
    }
  }

  return {
    title: normalized,
    company: ''
  };
}

function renderCvEntry({ title, company = '', date = '' }) {
  const metaParts = [company, date].filter(Boolean);

  return [
    '<div class="cv-entry">',
    `<p class="cv-entry-title">${escapeHtml(title)}</p>`,
    metaParts.length > 0 ? `<p class="cv-entry-meta">${escapeHtml(metaParts.join(' · '))}</p>` : '',
    '</div>'
  ].join('');
}

function isLikelyHeading(line) {
  const value = line.trim();

  if (!value || value.length > 72) {
    return false;
  }

  if (/^[A-Z][A-Za-z0-9/&(),'\- ]+:$/.test(value)) {
    return true;
  }

  if (
    /^[A-Z][A-Za-z0-9/&(),'\- ]+$/.test(value) &&
    value.split(/\s+/).length <= 7 &&
    !/[.!?]$/.test(value)
  ) {
    return true;
  }

  return false;
}

function isLabelValueLine(line) {
  return /^([A-Z][A-Za-z0-9/&(),'\- ]{1,42}):\s+(.+)$/.test(line.trim());
}

function renderCvDocument(text) {
  const normalized = normalizeRichText(text);

  if (!normalized) {
    return '<p class="empty-state">No readable content available yet.</p>';
  }

  const lines = normalized.split('\n');
  const blocks = [];
  let listItems = [];
  let paragraphLines = [];
  let currentSection = '';

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' ')
    });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({
      type: 'list',
      items: [...listItems]
    });
    listItems = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    const nextLine = lines[index + 1]?.trim() || '';
    const nextNextLine = lines[index + 2]?.trim() || '';

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (blocks.length === 0 && looksLikeCvName(line)) {
      flushParagraph();
      blocks.push({
        type: 'cv-name',
        text: line
      });
      continue;
    }

    if (isCvSectionHeading(line)) {
      flushParagraph();
      flushList();
      currentSection = normalizeHeadingKey(line);
      blocks.push({
        type: 'heading',
        text: line.replace(/:$/, '')
      });
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);

    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    if (currentSection && CV_EXPERIENCE_SECTION_TITLES.has(currentSection)) {
      if (isCvDateLine(line) && nextLine && !isCvBulletLine(nextLine) && !isCvSectionHeading(nextLine) && !isCvDateLine(nextLine)) {
        flushParagraph();
        flushList();

        const splitLine = splitCvRoleCompanyLine(nextLine);
        blocks.push({
          type: 'cv-entry',
          title: splitLine.title,
          company: splitLine.company,
          date: line
        });
        index += 1;
        continue;
      }

      if (nextLine && isCvDateLine(nextLine)) {
        flushParagraph();
        flushList();

        const splitLine = splitCvRoleCompanyLine(line);
        blocks.push({
          type: 'cv-entry',
          title: splitLine.title,
          company: splitLine.company,
          date: nextLine
        });
        index += 1;
        continue;
      }

      if (nextLine && !isCvBulletLine(nextLine) && !isCvDateLine(nextLine) && nextNextLine && isCvDateLine(nextNextLine)) {
        flushParagraph();
        flushList();

        let titleLine = line;
        let companyLine = nextLine;

        if (looksLikeCompanyName(line) && !looksLikeCompanyName(nextLine)) {
          titleLine = nextLine;
          companyLine = line;
        }

        blocks.push({
          type: 'cv-entry',
          title: titleLine,
          company: companyLine,
          date: nextNextLine
        });
        index += 2;
        continue;
      }
    }

    flushList();

    if (isContactLikeLine(line)) {
      flushParagraph();
      blocks.push({
        type: 'cv-contact',
        text: line
      });
      continue;
    }

    const labelMatch = isLabelValueLine(line)
      ? line.match(/^([A-Z][A-Za-z0-9/&(),'\- ]{1,42}):\s+(.+)$/)
      : null;

    if (labelMatch) {
      flushParagraph();
      blocks.push({
        type: 'label',
        label: labelMatch[1],
        value: labelMatch[2]
      });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks
    .map((block) => {
      if (block.type === 'cv-name') {
        return `<p class="cv-name">${escapeHtml(block.text)}</p>`;
      }

      if (block.type === 'cv-contact') {
        return `<p class="cv-contact">${escapeHtml(block.text)}</p>`;
      }

      if (block.type === 'cv-entry') {
        return renderCvEntry(block);
      }

      if (block.type === 'heading') {
        return `<h3>${escapeHtml(block.text)}</h3>`;
      }

      if (block.type === 'label') {
        return `<p class="label-line"><span class="label-title">${escapeHtml(block.label)}:</span> ${escapeHtml(block.value)}</p>`;
      }

      if (block.type === 'list') {
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      }

      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join('');
}

function renderRichDocument(text, options = {}) {
  const mode = options.mode || 'default';

  if (mode === 'cv') {
    return renderCvDocument(text);
  }

  const normalized = normalizeRichText(text);

  if (!normalized) {
    return '<p class="empty-state">No readable content available yet.</p>';
  }

  const lines = normalized.split('\n');
  const blocks = [];
  let listItems = [];
  let paragraphLines = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' ')
    });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({
      type: 'list',
      items: [...listItems]
    });
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);

    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();

    const markdownHeadingMatch = line.match(/^#{1,6}\s+(.+)$/);

    if (markdownHeadingMatch) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        text: markdownHeadingMatch[1].trim()
      });
      continue;
    }

    if (isLikelyHeading(line)) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        text: line.replace(/:$/, '')
      });
      continue;
    }

    const labelMatch = isLabelValueLine(line)
      ? line.match(/^([A-Z][A-Za-z0-9/&(),'\- ]{1,42}):\s+(.+)$/)
      : null;

    if (labelMatch) {
      flushParagraph();
      blocks.push({
        type: 'label',
        label: labelMatch[1],
        value: labelMatch[2]
      });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks
    .map((block) => {
      if (block.type === 'heading') {
        return `<h3>${escapeHtml(block.text)}</h3>`;
      }

      if (block.type === 'label') {
        return `<p class="label-line"><span class="label-title">${escapeHtml(block.label)}:</span> ${escapeHtml(block.value)}</p>`;
      }

      if (block.type === 'list') {
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      }

      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join('');
}

function setRichDocumentContent(element, text, options = {}) {
  const normalized = normalizeRichText(text);
  const mode = options.mode || 'default';
  const showEmptyState = options.showEmptyState !== false;

  if (!normalized && (!showEmptyState || element.isContentEditable)) {
    if (element.dataset.rawText === '' && element.innerHTML === '') {
      return;
    }

    element.dataset.rawText = '';
    element.dataset.renderMode = mode;
    element.innerHTML = '';
    return;
  }

  const nextHtml = renderRichDocument(normalized, options);

  if (
    element.dataset.rawText === normalized &&
    element.dataset.renderMode === mode &&
    element.innerHTML === nextHtml
  ) {
    return;
  }

  element.dataset.rawText = normalized;
  element.dataset.renderMode = mode;
  element.innerHTML = nextHtml;
}

function readSummaryEditorText() {
  return normalizeRichText(elements.summaryEditor.innerText);
}

function getSlotStatusChip(slotState) {
  if (!slotState.file) {
    return 'Not Loaded';
  }

  if (slotState.error) {
    return 'Issue';
  }

  if (slotState.warnings.length > 0) {
    return 'Warning';
  }

  return 'Ready';
}

function stripFileExtension(filename) {
  return String(filename || '').replace(/\.[^.]+$/, '');
}

function normalizeContextIdentityKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function isGenericCurrentCandidateLabel(value, fileName = '') {
  const normalized = normalizeContextIdentityKey(value);
  const normalizedFileStem = normalizeContextIdentityKey(stripFileExtension(fileName));

  return Boolean(
    !normalized ||
    normalized === normalizedFileStem ||
    ['candidate', 'candidatecv', 'cv', 'profile', 'resume'].includes(normalized)
  );
}

function isGenericCurrentRoleLabel(value, fileName = '') {
  const normalized = normalizeContextIdentityKey(value);
  const normalizedFileStem = normalizeContextIdentityKey(stripFileExtension(fileName));

  return Boolean(
    !normalized ||
    normalized === normalizedFileStem ||
    ['role', 'jd', 'jobdescription', 'information', 'info', '岗位信息', '职位信息', '职位描述', '岗位描述'].includes(normalized)
  );
}

function getActiveWorkspaceMeta() {
  return state.recentWorkspaces.find((workspace) => workspace.workspaceId === state.currentWorkspaceId) || null;
}

function getCurrentRoleLabel() {
  const derivedRoleTitle = String(state.currentContextProfile?.roleTitle || '').trim();

  if (derivedRoleTitle && !isGenericCurrentRoleLabel(derivedRoleTitle, state.documents.jd.file?.name || '')) {
    return derivedRoleTitle;
  }

  const briefingRoleTitle = String(state.briefing?.role?.title || '').trim();

  if (briefingRoleTitle && !isGenericCurrentRoleLabel(briefingRoleTitle, state.documents.jd.file?.name || '')) {
    return briefingRoleTitle;
  }

  const workspaceRoleTitle = String(getActiveWorkspaceMeta()?.roleTitle || '').trim();

  if (workspaceRoleTitle && !isGenericCurrentRoleLabel(workspaceRoleTitle, state.documents.jd.file?.name || '')) {
    return workspaceRoleTitle;
  }

  return '';
}

function getCurrentCandidateLabel() {
  const derivedCandidateName = String(state.currentContextProfile?.candidateName || '').trim();

  if (derivedCandidateName && !isGenericCurrentCandidateLabel(derivedCandidateName, state.documents.cv.file?.name || '')) {
    return derivedCandidateName;
  }

  const briefingCandidateName = String(state.briefing?.candidate?.name || '').trim();

  if (briefingCandidateName && !isGenericCurrentCandidateLabel(briefingCandidateName, state.documents.cv.file?.name || '')) {
    return briefingCandidateName;
  }

  const workspaceCandidateName = String(getActiveWorkspaceMeta()?.candidateName || '').trim();

  if (workspaceCandidateName && !isGenericCurrentCandidateLabel(workspaceCandidateName, state.documents.cv.file?.name || '')) {
    return workspaceCandidateName;
  }

  return '';
}

function setContextValue(element, value, emptyLabel) {
  const normalized = String(value || '').trim() || emptyLabel;
  const isEmpty = normalized === emptyLabel;
  element.textContent = normalized;
  element.classList.toggle('is-empty', isEmpty);
  return !isEmpty;
}

function getCurrentContextStatus() {
  const importedCount = ['cv', 'jd'].filter((slot) => state.documents[slot].file).length;

  if (state.summary.trim()) {
    return getDraftLifecycleLabel();
  }

  if (importedCount === 2) {
    return 'Ready';
  }

  if (importedCount === 1) {
    return '1 Source Missing';
  }

  return 'Load Sources';
}

function getCurrentContextFilesInlineLabel() {
  const parts = [];

  if (state.documents.cv.file?.name) {
    parts.push(state.documents.cv.file.name);
  }

  if (state.documents.jd.file?.name) {
    parts.push(state.documents.jd.file.name);
  }

  return parts.join(' | ');
}

function renderCurrentContext() {
  const hasWorkspace = Boolean(state.sourceFolder.name);
  const hasCandidateLoaded = Boolean(state.documents.cv.file);

  elements.currentContextPanel.classList.toggle('is-hidden', !hasCandidateLoaded);

  if (!hasCandidateLoaded) {
    elements.currentWorkspaceNote.textContent = '';
    elements.currentContextFilesInline.textContent = '';
    return;
  }

  const hasRole = setContextValue(elements.currentRoleName, getCurrentRoleLabel(), 'No role loaded');
  const hasCandidate = setContextValue(elements.currentCandidateName, getCurrentCandidateLabel(), 'No candidate loaded');

  elements.currentRoleField.classList.toggle('is-hidden', !hasRole);
  elements.currentCandidateField.classList.toggle('is-hidden', !hasCandidate);
  elements.currentContextFilesInline.textContent = getCurrentContextFilesInlineLabel();
  elements.currentContextStatus.textContent = getCurrentContextStatus();
  elements.currentWorkspaceNote.textContent = hasWorkspace
    ? `Workspace: ${state.sourceFolder.name}`
    : 'Manual import workflow active.';
}

function buildCurrentContextProfilePayload() {
  return {
    cvDocument: state.documents.cv.file ? state.documents.cv : null,
    jdDocument: state.documents.jd.file ? state.documents.jd : null
  };
}

async function refreshCurrentContextProfile() {
  const hasLoadedSource = Boolean(state.documents.cv.file || state.documents.jd.file);
  const requestId = ++currentContextProfileRequestId;

  if (!hasLoadedSource) {
    state.currentContextProfile = null;
    renderCurrentContext();
    return;
  }

  try {
    const result = await window.recruitmentApi.deriveWorkspaceProfile(buildCurrentContextProfilePayload());

    if (requestId !== currentContextProfileRequestId) {
      return;
    }

    state.currentContextProfile = normalizeCurrentContextProfile(result?.profile || {});
  } catch (_error) {
    if (requestId !== currentContextProfileRequestId) {
      return;
    }

    state.currentContextProfile = null;
  }

  renderCurrentContext();
}

function getTemplateDisplayName() {
  if (!state.settings?.outputTemplateName) {
    return 'No Word template selected';
  }

  return state.settings.outputTemplateName;
}

function getTemplateDisplayPath() {
  if (!state.settings?.outputTemplatePath) {
    return 'Choose a Word .docx or .dotx template and save settings to copy it into the application template library.';
  }

  return `Active runtime template path: ${state.settings.outputTemplatePath}`;
}

function getBriefingOutputFolderDisplayName() {
  if (!state.settings?.outputBriefingFolderPath) {
    return 'Documents/AtomicGroup Briefings';
  }

  return state.settings.outputBriefingFolderPath;
}

function getBriefingOutputFolderDisplayPath() {
  if (!state.settings?.outputBriefingFolderPath) {
    return 'Generated hiring-manager briefing documents for email handoff are saved to ~/Documents/AtomicGroup Briefings by default.';
  }

  return `Generated hiring-manager briefing documents will be saved to: ${state.settings.outputBriefingFolderPath}`;
}

function getReferenceTemplateDisplayName() {
  if (!state.settings) {
    return 'Built-in default template';
  }

  if (state.settings.referenceTemplateMode !== 'local-file') {
    return 'Built-in default template';
  }

  return state.settings.referenceTemplateName || 'No reference template selected';
}

function getReferenceTemplateDisplayPath() {
  if (!state.settings) {
    return '';
  }

  if (state.settings.referenceTemplateMode !== 'local-file') {
    return 'The built-in recruiter summary template is currently guiding generation.';
  }

  if (!state.settings.referenceTemplatePath) {
    return 'Choose a local Markdown reference template file to ground generation context.';
  }

  return `Selected reference template: ${state.settings.referenceTemplatePath}`;
}

function setView(view) {
  state.view = view;
  elements.workbenchView.classList.toggle('is-hidden', view !== 'workbench');
  elements.settingsView.classList.toggle('is-hidden', view !== 'settings');
}

function setWorkbenchTab(tab) {
  state.workbenchTab = tab;

  const buttonMap = {
    cv: elements.openCvTab,
    jd: elements.openJdTab,
    summary: elements.openSummaryTab,
    briefing: elements.openBriefingTab
  };

  const panelMap = {
    cv: elements.cvPanel,
    jd: elements.jdPanel,
    summary: elements.summaryPanel,
    briefing: elements.briefingPanel
  };

  Object.entries(buttonMap).forEach(([entryTab, button]) => {
    button.classList.toggle('is-active', entryTab === tab);
  });

  Object.entries(panelMap).forEach(([entryTab, panel]) => {
    panel.classList.toggle('is-hidden', entryTab !== tab);
  });
}

function setSettingsTab(tab) {
  state.settingsTab = tab;
  elements.openLlmSettingsTab.classList.toggle('is-active', tab === 'llm');
  elements.openSummaryGuidanceSettingsTab.classList.toggle('is-active', tab === 'summary-guidance');
  elements.openWordTemplateSettingsTab.classList.toggle('is-active', tab === 'word-template');
  elements.llmSettingsPanel.classList.toggle('is-hidden', tab !== 'llm');
  elements.summaryGuidanceSettingsPanel.classList.toggle('is-hidden', tab !== 'summary-guidance');
  elements.wordTemplateSettingsPanel.classList.toggle('is-hidden', tab !== 'word-template');
}

function setContextTab(tab) {
  state.contextTab = tab;

  const buttonMap = {
    workspace: elements.openWorkspaceContextTab,
    manual: elements.openManualContextTab,
    recent: elements.openRecentContextTab
  };

  const panelMap = {
    workspace: elements.workspaceContextPanel,
    manual: elements.manualContextPanel,
    recent: elements.recentContextPanel
  };

  Object.entries(buttonMap).forEach(([entryTab, button]) => {
    button.classList.toggle('is-active', entryTab === tab);
    button.setAttribute('aria-selected', entryTab === tab ? 'true' : 'false');
  });

  Object.entries(panelMap).forEach(([entryTab, panel]) => {
    panel.classList.toggle('is-hidden', entryTab !== tab);
  });
}

const JD_FILENAME_PATTERN = /\b(jd|job[\s._-]*description|role)\b/i;
const CV_FILENAME_PATTERN = /\b(cv|resume|candidate)\b/i;

function getLikelyJdScore(file, allFiles) {
  const normalizedName = String(file?.name || '');
  const docxCount = allFiles.filter((entry) => entry.extension === '.docx').length;
  let score = 0;

  if (JD_FILENAME_PATTERN.test(normalizedName)) {
    score += 8;
  }

  if (/\b(job|description)\b/i.test(normalizedName)) {
    score += 3;
  }

  if (file?.extension === '.docx') {
    score += 2;
  }

  if (docxCount === 1 && allFiles.length > 1 && file?.extension === '.docx') {
    score += 2;
  }

  return score;
}

function getLikelyCvScore(file) {
  const normalizedName = String(file?.name || '');
  let score = 0;

  if (CV_FILENAME_PATTERN.test(normalizedName)) {
    score += 8;
  }

  if (file?.extension === '.pdf') {
    score += 2;
  }

  return score;
}

function sortFilesByLikelyJd(files) {
  return [...files].sort((left, right) => {
    const scoreDelta = getLikelyJdScore(right, files) - getLikelyJdScore(left, files);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

function sortFilesByLikelyCv(files) {
  return [...files].sort((left, right) => {
    const scoreDelta = getLikelyCvScore(right) - getLikelyCvScore(left);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

function getJdWorkspaceFiles() {
  return sortFilesByLikelyJd(state.sourceFolder.files);
}

function getCvWorkspaceFiles() {
  return sortFilesByLikelyCv(
    state.sourceFolder.files.filter((file) => file.path !== state.sourceFolder.selectedJdPath)
  );
}

function ensureSourceFolderSelections() {
  const jdFiles = getJdWorkspaceFiles();
  const selectedJdPath = jdFiles.some((file) => file.path === state.sourceFolder.selectedJdPath)
    ? state.sourceFolder.selectedJdPath
    : chooseDefaultJdPath(jdFiles);
  state.sourceFolder.selectedJdPath = selectedJdPath;

  const cvFiles = getCvWorkspaceFiles();
  const selectedCvPath = cvFiles.some((file) => file.path === state.sourceFolder.selectedCvPath)
    ? state.sourceFolder.selectedCvPath
    : chooseDefaultCvPath(cvFiles);
  state.sourceFolder.selectedCvPath = selectedCvPath;

  return {
    jdFiles,
    cvFiles,
    selectedJdPath,
    selectedCvPath
  };
}

function chooseDefaultJdPath(files) {
  const currentPath = state.documents.jd.file?.path;

  if (currentPath && files.some((file) => file.path === currentPath)) {
    return currentPath;
  }

  return files[0]?.path || '';
}

function chooseDefaultCvPath(files) {
  const currentPath = state.documents.cv.file?.path;

  if (currentPath && files.some((file) => file.path === currentPath)) {
    return currentPath;
  }

  return files[0]?.path || '';
}

function renderSourceFolder() {
  const hasSourceFolder = Boolean(state.sourceFolder.path);
  const busy = isGenerationWorkflowBusy();

  elements.chooseSourceFolderButton.disabled = busy;
  elements.refreshSourceFolderButton.disabled = busy || !hasSourceFolder;
  elements.sourceFolderName.textContent = hasSourceFolder
    ? state.sourceFolder.name
    : 'No workspace selected';
  elements.sourceFolderName.classList.toggle('is-empty', !hasSourceFolder);
  elements.sourceFolderPath.textContent = state.sourceFolder.error
    ? state.sourceFolder.error
    : '';
  elements.sourceFolderWorkspace.classList.add('is-hidden');
  elements.sourceFolderEmptyNote.textContent = 'Open a role folder to start reviewing candidates.';

  if (!hasSourceFolder) {
    return;
  }

  if (state.sourceFolder.files.length === 0) {
    elements.sourceFolderEmptyNote.textContent = 'No PDF, DOCX, or TXT files were found in this folder.';
    return;
  }

  const {
    jdFiles,
    cvFiles,
    selectedJdPath,
    selectedCvPath
  } = ensureSourceFolderSelections();

  elements.sourceFolderWorkspace.classList.remove('is-hidden');
  elements.sourceFolderEmptyNote.textContent = cvFiles.length === 0 && jdFiles.length === 0
    ? 'No supported JD or CV files were found in this workspace.'
    : '';

  elements.sourceFolderJdSelect.disabled = busy || jdFiles.length === 0;
  elements.sourceFolderCvSelect.disabled = busy || cvFiles.length === 0;
  elements.sourceFolderJdSelect.innerHTML = jdFiles.length > 0
    ? jdFiles.map((file) => `<option value="${escapeHtml(file.path)}">${escapeHtml(file.name)} · ${escapeHtml(formatExtension(file.extension))}</option>`).join('')
    : '<option value="">No JD files available</option>';
  elements.sourceFolderCvSelect.innerHTML = cvFiles.length > 0
    ? cvFiles.map((file) => `<option value="${escapeHtml(file.path)}">${escapeHtml(file.name)} · ${escapeHtml(formatExtension(file.extension))}</option>`).join('')
    : '<option value="">No candidate CV files available</option>';

  elements.sourceFolderJdSelect.value = jdFiles.length > 0 ? selectedJdPath : '';
  elements.sourceFolderCvSelect.value = cvFiles.length > 0 ? selectedCvPath : '';
}

function formatRecentWorkspaceUpdatedAt(value) {
  if (!value) {
    return 'Updated recently';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Updated recently';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function renderRecentWork() {
  const busy = isGenerationWorkflowBusy();
  const hasRecentWork = state.recentWorkspaces.length > 0;

  elements.recentWorkSection.classList.toggle('is-hidden', !hasRecentWork);
  elements.recentWorkEmpty.classList.toggle('is-hidden', hasRecentWork);
  elements.clearRecentWorkspacesButton.disabled = busy || !hasRecentWork;

  if (!hasRecentWork) {
    elements.recentWorkList.innerHTML = '';
    return;
  }

  elements.recentWorkList.innerHTML = state.recentWorkspaces
    .slice(0, 3)
    .map((workspace) => {
      const isActive = workspace.workspaceId === state.currentWorkspaceId;
      const summaryStatus = workspace.hasDraft
        ? `${workspace.draftLifecycle === 'approved' ? 'Approved' : 'Draft'} · ${workspace.outputLanguage === 'zh' ? '中文' : 'English'}`
        : 'Sources';
      const candidateLabel = workspace.candidateName || workspace.loadedCvName || 'No candidate loaded yet';
      const roleLabel = workspace.roleTitle || workspace.loadedJdName || workspace.sourceFolderName || 'No role loaded yet';

      return `
        <button
          class="recent-work-item${isActive ? ' is-active' : ''}"
          type="button"
          data-workspace-id="${escapeHtml(workspace.workspaceId)}"
          ${busy ? 'disabled' : ''}
        >
          <span class="recent-work-title">${escapeHtml(roleLabel)}</span>
          <span class="recent-work-meta">${escapeHtml(candidateLabel)}</span>
          <span class="recent-work-meta">${escapeHtml(summaryStatus)} · ${escapeHtml(formatRecentWorkspaceUpdatedAt(workspace.updatedAt))}</span>
        </button>
      `;
    })
    .join('');
}

function renderSlot(slot) {
  const slotState = state.documents[slot];
  const slotElements = elements[slot];
  const hasFile = Boolean(slotState.file);
  const defaultNote = getSlotDefaultNote(slot);
  const helperText = slotState.error || slotState.warnings[0] || (!hasFile ? defaultNote : '');
  const fileLabel = hasFile ? slotState.file.name : 'No file selected';

  if (slotElements.filePill) {
    slotElements.filePill.textContent = fileLabel;
    slotElements.filePill.classList.toggle('is-empty', !hasFile);
  }

  if (slotElements.note) {
    slotElements.note.textContent = helperText;
  }

  slotElements.previewStatus.textContent = getSlotStatusChip(slotState);
  setRichDocumentContent(
    slotElements.previewText,
    slotState.text || slotState.previewText || getSlotDefaultPreview(slot),
    {
      mode: slot === 'cv' ? 'cv' : 'default',
      showEmptyState: Boolean(slotState.text || slotState.previewText)
    }
  );

  if (slot === 'cv') {
    elements.cvNavStatus.textContent = getSlotStatusChip(slotState);
  } else {
    elements.jdNavStatus.textContent = getSlotStatusChip(slotState);
  }
}

function renderSettingsStatus() {
  const isValid = Boolean(state.settingsValidation?.isValid);
  const apiKeyStorageMode = state.settings?.apiKeyStorageMode || 'empty';

  if (isValid && apiKeyStorageMode === 'session') {
    elements.settingsStatusChip.textContent = 'Session Only';
    elements.settingsStatusMessage.textContent = state.settings?.apiKeyStatusMessage ||
      'The API key is available only for this session and must be entered again after restart.';
    return;
  }

  elements.settingsStatusChip.textContent = isValid ? 'Ready' : 'Settings Required';
  elements.settingsStatusMessage.textContent = isValid
    ? 'Settings saved. Summary generation is ready.'
    : (state.settingsValidation.errors[0] || 'Save a valid provider configuration before generating summaries.');
}

function getSettingsIssuePresentation(apiKeyStatus = {}, fallbackActionType = '') {
  const statusCode = String(apiKeyStatus?.statusCode || '').trim();
  const message = String(apiKeyStatus?.message || '').trim();

  if (!statusCode || ['empty', 'persistent'].includes(statusCode)) {
    return null;
  }

  if (statusCode === 'session-only' || statusCode === 'secure-storage-unavailable') {
    return {
      title: 'API key is session-only',
      message,
      actionType: fallbackActionType,
      actionLabel: fallbackActionType === 'saveSettings' ? 'Retry Save' : (fallbackActionType ? 'Retry' : '')
    };
  }

  if (statusCode === 'secure-storage-policy-blocked') {
    return {
      title: 'Secure storage is blocked',
      message,
      actionType: fallbackActionType,
      actionLabel: fallbackActionType === 'loadConfiguration' ? 'Retry Load' : 'Retry Save'
    };
  }

  if (statusCode === 'secure-storage-read-failed') {
    return {
      title: 'Saved API key could not be read',
      message,
      actionType: fallbackActionType || 'loadConfiguration',
      actionLabel: 'Retry Load'
    };
  }

  if (statusCode === 'secure-storage-write-failed') {
    return {
      title: 'API key could not be saved persistently',
      message,
      actionType: fallbackActionType || 'saveSettings',
      actionLabel: 'Retry Save'
    };
  }

  return {
    title: 'Settings issue',
    message,
    actionType: fallbackActionType,
    actionLabel: fallbackActionType ? 'Retry' : ''
  };
}

function applySettingsApiKeyStatus(apiKeyStatus, fallbackActionType = '') {
  const issue = getSettingsIssuePresentation(apiKeyStatus, fallbackActionType);

  if (!issue) {
    clearSettingsIssue();
    return;
  }

  setSettingsIssue(issue);
}

function renderSettingsIssue() {
  const hasSettingsIssue = Boolean(state.settingsIssue);

  elements.settingsIssuePanel.classList.toggle('is-hidden', !hasSettingsIssue);
  elements.settingsIssueTitle.textContent = state.settingsIssue?.title || 'Settings issue';
  elements.settingsIssueMessage.textContent = state.settingsIssue?.message || '';
  elements.retrySettingsIssueButton.classList.toggle('is-hidden', !state.settingsIssue?.actionType);
  elements.retrySettingsIssueButton.textContent = state.settingsIssue?.actionLabel || 'Retry';
  elements.retrySettingsIssueButton.disabled = Boolean(state.settingsIssue?.actionType) === false;
}

function renderSettingsForm() {
  if (!state.settings) {
    return;
  }

  const selectedProvider = state.providers.find((provider) => provider.id === state.settings.providerId);

  elements.providerSelect.innerHTML = state.providers
    .map((provider) => `<option value="${provider.id}">${provider.label}</option>`)
    .join('');

  elements.providerSelect.value = state.settings.providerId;
  elements.baseUrlInput.value = state.settings.baseUrl;
  elements.modelInput.value = state.settings.model;
  elements.apiKeyInput.value = state.settings.apiKey;
  elements.temperatureInput.value = String(state.settings.temperature);
  elements.maxTokensInput.value = String(state.settings.maxTokens);
  elements.systemPromptInput.value = state.settings.systemPrompt;
  elements.referenceTemplateModeSelect.value = state.settings.referenceTemplateMode || 'default';
  elements.referenceTemplateName.textContent = getReferenceTemplateDisplayName();
  elements.referenceTemplatePath.textContent = getReferenceTemplateDisplayPath();
  elements.chooseReferenceTemplateButton.disabled = state.settings.referenceTemplateMode !== 'local-file';
  elements.clearReferenceTemplateButton.disabled = !state.settings.referenceTemplatePath;
  elements.referenceTemplateNote.textContent = state.settings.referenceTemplateMode === 'local-file'
    ? 'The selected Markdown reference template is loaded and included in LLM generation context for both recruiter and hiring-manager briefing outputs.'
    : 'The built-in recruiter summary template is currently guiding generation. Switch to a local Markdown reference template when you want external template guidance.';
  elements.providerHelpText.textContent = selectedProvider?.helpText || '';
  elements.wordTemplateName.textContent = getTemplateDisplayName();
  elements.wordTemplatePath.textContent = getTemplateDisplayPath();
  elements.briefingOutputFolderName.textContent = getBriefingOutputFolderDisplayName();
  elements.briefingOutputFolderPath.textContent = getBriefingOutputFolderDisplayPath();
  elements.clearWordTemplateButton.disabled = !state.settings.outputTemplatePath;
  elements.clearBriefingOutputFolderButton.disabled = !state.settings.outputBriefingFolderPath;
  elements.templateConfigNote.textContent = state.settings.outputTemplatePath
    ? 'The Word template is stored locally and used for hiring-manager draft export and email handoff attachment generation.'
    : 'Add a Word template when you want a hiring-manager draft format.';
}

function renderSummary() {
  const activeOutputLanguage = state.pendingOutputLanguage || state.outputLanguage;
  const busy = isGenerationWorkflowBusy();

  renderCurrentContext();
  elements.summaryStatus.textContent = state.summaryStatus;
  elements.summaryNavStatus.textContent = state.summaryStatus;
  elements.summaryMessage.textContent = state.lastFailure
    ? state.summaryMessage
    : (state.generationError || state.summaryMessage);
  elements.generationProgress.classList.toggle('is-hidden', !busy);
  elements.generationProgressLabel.textContent = state.progressLabel;
  elements.operationFailurePanel.classList.toggle('is-hidden', !state.lastFailure);
  elements.operationFailureTitle.textContent = state.lastFailure?.title || 'Action failed';
  elements.operationFailureMessage.textContent = state.lastFailure?.message || '';
  elements.retryFailureActionButton.classList.toggle('is-hidden', !state.lastFailure?.actionType);
  elements.retryFailureActionButton.textContent = state.lastFailure?.actionLabel || 'Retry';
  elements.retryFailureActionButton.disabled = busy || !state.lastFailure?.actionType;
  elements.dismissFailureActionButton.disabled = busy;
  elements.toggleAnonymousModeButton.classList.toggle('is-on', state.outputMode === 'anonymous');
  elements.toggleAnonymousModeButton.setAttribute('aria-pressed', state.outputMode === 'anonymous' ? 'true' : 'false');
  elements.toggleAnonymousModeButton.disabled = busy;
  elements.anonymousModeValue.textContent = state.outputMode === 'anonymous' ? 'On' : 'Off';
  elements.toggleOutputLanguageButton.disabled = busy;
  elements.toggleOutputLanguageButton.classList.toggle('is-zh', activeOutputLanguage === 'zh');
  elements.toggleOutputLanguageButton.setAttribute('aria-pressed', activeOutputLanguage === 'zh' ? 'true' : 'false');
  elements.outputLanguageFlag.textContent = activeOutputLanguage === 'zh' ? '🇨🇳' : '🇬🇧';
  elements.draftModePill.textContent = state.outputMode === 'anonymous' ? 'Anonymous Output' : 'Named Output';
  elements.draftLifecyclePill.textContent = getDraftLifecycleLabel();

  if (document.activeElement !== elements.summaryEditor) {
    setRichDocumentContent(elements.summaryEditor, state.summary);
  }

  elements.approveDraftButton.disabled = busy || !canApproveDraft();
  elements.copySummaryButton.disabled = busy || !canCopySummary();
  elements.shareByEmailButton.disabled = busy || !canShareByEmail();
  elements.exportWordDraftButton.disabled = busy || !canExportWordDraft();
  elements.revealWordDraftButton.disabled = !state.lastExportPath;
  elements.openWordDraftButton.disabled = !state.lastExportPath;
  elements.openWordDraftButton.classList.toggle('is-hidden', !state.lastExportPath);
  elements.generateButton.disabled = !canGenerateSummary();
  elements.debugTrace.textContent = formatDebugTrace();
  elements.templateLabel.textContent = state.templateLabel;
  renderApprovalWarnings();
  renderRetrievalEvidence();
  if (state.lastExportPath) {
    elements.draftMeta.textContent = `Latest saved Word draft: ${state.lastExportPath}`;
    return;
  }

  if (state.draftLifecycle === 'approved') {
    elements.draftMeta.textContent = hasConfiguredWordTemplate()
      ? 'Approved draft is ready for Word export or email handoff.'
      : 'Approved draft is ready. Add a Word template in Settings when you need to export or share it.';
    return;
  }

  elements.draftMeta.textContent = hasConfiguredWordTemplate()
    ? 'Review the draft and approve it before copying or exporting the hiring-manager version.'
    : 'Review and approve the draft first. Add a Word template in Settings when you need to export it.';
}

function renderBriefing() {
  const hasBriefingReview = state.briefingReview.trim().length > 0;
  const briefingStatus = state.isLoadingWorkspace
    ? 'Loading'
    : (state.isGenerating
      ? 'Generating'
      : (state.isSwitchingMode
        ? 'Updating'
      : (state.isTranslating
        ? 'Translating'
        : (state.isSavingWordDraft
          ? 'Saving'
          : (state.isSharingEmail ? 'Preparing Email' : (hasBriefingReview ? 'Ready' : 'No Briefing'))))));
  const briefingText = hasBriefingReview
    ? state.briefingReview
    : 'Generate the candidate summary to populate the hiring-manager briefing review.';

  elements.briefingStatus.textContent = briefingStatus;
  elements.briefingNavStatus.textContent = briefingStatus;
  setRichDocumentContent(
    elements.briefingPreview,
    briefingText,
    {
      mode: 'default',
      showEmptyState: true
    }
  );
}

function render() {
  renderSlot('cv');
  renderSlot('jd');
  renderSourceFolder();
  renderRecentWork();
  renderSettingsForm();
  renderSettingsStatus();
  renderSettingsIssue();
  renderCurrentContext();
  renderSummary();
  renderBriefing();
  setView(state.view);
  setWorkbenchTab(state.workbenchTab);
  setContextTab(state.contextTab);
  setSettingsTab(state.settingsTab);
}

function setSummaryMessage(message) {
  state.summaryMessage = message;
  state.generationError = '';
  state.lastFailure = null;
}

function clearOperationFailure() {
  state.generationError = '';
  state.lastFailure = null;
}

function clearSettingsIssue() {
  state.settingsIssue = null;
}

function setSettingsIssue({
  title = 'Settings issue',
  message = 'The settings action could not be completed.',
  actionType = '',
  actionLabel = '',
  actionPayload = null
} = {}) {
  state.settingsIssue = {
    title,
    message,
    actionType,
    actionLabel,
    actionPayload
  };
}

function setOperationFailure({
  status = 'Failed',
  title = 'Action failed',
  message = 'The last action could not be completed.',
  actionType = '',
  actionLabel = '',
  actionPayload = null
} = {}) {
  state.summaryStatus = status;
  state.generationError = '';
  state.summaryMessage = 'Review the issue below and retry when ready.';
  state.lastFailure = {
    title,
    message,
    actionType,
    actionLabel,
    actionPayload
  };
}

function formatDebugTrace() {
  if (state.debugTrace.length === 0) {
    return 'No export debug trace yet.';
  }

  return state.debugTrace
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n');
}

function splitErrorMessageAndTrace(message) {
  const marker = '\nDebug trace:\n';
  const raw = String(message || '');
  const markerIndex = raw.indexOf(marker);

  if (markerIndex === -1) {
    return {
      userMessage: raw,
      debugTrace: []
    };
  }

  return {
    userMessage: raw.slice(0, markerIndex).trim(),
    debugTrace: raw
      .slice(markerIndex + marker.length)
      .split('\n')
      .map((line) => line.replace(/^- /, '').trim())
      .filter(Boolean)
  };
}

function consumeE2EFailure(actionType) {
  if (!window.recruitmentApi?.isE2ETestMode || !window.recruitmentApi.isE2ETestMode()) {
    return '';
  }

  const injectedMessage = e2eFailureInjection[actionType] || '';

  if (injectedMessage) {
    e2eFailureInjection[actionType] = '';
  }

  return injectedMessage;
}

function invalidateSummary(message) {
  state.briefing = null;
  state.briefingReview = '';
  state.summary = '';
  state.pendingOutputLanguage = '';
  clearCachedDraftVariants();
  state.retrievalEvidence = createEmptyRetrievalEvidence();
  state.draftLifecycle = 'empty';
  state.approvalWarnings = [];
  state.lastExportPath = '';
  state.debugTrace = [];
  state.isSwitchingMode = false;
  state.isTranslating = false;
  state.isSavingWordDraft = false;
  state.isSharingEmail = false;
  state.summaryStatus = 'No Draft';
  state.progressLabel = 'Generating summary with the configured model...';
  setSummaryMessage(message);
}

async function retryLastFailureAction() {
  if (!state.lastFailure?.actionType || isGenerationWorkflowBusy()) {
    return;
  }

  const { actionType, actionPayload } = state.lastFailure;
  clearOperationFailure();
  render();

  switch (actionType) {
    case 'generateSummary':
      await generateSummary();
      return;
    case 'translateDraft':
      await setOutputLanguage(actionPayload?.language || state.outputLanguage);
      return;
    case 'switchOutputMode':
      await setOutputMode(actionPayload?.mode || state.outputMode);
      return;
    case 'shareByEmail':
      await shareByEmail();
      return;
    case 'exportWordDraft':
      await exportWordDraft();
      return;
    case 'refreshSourceFolder':
      await refreshSourceFolder();
      return;
    case 'chooseSourceFolder':
      await chooseSourceFolder();
      return;
    case 'openRecentWorkspace':
      await openRecentWorkspace(actionPayload?.workspaceId || '');
      return;
    case 'importDocument':
      if (actionPayload?.filePath && actionPayload?.slot) {
        await importDocumentIntoSlot(actionPayload.filePath, actionPayload.slot);
      }
      return;
    case 'openWordDraft':
      await openWordDraft();
      return;
    case 'revealWordDraft':
      await revealWordDraft();
      return;
    case 'refreshBriefingReview':
      await refreshBriefingReview();
      return;
    default:
      return;
  }
}

async function retrySettingsIssueAction() {
  if (!state.settingsIssue?.actionType) {
    return;
  }

  const { actionType } = state.settingsIssue;
  clearSettingsIssue();
  render();

  switch (actionType) {
    case 'loadConfiguration':
      await loadConfiguration({ forceSettingsView: true });
      return;
    case 'saveSettings':
      await saveSettings();
      return;
    case 'chooseReferenceTemplate':
      await chooseReferenceTemplate();
      return;
    case 'chooseWordTemplate':
      await chooseWordTemplate();
      return;
    case 'chooseBriefingOutputFolder':
      await chooseBriefingOutputFolder();
      return;
    default:
      return;
  }
}

function clearCurrentContextProfile() {
  currentContextProfileRequestId += 1;
  state.currentContextProfile = null;
  state.currentWorkspaceId = '';
}

function beginSensitiveSourceReload(slot, message) {
  state.documents[slot] = createEmptyDocumentSlot(slot);
  clearCurrentContextProfile();
  invalidateSummary(message);
}

function getDraftLifecycleLabel() {
  switch (state.draftLifecycle) {
    case 'generated':
      return 'Generated';
    case 'edited':
      return 'Edited';
    case 'approved':
      return 'Approved';
    default:
      return 'Draft Pending';
  }
}

function renderApprovalWarnings() {
  const warnings = state.approvalWarnings;
  const hasWarnings = warnings.length > 0;

  elements.approvalWarningPanel.classList.toggle('is-hidden', !hasWarnings);

  if (!hasWarnings) {
    elements.approvalWarningList.innerHTML = '';
    return;
  }

  elements.approvalWarningList.innerHTML = warnings
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join('');
}

function renderEvidenceItems(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<p class="evidence-empty">No source evidence was captured for this output yet.</p>';
  }

  return entries
    .map((entry) => {
      const metaParts = [
        entry.documentLabel,
        entry.sectionLabel || entry.sectionKey,
        entry.sourceName,
        entry.blockId ? `score ${entry.score.toFixed(2)} · ${entry.blockId}` : `score ${entry.score.toFixed(2)}`
      ].filter(Boolean);

      return [
        '<article class="evidence-item">',
        `<p class="evidence-item-meta">${escapeHtml(metaParts.join(' · '))}</p>`,
        entry.preview ? `<p class="evidence-item-preview">${escapeHtml(entry.preview)}</p>` : '',
        '</article>'
      ].join('');
    })
    .join('');
}

function renderRetrievalEvidence() {
  const summaryEvidence = state.retrievalEvidence.summary;
  const briefingEvidence = state.retrievalEvidence.briefing;
  const hasEvidence = summaryEvidence.length > 0 || briefingEvidence.length > 0;

  elements.summaryEvidencePanel.classList.toggle('is-hidden', !hasEvidence);

  if (!hasEvidence) {
    elements.summaryEvidenceSummaryList.innerHTML = '';
    elements.summaryEvidenceBriefingList.innerHTML = '';
    return;
  }

  elements.summaryEvidenceSummaryList.innerHTML = renderEvidenceItems(summaryEvidence);
  elements.summaryEvidenceBriefingList.innerHTML = renderEvidenceItems(briefingEvidence);
}

function markDraftEdited() {
  if (!state.summary.trim()) {
    return;
  }

  clearCachedDraftVariants();

  if (state.draftLifecycle === 'generated' || state.draftLifecycle === 'approved') {
    state.draftLifecycle = 'edited';
    state.lastExportPath = '';
    state.summaryMessage = state.outputMode === 'anonymous'
      ? 'Candidate summary updated. Re-review the anonymous hiring-manager output and approve it again before export or email handoff.'
      : 'Draft updated. Approve again before copying or exporting.';
    state.generationError = '';
  }
}

async function setOutputMode(mode) {
  const normalizedMode = mode === 'anonymous' ? 'anonymous' : 'named';

  if (state.outputMode === normalizedMode) {
    return;
  }

  if (isGenerationWorkflowBusy()) {
    return;
  }

  if (!state.summary.trim()) {
    state.outputMode = normalizedMode;
    state.lastExportPath = '';
    state.approvalWarnings = [];
    render();
    persistCurrentWorkspaceSnapshot();
    return;
  }

  cacheDraftVariant(state.outputMode, state.outputLanguage);

  const cachedVariant = getCachedDraftVariant(normalizedMode, state.outputLanguage);

  if (cachedVariant) {
    applyCachedDraftVariant(
      normalizedMode,
      state.outputLanguage,
      cachedVariant,
      normalizedMode === 'anonymous'
        ? 'Restored the existing anonymous hiring-manager output without regeneration.'
        : 'Restored the existing named hiring-manager output without regeneration.'
    );
    state.lastExportPath = '';
    render();
    await persistCurrentWorkspaceSnapshot();
    return;
  }

  state.summary = readSummaryEditorText();
  state.isSwitchingMode = true;
  state.lastExportPath = '';
  state.summaryStatus = 'Updating';
  clearOperationFailure();
  state.summaryMessage = normalizedMode === 'anonymous'
    ? 'Applying anonymous mode to the hiring-manager output without rerunning candidate assessment.'
    : 'Restoring the named hiring-manager output without rerunning candidate assessment.';
  state.progressLabel = 'Switching draft mode...';
  render();

  try {
    const result = await window.recruitmentApi.renderBriefingReview({
      briefing: state.briefing,
      summary: state.summary,
      outputMode: normalizedMode,
      outputLanguage: state.outputLanguage,
      summaryRetrievalManifest: state.retrievalEvidence.summary,
      briefingRetrievalManifest: state.retrievalEvidence.briefing,
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd
    });

    state.outputMode = normalizedMode;
    state.summary = result.summary || state.summary;
    state.briefing = result.briefing || state.briefing;
    state.briefingReview = result.hiringManagerBriefingReview || '';
    state.approvalWarnings = result.approvalWarnings || [];
    state.draftLifecycle = 'generated';
    state.summaryStatus = 'Ready';
    state.summaryMessage = normalizedMode === 'anonymous'
      ? 'Anonymous hiring-manager output is ready without rerunning candidate assessment. The consultant summary stays named.'
      : 'Named hiring-manager output restored without rerunning candidate assessment.';
    cacheDraftVariant(state.outputMode, state.outputLanguage);
    await persistCurrentWorkspaceSnapshot();
  } catch (error) {
    setOperationFailure({
      status: 'Mode Update Failed',
      title: 'Output mode update failed',
      message: error instanceof Error
        ? error.message
        : 'Unable to switch the hiring-manager output mode for the current draft.',
      actionType: 'switchOutputMode',
      actionLabel: 'Retry Mode Switch',
      actionPayload: { mode: normalizedMode }
    });
  } finally {
    state.isSwitchingMode = false;
    state.progressLabel = 'Generating summary with the configured model...';
    render();
  }
}

function setOutputLanguage(language) {
  const normalizedLanguage = language === 'zh' ? 'zh' : 'en';

  if (state.outputLanguage === normalizedLanguage) {
    return;
  }

  if (isGenerationWorkflowBusy()) {
    return;
  }

  if (!state.summary.trim()) {
    state.outputLanguage = normalizedLanguage;
    state.lastExportPath = '';
    state.approvalWarnings = [];
    render();
    persistCurrentWorkspaceSnapshot();
    return;
  }

  const cachedVariant = getCachedDraftVariant(state.outputMode, normalizedLanguage);

  if (cachedVariant) {
    applyCachedDraftVariant(
      state.outputMode,
      normalizedLanguage,
      cachedVariant,
      normalizedLanguage === 'zh'
        ? 'Switched to the existing Chinese draft without retranslation.'
        : 'Switched back to the existing English draft without retranslation.'
    );
    render();
    persistCurrentWorkspaceSnapshot();
    return;
  }

  translateCurrentDraft(normalizedLanguage);
}

async function translateCurrentDraft(targetLanguage) {
  const previousLanguage = state.outputLanguage;

  state.summary = readSummaryEditorText();
  state.lastExportPath = '';
  state.isTranslating = true;
  state.pendingOutputLanguage = targetLanguage;
  clearOperationFailure();
  state.summaryStatus = 'Translating';
  state.summaryMessage = targetLanguage === 'zh'
    ? '正在将当前摘要与Hiring Manager Briefing翻译为中文，不重新执行CV/JD评估。'
    : 'Translating the current summary and hiring-manager briefing without rerunning CV/JD assessment.';
  state.progressLabel = targetLanguage === 'zh'
    ? '正在翻译当前草稿...'
    : 'Translating the current draft...';
  render();

  try {
    await syncBriefingReviewFromCurrentSummary();
    cacheDraftVariant(state.outputMode, previousLanguage);

    const result = await window.recruitmentApi.translateDraftOutput({
      summary: state.summary,
      briefing: state.briefing,
      outputMode: state.outputMode,
      sourceLanguage: previousLanguage,
      targetLanguage,
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd,
      summaryRetrievalManifest: state.retrievalEvidence.summary,
      briefingRetrievalManifest: state.retrievalEvidence.briefing,
      approvalWarnings: state.approvalWarnings
    });

    state.summary = result.summary || state.summary;
    state.briefing = result.briefing || state.briefing;
    state.briefingReview = result.hiringManagerBriefingReview || state.briefingReview;
    state.outputLanguage = result.outputLanguage || targetLanguage;
    state.pendingOutputLanguage = '';
    state.approvalWarnings = result.approvalWarnings || [];
    cacheDraftVariant(state.outputMode, state.outputLanguage);
    state.summaryStatus = 'Ready';
    state.summaryMessage = targetLanguage === 'zh'
      ? '当前草稿已翻译为中文。请复核译文后再复制、导出或发送。'
      : 'The current draft has been translated to English. Review the translated wording before copying, export, or email handoff.';
    await persistCurrentWorkspaceSnapshot();
  } catch (error) {
    state.outputLanguage = previousLanguage;
    state.pendingOutputLanguage = '';
    setOperationFailure({
      status: 'Translation Failed',
      title: 'Draft translation failed',
      message: error instanceof Error
        ? error.message
        : 'Unable to translate the current draft.',
      actionType: 'translateDraft',
      actionLabel: 'Retry Translation',
      actionPayload: { language: targetLanguage }
    });
  } finally {
    state.isTranslating = false;
    state.progressLabel = 'Generating summary with the configured model...';
    render();
  }
}

function approveDraft() {
  if (!canApproveDraft() || isGenerationWorkflowBusy()) {
    return;
  }

  state.draftLifecycle = 'approved';
  state.summaryStatus = 'Ready';
  state.summaryMessage = state.outputMode === 'anonymous'
    ? 'Anonymous hiring-manager output approved. Summary copy, email handoff, and Word export are now enabled.'
    : 'Draft approved. Summary copy, email handoff, and Word export are now enabled.';
  clearOperationFailure();
  renderSummary();
  persistCurrentWorkspaceSnapshot();
}

function buildSettingsPayloadFromForm() {
  const selectedProvider = state.providers.find((provider) => provider.id === elements.providerSelect.value);

  return {
    providerId: elements.providerSelect.value,
    providerLabel: selectedProvider?.label || elements.providerSelect.value,
    baseUrl: elements.baseUrlInput.value.trim(),
    model: elements.modelInput.value.trim(),
    apiKey: elements.apiKeyInput.value.trim(),
    temperature: Number(elements.temperatureInput.value),
    maxTokens: Number(elements.maxTokensInput.value),
    systemPrompt: elements.systemPromptInput.value.trim(),
    referenceTemplateMode: elements.referenceTemplateModeSelect.value,
    referenceTemplatePath: state.settings?.referenceTemplatePath || '',
    referenceTemplateName: state.settings?.referenceTemplateName || '',
    referenceTemplateExtension: state.settings?.referenceTemplateExtension || '',
    outputTemplatePath: state.settings?.outputTemplatePath || '',
    outputTemplateName: state.settings?.outputTemplateName || '',
    outputTemplateExtension: state.settings?.outputTemplateExtension || '',
    outputBriefingFolderPath: state.settings?.outputBriefingFolderPath || ''
  };
}

function applyProviderPreset(providerId) {
  const provider = state.providers.find((entry) => entry.id === providerId);

  if (!provider || !state.settings) {
    return;
  }

  state.settings = {
    ...state.settings,
    providerId: provider.id,
    providerLabel: provider.label,
    baseUrl: provider.defaultBaseUrl || state.settings.baseUrl,
    model: provider.defaultModel || state.settings.model
  };
}

async function loadConfiguration({ forceSettingsView = false } = {}) {
  try {
    const injectedFailure = consumeE2EFailure('loadConfiguration');

    if (injectedFailure) {
      throw new Error(injectedFailure);
    }

    state.providers = await window.recruitmentApi.getLlmProviders();
    const result = await window.recruitmentApi.loadLlmSettings();
    state.settings = result.settings;
    state.settingsValidation = result.validation;
    applySettingsApiKeyStatus(result.apiKeyStatus, 'loadConfiguration');

    if (forceSettingsView || !result.validation.isValid) {
      state.view = 'settings';
    }
  } catch (error) {
    state.view = 'settings';
    setSettingsIssue({
      title: 'Settings could not be loaded',
      message: error instanceof Error
        ? error.message
        : 'Unable to load the current configuration.',
      actionType: 'loadConfiguration',
      actionLabel: 'Retry Load'
    });
  }

  render();
}

async function saveSettings() {
  try {
    const injectedFailure = consumeE2EFailure('saveSettings');

    if (injectedFailure) {
      throw new Error(injectedFailure);
    }

    const payload = buildSettingsPayloadFromForm();
    const result = await window.recruitmentApi.saveLlmSettings(payload);

    state.settings = result.settings;
    state.settingsValidation = result.validation;
    applySettingsApiKeyStatus(result.apiKeyStatus, 'saveSettings');

    if (!result.validation.isValid) {
      state.view = 'settings';
      state.settingsTab = result.validation.errors.some((error) => /reference template/i.test(error))
        ? 'summary-guidance'
        : (result.validation.errors.some((error) => /output template|word/i.test(error))
          ? 'word-template'
          : 'llm');
    }
  } catch (error) {
    state.view = 'settings';
    setSettingsIssue({
      title: 'Settings could not be saved',
      message: error instanceof Error
        ? error.message
        : 'Unable to save the current configuration.',
      actionType: 'saveSettings',
      actionLabel: 'Retry Save'
    });
  }

  render();
}

async function chooseReferenceTemplate() {
  try {
    const injectedFailure = consumeE2EFailure('chooseReferenceTemplate');

    if (injectedFailure) {
      throw new Error(injectedFailure);
    }

    const result = await window.recruitmentApi.pickReferenceTemplate();

    if (!result || !state.settings) {
      return;
    }

    state.settings = {
      ...state.settings,
      referenceTemplateMode: 'local-file',
      referenceTemplatePath: result.path,
      referenceTemplateName: result.name,
      referenceTemplateExtension: result.extension
    };
    clearSettingsIssue();
    state.settingsTab = 'summary-guidance';
  } catch (error) {
    setSettingsIssue({
      title: 'Reference template could not be selected',
      message: error instanceof Error
        ? error.message
        : 'Unable to pick the Markdown guidance template.',
      actionType: 'chooseReferenceTemplate',
      actionLabel: 'Retry Pick'
    });
  }

  render();
}

function clearReferenceTemplate() {
  if (!state.settings) {
    return;
  }

  state.settings = {
    ...state.settings,
    referenceTemplateMode: 'default',
    referenceTemplatePath: '',
    referenceTemplateName: '',
    referenceTemplateExtension: ''
  };
  render();
}

async function chooseWordTemplate() {
  try {
    const injectedFailure = consumeE2EFailure('chooseWordTemplate');

    if (injectedFailure) {
      throw new Error(injectedFailure);
    }

    const result = await window.recruitmentApi.pickWordTemplate();

    if (!result || !state.settings) {
      return;
    }

    state.settings = {
      ...state.settings,
      outputTemplatePath: result.path,
      outputTemplateName: result.name,
      outputTemplateExtension: result.extension
    };
    clearSettingsIssue();
    state.settingsTab = 'word-template';
  } catch (error) {
    setSettingsIssue({
      title: 'Word template could not be selected',
      message: error instanceof Error
        ? error.message
        : 'Unable to pick the hiring-manager Word template.',
      actionType: 'chooseWordTemplate',
      actionLabel: 'Retry Pick'
    });
  }

  render();
}

async function chooseBriefingOutputFolder() {
  try {
    const injectedFailure = consumeE2EFailure('chooseBriefingOutputFolder');

    if (injectedFailure) {
      throw new Error(injectedFailure);
    }

    const result = await window.recruitmentApi.pickBriefingOutputFolder();

    if (!result || !state.settings) {
      return;
    }

    state.settings = {
      ...state.settings,
      outputBriefingFolderPath: result.path
    };
    clearSettingsIssue();
    state.settingsTab = 'word-template';
  } catch (error) {
    setSettingsIssue({
      title: 'Briefing output folder could not be selected',
      message: error instanceof Error
        ? error.message
        : 'Unable to pick the output folder for Word briefings.',
      actionType: 'chooseBriefingOutputFolder',
      actionLabel: 'Retry Pick'
    });
  }

  render();
}

function clearBriefingOutputFolder() {
  if (!state.settings) {
    return;
  }

  state.settings = {
    ...state.settings,
    outputBriefingFolderPath: ''
  };
  render();
}

function clearWordTemplate() {
  if (!state.settings) {
    return;
  }

  state.settings = {
    ...state.settings,
    outputTemplatePath: '',
    outputTemplateName: '',
    outputTemplateExtension: ''
  };
  render();
}

function buildWorkspaceSnapshotPayload() {
  const candidateName = String(state.currentContextProfile?.candidateName || state.briefing?.candidate?.name || '').trim();
  const roleTitle = String(state.currentContextProfile?.roleTitle || state.briefing?.role?.title || '').trim();

  return {
    sourceFolderPath: state.sourceFolder.path,
    sourceFolderName: state.sourceFolder.name,
    candidateName,
    roleTitle,
    selectedJdPath: state.sourceFolder.selectedJdPath,
    selectedCvPath: state.sourceFolder.selectedCvPath,
    loadedJdPath: state.documents.jd.file?.path || '',
    loadedCvPath: state.documents.cv.file?.path || '',
    outputMode: state.outputMode,
    outputLanguage: state.outputLanguage,
    draftLifecycle: state.draftLifecycle,
    summary: state.summary,
    briefing: state.briefing,
    draftVariants: cloneDraftVariantsSnapshot(state.draftVariants),
    retrievalEvidence: state.retrievalEvidence,
    briefingReview: state.briefingReview,
    approvalWarnings: state.approvalWarnings,
    lastExportPath: state.lastExportPath,
    templateLabel: state.templateLabel
  };
}

async function persistCurrentWorkspaceSnapshot() {
  try {
    const result = await window.recruitmentApi.saveWorkspaceSnapshot(buildWorkspaceSnapshotPayload());
    state.recentWorkspaces = result?.recentWorkspaces || [];
    state.currentWorkspaceId = result?.workspace?.workspaceId || '';
    renderRecentWork();
  } catch (_error) {
    // Keep persistence failures local so they do not interrupt drafting.
  }
}

async function loadRecentWorkspaces() {
  try {
    const result = await window.recruitmentApi.listRecentWorkspaces();
    state.recentWorkspaces = result?.recentWorkspaces || [];
  } catch (_error) {
    state.recentWorkspaces = [];
  }
}

async function openRecentWorkspace(workspaceId) {
  if (!workspaceId || isGenerationWorkflowBusy()) {
    return;
  }

  state.isLoadingWorkspace = true;
  state.view = 'workbench';
  state.summaryStatus = 'Loading';
  clearOperationFailure();
  state.summaryMessage = 'Reopening the saved role workspace.';
  state.progressLabel = 'Loading the saved role workspace...';
  state.workbenchTab = 'summary';
  state.contextTab = 'workspace';
  render();

  try {
    const result = await window.recruitmentApi.loadWorkspaceSnapshot({ workspaceId });
    const snapshot = result?.workspace;

    if (!snapshot) {
      throw new Error('The selected recent workspace could not be loaded.');
    }

    state.recentWorkspaces = result?.recentWorkspaces || state.recentWorkspaces;
    state.currentWorkspaceId = snapshot.workspaceId || '';

    if (snapshot.sourceFolderPath) {
      try {
        const folderResult = await window.recruitmentApi.listSourceFolder({
          folderPath: snapshot.sourceFolderPath
        });
        applySourceFolderListing(folderResult);
      } catch (error) {
        state.sourceFolder = {
          ...createEmptySourceFolderState(),
          path: snapshot.sourceFolderPath,
          name: snapshot.sourceFolderName || '',
          error: error instanceof Error
            ? error.message
            : 'Unable to refresh the saved role workspace folder.',
          selectedJdPath: snapshot.selectedJdPath || '',
          selectedCvPath: snapshot.selectedCvPath || ''
        };
      }
    } else {
      state.sourceFolder = createEmptySourceFolderState();
    }

    if (snapshot.selectedJdPath) {
      setSelectedSourceFolderJdPath(snapshot.selectedJdPath);
    }

    if (snapshot.selectedCvPath) {
      setSelectedSourceFolderCvPath(snapshot.selectedCvPath);
    }

    state.documents.cv = createEmptyDocumentSlot('cv');
    state.documents.jd = createEmptyDocumentSlot('jd');

    const slotErrors = [];
    const hydrateDocument = async (slot, filePath) => {
      if (!filePath) {
        return;
      }

      try {
        const importResult = await window.recruitmentApi.importDocument({ filePath });
        setDocumentSlotFromImportResult(importResult, slot, { invalidate: false });

        if (importResult.error) {
          slotErrors.push(`${slot.toUpperCase()}: ${importResult.error}`);
        }
      } catch (error) {
        state.documents[slot] = {
          ...createEmptyDocumentSlot(slot),
          file: {
            path: filePath,
            name: filePath.split(/[\\/]/).pop() || filePath,
            extension: filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : 'unknown',
            sizeBytes: 0,
            importStatus: 'error'
          },
          error: error instanceof Error ? error.message : 'Unable to load the saved source file.'
        };
        slotErrors.push(`${slot.toUpperCase()}: ${state.documents[slot].error}`);
      }
    };

    await hydrateDocument('jd', snapshot.loadedJdPath);
    await hydrateDocument('cv', snapshot.loadedCvPath);

    state.briefing = snapshot.briefing || null;
    state.retrievalEvidence = {
      summary: normalizeRetrievalManifest(snapshot.retrievalEvidence?.summary),
      briefing: normalizeRetrievalManifest(snapshot.retrievalEvidence?.briefing)
    };
    state.briefingReview = snapshot.briefingReview || '';
    state.summary = snapshot.summary || '';
    state.outputMode = snapshot.outputMode === 'anonymous' ? 'anonymous' : 'named';
    state.outputLanguage = snapshot.outputLanguage === 'zh' ? 'zh' : 'en';
    state.pendingOutputLanguage = '';
    state.approvalWarnings = snapshot.approvalWarnings || [];
    state.lastExportPath = snapshot.lastExportPath || '';
    state.templateLabel = snapshot.templateLabel || 'Default Recruiter Profile Template';
    state.draftLifecycle = snapshot.draftLifecycle || (state.summary ? 'generated' : 'empty');
    state.draftVariants = cloneDraftVariantsSnapshot(snapshot.draftVariants);

    if (state.summary.trim() && !getCachedDraftVariant(state.outputMode, state.outputLanguage)) {
      cacheDraftVariant(state.outputMode, state.outputLanguage);
    }

    state.summaryStatus = state.summary.trim() ? 'Ready' : 'No Draft';
    state.summaryMessage = slotErrors.length > 0
      ? `Saved workspace reopened with source-file issues: ${slotErrors.join(' | ')}`
      : (state.summary.trim()
        ? 'Saved role workspace reopened.'
        : 'Saved role workspace reopened. Load or generate as needed.');
    await refreshCurrentContextProfile();
  } catch (error) {
    setOperationFailure({
      status: 'Workspace Issue',
      title: 'Unable to reopen recent work',
      message: error instanceof Error
        ? error.message
        : 'Unable to reopen the selected recent workspace.',
      actionType: 'openRecentWorkspace',
      actionLabel: 'Retry Reopen',
      actionPayload: { workspaceId }
    });
  } finally {
    state.isLoadingWorkspace = false;
    state.progressLabel = 'Generating summary with the configured model...';
    render();
  }
}

async function clearRecentWorkspaces() {
  if (isGenerationWorkflowBusy()) {
    return;
  }

  const result = await window.recruitmentApi.clearRecentWorkspaces();
  state.recentWorkspaces = result?.recentWorkspaces || [];
  state.currentWorkspaceId = '';
  render();
}

function findMatchingRecentWorkspaceForCurrentSelection() {
  const sourceFolderPath = String(state.sourceFolder.path || '').trim();
  const selectedJdPath = String(state.sourceFolder.selectedJdPath || '').trim();
  const selectedCvPath = String(state.sourceFolder.selectedCvPath || '').trim();
  const loadedJdPath = String(state.documents.jd.file?.path || selectedJdPath).trim();
  const loadedCvPath = String(state.documents.cv.file?.path || selectedCvPath).trim();

  if (!sourceFolderPath || !loadedJdPath || !loadedCvPath) {
    return null;
  }

  return state.recentWorkspaces.find((workspace) =>
    String(workspace.sourceFolderPath || '').trim() === sourceFolderPath &&
    String(workspace.loadedJdPath || workspace.selectedJdPath || '').trim() === loadedJdPath &&
    String(workspace.loadedCvPath || workspace.selectedCvPath || '').trim() === loadedCvPath
  ) || null;
}

async function restoreMatchingWorkspaceSelectionSnapshot() {
  const match = findMatchingRecentWorkspaceForCurrentSelection();

  if (!match || !match.workspaceId || match.workspaceId === state.currentWorkspaceId) {
    return false;
  }

  await openRecentWorkspace(match.workspaceId);
  return true;
}

async function importDocumentIntoSlot(filePath, slot, { persistSnapshot = true } = {}) {
  beginSensitiveSourceReload(
    slot,
    slot === 'cv'
      ? 'Loading the selected candidate CV. Previous candidate draft context was cleared.'
      : 'Loading the selected role JD. Previous draft context was cleared.'
  );
  render();

  const extension = getPathExtension(filePath);

  if (extension && !SUPPORTED_SOURCE_EXTENSIONS.has(extension)) {
    await applyImportedDocument(buildUnsupportedImportResult(filePath), slot, { persistSnapshot });
    return;
  }

  try {
    const result = await window.recruitmentApi.importDocument({ filePath });
    await applyImportedDocument(result, slot, { persistSnapshot });
  } catch (error) {
    setOperationFailure({
      status: 'Import Issue',
      title: slot === 'cv' ? 'Candidate CV import failed' : 'Role JD import failed',
      message: error instanceof Error
        ? error.message
        : 'Unable to import the selected source file.',
      actionType: 'importDocument',
      actionLabel: 'Retry Import',
      actionPayload: {
        filePath,
        slot
      }
    });
    render();
  }
}

function setDocumentSlotFromImportResult(result, slot, { invalidate = true } = {}) {
  state.documents[slot] = {
    slot,
    file: result.file,
    text: result.text,
    previewText: result.previewText,
    warnings: result.warnings,
    error: result.error
  };

  if (result?.file?.path && state.sourceFolder.files.some((file) => file.path === result.file.path)) {
    if (slot === 'jd') {
      setSelectedSourceFolderJdPath(result.file.path);
    } else {
      setSelectedSourceFolderCvPath(result.file.path);
    }
  }

  if (!invalidate) {
    return;
  }

  if (result.error) {
    invalidateSummary('Fix the import issue before generating the summary.');
  } else {
    invalidateSummary('Document imported. Load the other source or generate the summary.');
  }
}

function clearStaleWorkspaceDocuments(nextFiles) {
  const nextPaths = new Set((Array.isArray(nextFiles) ? nextFiles : []).map((file) => file.path));
  let clearedAnySlot = false;

  ['jd', 'cv'].forEach((slot) => {
    const currentPath = state.documents[slot].file?.path || '';

    if (currentPath && !nextPaths.has(currentPath)) {
      state.documents[slot] = createEmptyDocumentSlot(slot);
      clearedAnySlot = true;
    }
  });

  if (!clearedAnySlot) {
    return;
  }

  clearCurrentContextProfile();
  invalidateSummary('Role workspace changed. Select a candidate and generate a fresh draft.');
}

function applySourceFolderListing(result) {
  const nextFiles = Array.isArray(result?.files) ? result.files : [];
  const previousSelectedJdPath = state.sourceFolder.selectedJdPath;
  const previousSelectedCvPath = state.sourceFolder.selectedCvPath;
  const currentLoadedJdPath = state.documents.jd.file?.path || '';
  const currentLoadedCvPath = state.documents.cv.file?.path || '';

  clearStaleWorkspaceDocuments(nextFiles);

  state.sourceFolder = {
    path: result?.folder?.path || '',
    name: result?.folder?.name || '',
    files: nextFiles,
    error: '',
    selectedJdPath: nextFiles.some((file) => file.path === currentLoadedJdPath)
      ? currentLoadedJdPath
      : (nextFiles.some((file) => file.path === previousSelectedJdPath) ? previousSelectedJdPath : ''),
    selectedCvPath: nextFiles.some((file) => file.path === currentLoadedCvPath)
      ? currentLoadedCvPath
      : (nextFiles.some((file) => file.path === previousSelectedCvPath) ? previousSelectedCvPath : '')
  };
}

function setSelectedSourceFolderJdPath(filePath) {
  state.sourceFolder.selectedJdPath = filePath || '';

  if (state.sourceFolder.selectedCvPath === state.sourceFolder.selectedJdPath) {
    state.sourceFolder.selectedCvPath = '';
  }
}

function setSelectedSourceFolderCvPath(filePath) {
  state.sourceFolder.selectedCvPath = filePath || '';
}

async function chooseSourceFolder() {
  if (isGenerationWorkflowBusy()) {
    return;
  }

  try {
    clearOperationFailure();
    state.contextTab = 'workspace';
    const result = await window.recruitmentApi.pickSourceFolder();

    if (!result) {
      return;
    }

    applySourceFolderListing(result);
    ensureSourceFolderSelections();
    render();
    await autoLoadWorkspaceSelections({ loadJd: true, loadCv: true });
    await persistCurrentWorkspaceSnapshot();
  } catch (error) {
    state.sourceFolder = {
      ...createEmptySourceFolderState(),
      error: error instanceof Error
        ? error.message
        : 'Unable to load the selected source folder.'
    };
    setOperationFailure({
      status: 'Workspace Issue',
      title: 'Role workspace could not be opened',
      message: state.sourceFolder.error,
      actionType: 'chooseSourceFolder',
      actionLabel: 'Open Folder Again'
    });
    render();
  }
}

async function refreshSourceFolder() {
  if (!state.sourceFolder.path || isGenerationWorkflowBusy()) {
    return;
  }

  try {
    clearOperationFailure();
    state.contextTab = 'workspace';
    const result = await window.recruitmentApi.listSourceFolder({
      folderPath: state.sourceFolder.path
    });
    applySourceFolderListing(result);
    ensureSourceFolderSelections();
    render();
    await autoLoadWorkspaceSelections({ loadJd: true, loadCv: true });
    await persistCurrentWorkspaceSnapshot();
  } catch (error) {
    state.sourceFolder = {
      ...state.sourceFolder,
      error: error instanceof Error
        ? error.message
        : 'Unable to refresh the selected source folder.'
    };
    setOperationFailure({
      status: 'Workspace Issue',
      title: 'Role workspace refresh failed',
      message: state.sourceFolder.error,
      actionType: 'refreshSourceFolder',
      actionLabel: 'Retry Refresh'
    });
    render();
  }
}

async function loadSelectedWorkspaceJd() {
  if (!state.sourceFolder.selectedJdPath || isGenerationWorkflowBusy()) {
    return;
  }

  if (state.documents.jd.file?.path === state.sourceFolder.selectedJdPath) {
    return;
  }

  state.contextTab = 'workspace';
  await importDocumentIntoSlot(state.sourceFolder.selectedJdPath, 'jd', {
    persistSnapshot: false
  });
}

async function loadSelectedWorkspaceCv() {
  if (!state.sourceFolder.selectedCvPath || isGenerationWorkflowBusy()) {
    return;
  }

  if (state.documents.cv.file?.path === state.sourceFolder.selectedCvPath) {
    return;
  }

  state.contextTab = 'workspace';
  await importDocumentIntoSlot(state.sourceFolder.selectedCvPath, 'cv', {
    persistSnapshot: false
  });
}

async function autoLoadWorkspaceSelections({ loadJd = true, loadCv = true } = {}) {
  if (isGenerationWorkflowBusy()) {
    return;
  }

  if (loadJd) {
    await loadSelectedWorkspaceJd();
  }

  if (loadCv) {
    await loadSelectedWorkspaceCv();
  }
}

function exposeE2ETestApi() {
  if (!window.recruitmentApi?.isE2ETestMode || !window.recruitmentApi.isE2ETestMode()) {
    return;
  }

  window.__atomicgroupTest = {
    async reloadConfiguration() {
      await loadConfiguration();
      render();
    },
    injectFailure(actionType, message) {
      if (typeof actionType === 'string' && actionType in e2eFailureInjection) {
        e2eFailureInjection[actionType] = String(message || '');
      }
    },
    async openSourceFolder(folderPath) {
      const result = await window.recruitmentApi.listSourceFolder({ folderPath });
      state.contextTab = 'workspace';
      applySourceFolderListing(result);
      ensureSourceFolderSelections();
      render();
      await autoLoadWorkspaceSelections({ loadJd: true, loadCv: true });
      await persistCurrentWorkspaceSnapshot();
      render();
    },
    async importDocument(slot, filePath) {
      await importDocumentIntoSlot(filePath, slot);
      await persistCurrentWorkspaceSnapshot();
      render();
    },
    getStateSnapshot() {
      return {
        workbenchTab: state.workbenchTab,
        contextTab: state.contextTab,
        currentWorkspaceId: state.currentWorkspaceId,
        outputMode: state.outputMode,
        outputLanguage: state.outputLanguage,
        summaryStatus: state.summaryStatus,
        isGenerating: state.isGenerating,
        isTranslating: state.isTranslating,
        currentContextProfile: state.currentContextProfile,
        documents: {
          cv: {
            path: state.documents.cv.file?.path || '',
            name: state.documents.cv.file?.name || ''
          },
          jd: {
            path: state.documents.jd.file?.path || '',
            name: state.documents.jd.file?.name || ''
          }
        }
      };
    }
  };
}

async function applyImportedDocument(result, slot, { persistSnapshot = true } = {}) {
  setDocumentSlotFromImportResult(result, slot);
  render();
  await refreshCurrentContextProfile();

  if (persistSnapshot) {
    await persistCurrentWorkspaceSnapshot();
  }

  if (result?.error) {
    setOperationFailure({
      status: 'Import Issue',
      title: slot === 'cv' ? 'Candidate CV import issue' : 'Role JD import issue',
      message: result.error,
      actionType: 'importDocument',
      actionLabel: 'Retry Import',
      actionPayload: {
        filePath: result?.file?.path || '',
        slot
      }
    });
    render();
  }
}

async function chooseDocument(slot) {
  state.contextTab = 'manual';
  const result = await window.recruitmentApi.pickDocument({ slot });

  if (!result) {
    return;
  }

  await applyImportedDocument(result, slot);
}

async function swapDocumentAssignments() {
  state.contextTab = 'manual';
  const fromState = state.documents.cv;
  const toState = state.documents.jd;

  state.documents.cv = { ...toState, slot: 'cv' };
  state.documents.jd = { ...fromState, slot: 'jd' };

  invalidateSummary('Document assignment updated. Generate a fresh draft to reflect the new slot mapping.');
  render();
  await refreshCurrentContextProfile();
  await persistCurrentWorkspaceSnapshot();
}

function canGenerateSummary() {
  if (isGenerationWorkflowBusy()) {
    return false;
  }

  return state.settingsValidation.isValid && ['cv', 'jd'].every((slot) => {
    const slotState = state.documents[slot];
    return slotState.file && !slotState.error && slotState.text.trim().length > 0;
  });
}

function canExportWordDraft() {
  return hasConfiguredWordTemplate() &&
    state.summary.trim().length > 0 &&
    state.draftLifecycle === 'approved';
}

function canCopySummary() {
  return state.summary.trim().length > 0 &&
    state.draftLifecycle === 'approved';
}

function canShareByEmail() {
  return hasConfiguredWordTemplate() &&
    state.summary.trim().length > 0 &&
    state.draftLifecycle === 'approved';
}

function canApproveDraft() {
  return state.summary.trim().length > 0 &&
    state.draftLifecycle !== 'approved';
}

function hasConfiguredWordTemplate() {
  return Boolean(state.settings?.outputTemplatePath) &&
    ['.docx', '.dotx'].includes(state.settings.outputTemplateExtension);
}

async function syncBriefingReviewFromCurrentSummary() {
  if (!state.summary.trim() || !state.briefing) {
    return;
  }

  const result = await window.recruitmentApi.renderBriefingReview({
    briefing: state.briefing,
    summary: state.summary,
    outputMode: state.outputMode,
    outputLanguage: state.outputLanguage,
    summaryRetrievalManifest: state.retrievalEvidence.summary,
    briefingRetrievalManifest: state.retrievalEvidence.briefing,
    cvDocument: state.documents.cv,
    jdDocument: state.documents.jd
  });

  state.briefing = result.briefing || state.briefing;
  state.briefingReview = result.hiringManagerBriefingReview || '';
  state.summary = result.summary || state.summary;
  state.approvalWarnings = result.approvalWarnings || [];
  cacheDraftVariant(state.outputMode, state.outputLanguage);
}

async function refreshBriefingReview() {
  if (!state.briefing) {
    state.briefingReview = '';
    return true;
  }

  try {
    const injectedFailure = consumeE2EFailure('refreshBriefingReview');

    if (injectedFailure) {
      throw new Error(injectedFailure);
    }

    await syncBriefingReviewFromCurrentSummary();

    if (state.lastFailure?.actionType === 'refreshBriefingReview') {
      clearOperationFailure();
    }

    return true;
  } catch (error) {
    setOperationFailure({
      status: 'Review Refresh Failed',
      title: 'Hiring-manager briefing refresh failed',
      message: error instanceof Error
        ? error.message
        : 'Unable to refresh the hiring-manager briefing review.',
      actionType: 'refreshBriefingReview',
      actionLabel: 'Retry Review'
    });
    render();
    return false;
  }
}

function isGenerationWorkflowBusy() {
  return state.isLoadingWorkspace || state.isGenerating || state.isTranslating || state.isSwitchingMode || state.isSavingWordDraft || state.isSharingEmail;
}

async function generateSummary() {
  const nextWorkbenchTab = state.workbenchTab === 'briefing' ? 'briefing' : 'summary';

  if (!state.settingsValidation.isValid) {
    state.summaryStatus = 'Settings Required';
    state.generationError = state.settingsValidation.errors[0] || 'Configure the LLM settings before generation.';
    state.view = 'settings';
    state.settingsTab = 'llm';
    render();
    return;
  }

  if (!['cv', 'jd'].every((slot) => state.documents[slot].file && !state.documents[slot].error)) {
    state.summaryStatus = 'No Draft';
    state.generationError = 'Both the CV and JD must be imported successfully before generation.';
    renderSummary();
    return;
  }

  state.summaryStatus = 'Generating';
  state.isGenerating = true;
  state.draftLifecycle = 'empty';
  state.approvalWarnings = [];
  state.lastExportPath = '';
  state.retrievalEvidence = createEmptyRetrievalEvidence();
  state.debugTrace = [];
  clearOperationFailure();
  state.summaryMessage = 'Generating the candidate summary and hiring-manager briefing review.';
  state.progressLabel = 'Generating candidate summary and hiring-manager briefing review...';
  state.workbenchTab = nextWorkbenchTab;
  render();

  try {
    const result = await window.recruitmentApi.generateSummary({
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd,
      outputMode: state.outputMode,
      outputLanguage: state.outputLanguage
    });

    state.briefing = result.briefing || null;
    state.retrievalEvidence = {
      summary: normalizeRetrievalManifest(result.summaryRetrievalManifest),
      briefing: normalizeRetrievalManifest(result.briefingRetrievalManifest)
    };
    state.briefingReview = result.hiringManagerBriefingReview || '';
    state.summary = result.summary;
    state.outputMode = result.outputMode || state.outputMode;
    state.outputLanguage = result.outputLanguage || state.outputLanguage;
    state.approvalWarnings = result.approvalWarnings || [];
    clearCachedDraftVariants();
    cacheDraftVariant(state.outputMode, state.outputLanguage);
    state.draftLifecycle = 'generated';
    state.templateLabel = result.templateLabel;
    state.workbenchTab = nextWorkbenchTab;
    state.summaryStatus = 'Ready';
    state.summaryMessage = state.approvalWarnings.length > 0
      ? 'Candidate summary and hiring-manager briefing are ready. Review the highlighted checks before approval or sharing.'
      : (state.outputMode === 'anonymous'
        ? 'Candidate summary is ready. Hiring-manager briefing, email, and Word export will stay anonymous after approval.'
        : 'Candidate summary and hiring-manager briefing are ready for review and approval.');
    state.isGenerating = false;
    state.progressLabel = 'Generating summary with the configured model...';
    state.workbenchTab = nextWorkbenchTab;
    await persistCurrentWorkspaceSnapshot();
    render();
  } catch (error) {
    state.isGenerating = false;
    state.progressLabel = 'Generating summary with the configured model...';
    setOperationFailure({
      status: 'Generation Failed',
      title: 'Summary generation failed',
      message: error instanceof Error
        ? error.message
        : 'Unable to generate a summary. Review the settings and imported documents, then try again.',
      actionType: 'generateSummary',
      actionLabel: 'Retry Generation'
    });
    state.workbenchTab = nextWorkbenchTab;
    render();
  }
}

async function copySummary() {
  if (!state.summary.trim()) {
    return;
  }

  await window.recruitmentApi.writeClipboard(state.summary);
  state.summaryStatus = 'Copied';
  state.summaryMessage = 'Summary copied to the clipboard.';
  clearOperationFailure();
  renderSummary();
}

async function shareByEmail() {
  if (!canShareByEmail()) {
    state.summaryStatus = 'Not Ready';
    state.generationError = hasConfiguredWordTemplate()
      ? 'Approve the current draft before opening an email draft.'
      : 'Configure the hiring-manager Word template and approve the current draft before sharing by email.';
    renderSummary();
    return;
  }

  state.debugTrace = [
    `Email handoff requested from workbench at ${new Date().toISOString()}`
  ];
  state.summaryStatus = 'Preparing Email';
  state.isSharingEmail = true;
  clearOperationFailure();
  state.summaryMessage = 'Refreshing the briefing review and preparing the email draft.';
  state.progressLabel = 'Preparing the email draft...';
  state.workbenchTab = 'briefing';
  render();

  try {
    await syncBriefingReviewFromCurrentSummary();

    const result = await window.recruitmentApi.shareDraftByEmail({
      briefing: state.briefing,
      summary: state.summary,
      outputMode: state.outputMode,
      outputLanguage: state.outputLanguage,
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd
    });

    state.debugTrace = result?.debugTrace || state.debugTrace;

    if (result?.attachmentPath) {
      state.lastExportPath = result.attachmentPath;
    }

    if (result?.mode === 'clipboard') {
      state.summaryStatus = 'Clipboard Ready';
      state.summaryMessage = result.attachmentPath
        ? `Default email handoff failed. Subject/body were copied to the clipboard. Attach the prepared Word draft manually from ${result.attachmentPath}.`
        : 'Default email handoff failed. Subject and body were copied to the clipboard.';
    } else {
      state.summaryStatus = 'Email Ready';
      state.summaryMessage = result?.attachmentPath
        ? `Opened the default email client with a prepared draft. Attach the generated Word briefing from ${result.attachmentPath} if your mail client does not add attachments automatically.`
        : 'Opened the default email client with a prepared draft.';
    }

    state.workbenchTab = 'summary';
    await persistCurrentWorkspaceSnapshot();
  } catch (error) {
    const parsed = splitErrorMessageAndTrace(
      error instanceof Error ? error.message : 'Unable to prepare the email draft.'
    );

    if (parsed.debugTrace.length > 0) {
      state.debugTrace = parsed.debugTrace;
    }

    setOperationFailure({
      status: 'Email Failed',
      title: 'Email handoff failed',
      message: parsed.userMessage || 'Unable to prepare the email draft.',
      actionType: 'shareByEmail',
      actionLabel: 'Retry Email'
    });
    state.workbenchTab = 'summary';
  } finally {
    state.isSharingEmail = false;
    state.progressLabel = 'Generating summary with the configured model...';
    render();
  }
}

async function exportWordDraft() {
  if (!canExportWordDraft()) {
    state.debugTrace = ['Export request blocked before the save dialog opened.'];
    state.summaryStatus = 'Not Ready';
    state.generationError = state.settings?.outputTemplatePath
      ? 'A saved recruiter summary is required before exporting the hiring-manager Word draft.'
      : 'Configure a Word .docx or .dotx template before exporting the hiring-manager draft.';
    state.workbenchTab = 'briefing';
    render();
    return;
  }

  state.debugTrace = [
    `Export requested from workbench at ${new Date().toISOString()}`
  ];
  state.summaryStatus = 'Saving';
  state.isSavingWordDraft = true;
  clearOperationFailure();
  state.summaryMessage = 'Refreshing the briefing review and preparing the Word draft.';
  state.progressLabel = 'Preparing the hiring-manager Word draft...';
  state.workbenchTab = 'briefing';
  render();

  try {
    await syncBriefingReviewFromCurrentSummary();

    const result = await window.recruitmentApi.exportHiringManagerWordDraft({
      briefing: state.briefing,
      summary: state.summary,
      outputMode: state.outputMode,
      outputLanguage: state.outputLanguage,
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd
    });

    if (!result || result.canceled) {
      state.debugTrace = result?.debugTrace || state.debugTrace;
      state.summaryStatus = 'Ready';
      state.summaryMessage = 'Word draft save cancelled.';
      state.workbenchTab = 'briefing';
      return;
    }

    state.debugTrace = result.debugTrace || state.debugTrace;
    state.lastExportPath = result.filePath;
    state.summaryStatus = 'Saved';
    state.summaryMessage = `Hiring-manager Word draft saved to ${result.filePath}. This same draft can be reused for future email attachment handoff.`;
    state.workbenchTab = 'briefing';
    await persistCurrentWorkspaceSnapshot();
  } catch (error) {
    const parsed = splitErrorMessageAndTrace(
      error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'
    );

    if (parsed.debugTrace.length > 0) {
      state.debugTrace = parsed.debugTrace;
    }

    setOperationFailure({
      status: 'Export Failed',
      title: 'Word draft export failed',
      message: parsed.userMessage || 'Unable to export the hiring-manager Word draft.',
      actionType: 'exportWordDraft',
      actionLabel: 'Retry Export'
    });
    state.workbenchTab = 'briefing';
  } finally {
    state.isSavingWordDraft = false;
    state.progressLabel = 'Generating summary with the configured model...';
    render();
  }
}

async function revealWordDraft() {
  if (!state.lastExportPath) {
    return;
  }

  try {
    await window.recruitmentApi.revealInFolder(state.lastExportPath);
    state.summaryStatus = 'Saved';
    state.summaryMessage = `Revealed saved Word draft in Finder: ${state.lastExportPath}.`;
    clearOperationFailure();
    state.workbenchTab = 'summary';
    renderSummary();
  } catch (error) {
    setOperationFailure({
      status: 'Reveal Failed',
      title: 'Saved draft could not be revealed',
      message: error instanceof Error
        ? error.message
        : 'Unable to reveal the saved Word draft.',
      actionType: 'revealWordDraft',
      actionLabel: 'Retry Reveal'
    });
    renderSummary();
  }
}

async function openWordDraft() {
  if (!state.lastExportPath) {
    return;
  }

  try {
    await window.recruitmentApi.openPath(state.lastExportPath);
    state.summaryStatus = 'Saved';
    state.summaryMessage = `Opened hiring-manager Word draft: ${state.lastExportPath}.`;
    clearOperationFailure();
    renderSummary();
  } catch (error) {
    setOperationFailure({
      status: 'Open Failed',
      title: 'Saved draft could not be opened',
      message: error instanceof Error
        ? error.message
        : 'Unable to open the generated hiring-manager briefing.',
      actionType: 'openWordDraft',
      actionLabel: 'Retry Open'
    });
    renderSummary();
  }
}

function resetWorkspace() {
  clearCurrentContextProfile();
  state.documents.cv = createEmptyDocumentSlot('cv');
  state.documents.jd = createEmptyDocumentSlot('jd');
  state.sourceFolder = createEmptySourceFolderState();
  state.briefing = null;
  state.retrievalEvidence = createEmptyRetrievalEvidence();
  state.briefingReview = '';
  state.summary = '';
  state.pendingOutputLanguage = '';
  clearCachedDraftVariants();
  state.draftLifecycle = 'empty';
  state.approvalWarnings = [];
  state.lastExportPath = '';
  state.debugTrace = [];
  state.isGenerating = false;
  state.isTranslating = false;
  state.isSavingWordDraft = false;
  state.isSharingEmail = false;
  state.progressLabel = 'Generating summary with the configured model...';
  state.summaryStatus = 'No Draft';
  state.summaryMessage = state.settingsValidation.isValid
    ? 'Workspace reset. Import both documents to generate a new draft.'
    : 'Workspace reset. Save valid settings, then import both documents.';
  clearOperationFailure();
  state.templateLabel = 'Default Recruiter Profile Template';
  state.workbenchTab = 'summary';
  render();
}

function preventBrowserFileDrop(event) {
  event.preventDefault();
}

function parseFileUriList(uriList) {
  return String(uriList || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      if (!line.startsWith('file://')) {
        return '';
      }

      try {
        const decodedPath = decodeURIComponent(new URL(line).pathname);
        return /^\/[A-Za-z]:\//.test(decodedPath)
          ? decodedPath.slice(1)
          : decodedPath;
      } catch (_error) {
        return '';
      }
    })
    .filter(Boolean);
}

function getDroppedFiles(event) {
  const fileEntries = [...(event.dataTransfer?.files || [])]
    .map((file) => ({
      file,
      path: window.recruitmentApi.getPathForDroppedFile(file)
    }))
    .filter((entry) => entry.path);

  if (fileEntries.length > 0) {
    return fileEntries;
  }

  return parseFileUriList(event.dataTransfer?.getData('text/uri-list')).map((filePath) => ({
    file: null,
    path: filePath
  }));
}

async function handleDroppedFiles(event, preferredSlot) {
  const files = getDroppedFiles(event);

  if (files.length === 0) {
    return;
  }

  if (preferredSlot && files.length === 1) {
    await importDocumentIntoSlot(files[0].path, preferredSlot);
    return;
  }

  const targetSlots = files.length === 1
    ? [state.documents.cv.file ? 'jd' : 'cv']
    : ['cv', 'jd'];

  for (let index = 0; index < files.length && index < targetSlots.length; index += 1) {
    await importDocumentIntoSlot(files[index].path, targetSlots[index]);
  }
}

function bindDropTarget(element, preferredSlot) {
  if (!element) {
    return;
  }

  element.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  element.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handleDroppedFiles(event, preferredSlot);
  });
}

window.addEventListener('dragover', preventBrowserFileDrop);
window.addEventListener('drop', preventBrowserFileDrop);

elements.openSettingsView.addEventListener('click', async () => {
  state.view = 'settings';
  render();
  await loadConfiguration({ forceSettingsView: true });
});

elements.returnToWorkbenchButton.addEventListener('click', () => {
  state.view = 'workbench';
  render();
});

elements.openCvTab.addEventListener('click', () => {
  state.workbenchTab = 'cv';
  render();
});

elements.openJdTab.addEventListener('click', () => {
  state.workbenchTab = 'jd';
  render();
});

elements.openSummaryTab.addEventListener('click', () => {
  state.workbenchTab = 'summary';
  render();
});
elements.openBriefingTab.addEventListener('click', async () => {
  state.workbenchTab = 'briefing';

  if (state.briefing) {
    await refreshBriefingReview();
  }

  render();
});

elements.openWorkspaceContextTab.addEventListener('click', () => {
  state.contextTab = 'workspace';
  render();
});

elements.openManualContextTab.addEventListener('click', () => {
  state.contextTab = 'manual';
  render();
});

elements.openRecentContextTab.addEventListener('click', () => {
  state.contextTab = 'recent';
  render();
});

elements.openLlmSettingsTab.addEventListener('click', () => {
  state.settingsTab = 'llm';
  render();
});

elements.openSummaryGuidanceSettingsTab.addEventListener('click', () => {
  state.settingsTab = 'summary-guidance';
  render();
});

elements.openWordTemplateSettingsTab.addEventListener('click', () => {
  state.settingsTab = 'word-template';
  render();
});

elements.providerSelect.addEventListener('change', () => {
  applyProviderPreset(elements.providerSelect.value);
  render();
});

elements.referenceTemplateModeSelect.addEventListener('change', () => {
  if (!state.settings) {
    return;
  }

  state.settings = {
    ...state.settings,
    referenceTemplateMode: elements.referenceTemplateModeSelect.value
  };
  state.settingsTab = 'summary-guidance';
  render();
});
elements.saveSettingsButton.addEventListener('click', saveSettings);
elements.chooseReferenceTemplateButton.addEventListener('click', chooseReferenceTemplate);
elements.clearReferenceTemplateButton.addEventListener('click', clearReferenceTemplate);
elements.chooseWordTemplateButton.addEventListener('click', chooseWordTemplate);
elements.clearWordTemplateButton.addEventListener('click', clearWordTemplate);
elements.chooseBriefingOutputFolderButton.addEventListener('click', chooseBriefingOutputFolder);
elements.clearBriefingOutputFolderButton.addEventListener('click', clearBriefingOutputFolder);
elements.retrySettingsIssueButton.addEventListener('click', retrySettingsIssueAction);
elements.dismissSettingsIssueButton.addEventListener('click', () => {
  clearSettingsIssue();
  render();
});
elements.cv.chooseButton.addEventListener('click', () => chooseDocument('cv'));
elements.jd.chooseButton.addEventListener('click', () => chooseDocument('jd'));
elements.chooseSourceFolderButton.addEventListener('click', chooseSourceFolder);
elements.refreshSourceFolderButton.addEventListener('click', refreshSourceFolder);
elements.sourceFolderJdSelect.addEventListener('change', async () => {
  const nextPath = elements.sourceFolderJdSelect.value;
  const previousSelectedCvPath = state.sourceFolder.selectedCvPath;
  setSelectedSourceFolderJdPath(nextPath);
  ensureSourceFolderSelections();
  render();
  await autoLoadWorkspaceSelections({
    loadJd: true,
    loadCv: previousSelectedCvPath !== state.sourceFolder.selectedCvPath
      || state.documents.cv.file?.path !== state.sourceFolder.selectedCvPath
  });

  const restored = await restoreMatchingWorkspaceSelectionSnapshot();

  if (!restored) {
    await persistCurrentWorkspaceSnapshot();
  }
});
elements.sourceFolderCvSelect.addEventListener('change', async () => {
  const nextPath = elements.sourceFolderCvSelect.value;
  setSelectedSourceFolderCvPath(nextPath);
  render();
  await autoLoadWorkspaceSelections({ loadJd: false, loadCv: true });

  const restored = await restoreMatchingWorkspaceSelectionSnapshot();

  if (!restored) {
    await persistCurrentWorkspaceSnapshot();
  }
});
elements.recentWorkList.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-workspace-id]');

  if (!trigger) {
    return;
  }

  openRecentWorkspace(trigger.dataset.workspaceId);
});
elements.clearRecentWorkspacesButton.addEventListener('click', clearRecentWorkspaces);
elements.swapSourceButton.addEventListener('click', swapDocumentAssignments);
elements.toggleAnonymousModeButton.addEventListener('click', () => {
  setOutputMode(state.outputMode === 'anonymous' ? 'named' : 'anonymous');
});
elements.toggleOutputLanguageButton.addEventListener('click', () => {
  setOutputLanguage(state.outputLanguage === 'zh' ? 'en' : 'zh');
});
elements.generateButton.addEventListener('click', generateSummary);
elements.approveDraftButton.addEventListener('click', approveDraft);
elements.copySummaryButton.addEventListener('click', copySummary);
elements.shareByEmailButton.addEventListener('click', shareByEmail);
elements.exportWordDraftButton.addEventListener('click', exportWordDraft);
elements.revealWordDraftButton.addEventListener('click', revealWordDraft);
elements.openWordDraftButton.addEventListener('click', openWordDraft);
elements.retryFailureActionButton.addEventListener('click', retryLastFailureAction);
elements.dismissFailureActionButton.addEventListener('click', () => {
  clearOperationFailure();
  render();
});
elements.resetButton.addEventListener('click', resetWorkspace);
elements.summaryEditor.addEventListener('input', () => {
  state.summary = readSummaryEditorText();
  markDraftEdited();
  renderSummary();
});
elements.summaryEditor.addEventListener('paste', (event) => {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
});
elements.summaryEditor.addEventListener('blur', async () => {
  state.summary = readSummaryEditorText();

  if (state.briefing) {
    await refreshBriefingReview();
  }

  setRichDocumentContent(elements.summaryEditor, state.summary);
  renderBriefing();
  renderSummary();
  await persistCurrentWorkspaceSnapshot();
});

bindDropTarget(elements.dropzone, null);
exposeE2ETestApi();

Promise.all([
  loadConfiguration(),
  loadRecentWorkspaces()
]).then(() => {
  render();
}).catch((error) => {
  setSettingsIssue({
    title: 'Settings could not be loaded',
    message: error instanceof Error ? error.message : 'Unable to load configuration.',
    actionType: 'loadConfiguration',
    actionLabel: 'Retry Load'
  });
  state.view = 'settings';
  render();
});

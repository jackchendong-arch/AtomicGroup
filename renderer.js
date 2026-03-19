const state = {
  view: 'workbench',
  workbenchTab: 'summary',
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
  briefing: null,
  briefingReview: '',
  summary: '',
  outputMode: 'named',
  draftLifecycle: 'empty',
  approvalWarnings: [],
  lastExportPath: '',
  debugTrace: [],
  isGenerating: false,
  isSavingWordDraft: false,
  isSharingEmail: false,
  progressLabel: 'Generating summary with the configured model...',
  summaryStatus: 'No Draft',
  summaryMessage: 'Load the CV and JD, then generate the summary.',
  generationError: '',
  templateLabel: 'Default Recruiter Profile Template'
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
  sourcePanelStatus: document.getElementById('source-panel-status'),
  dropzone: document.getElementById('dropzone'),
  swapSourceButton: document.getElementById('swap-source-button'),
  setNamedModeButton: document.getElementById('set-named-mode-button'),
  setAnonymousModeButton: document.getElementById('set-anonymous-mode-button'),
  generateButton: document.getElementById('generate-summary-button'),
  resetButton: document.getElementById('reset-workspace-button'),
  summaryStatus: document.getElementById('summary-status'),
  summaryMessage: document.getElementById('summary-message'),
  generationProgress: document.getElementById('generation-progress'),
  generationProgressLabel: document.getElementById('generation-progress-label'),
  summaryEditor: document.getElementById('summary-editor'),
  approveDraftButton: document.getElementById('approve-draft-button'),
  copySummaryButton: document.getElementById('copy-summary-button'),
  shareByEmailButton: document.getElementById('share-by-email-button'),
  exportWordDraftButton: document.getElementById('export-word-draft-button'),
  revealWordDraftButton: document.getElementById('reveal-word-draft-button'),
  openWordDraftButton: document.getElementById('open-word-draft-button'),
  debugTrace: document.getElementById('debug-trace'),
  draftModePill: document.getElementById('draft-mode-pill'),
  draftLifecyclePill: document.getElementById('draft-lifecycle-pill'),
  templateLabel: document.getElementById('template-label'),
  draftMeta: document.getElementById('draft-meta'),
  approvalWarningPanel: document.getElementById('approval-warning-panel'),
  approvalWarningList: document.getElementById('approval-warning-list'),
  briefingStatus: document.getElementById('briefing-status'),
  briefingPreview: document.getElementById('briefing-preview'),
  cv: {
    card: document.getElementById('cv-card'),
    chooseButton: document.getElementById('choose-cv-button'),
    filePill: document.getElementById('cv-file-pill'),
    note: document.getElementById('cv-picker-note'),
    previewStatus: document.getElementById('cv-preview-status'),
    previewText: document.getElementById('cv-preview-text')
  },
  jd: {
    card: document.getElementById('jd-card'),
    chooseButton: document.getElementById('choose-jd-button'),
    filePill: document.getElementById('jd-file-pill'),
    note: document.getElementById('jd-picker-note'),
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

function formatExtension(extension) {
  if (!extension || extension === 'unknown') {
    return 'File type pending';
  }

  return extension.replace('.', '').toUpperCase();
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

function updateSourcePanelStatus() {
  const importedCount = ['cv', 'jd'].filter((slot) => state.documents[slot].file).length;
  elements.sourcePanelStatus.textContent = importedCount === 2 ? 'Ready' : `${importedCount} / 2 Loaded`;
  elements.swapSourceButton.disabled = !(state.documents.cv.file && state.documents.jd.file);
}

function renderSlot(slot) {
  const slotState = state.documents[slot];
  const slotElements = elements[slot];
  const hasFile = Boolean(slotState.file);
  const defaultNote = getSlotDefaultNote(slot);
  const helperText = slotState.error || slotState.warnings[0] || (!hasFile ? defaultNote : '');
  const fileLabel = hasFile ? slotState.file.name : 'No file selected';

  slotElements.filePill.textContent = fileLabel;
  slotElements.filePill.classList.toggle('is-empty', !hasFile);
  slotElements.note.textContent = helperText;
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

  elements.settingsStatusChip.textContent = isValid ? 'Ready' : 'Settings Required';
  elements.settingsStatusMessage.textContent = isValid
    ? 'Settings saved. Summary generation is ready.'
    : (state.settingsValidation.errors[0] || 'Save a valid provider configuration before generating summaries.');
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
  elements.summaryStatus.textContent = state.summaryStatus;
  elements.summaryNavStatus.textContent = state.summaryStatus;
  elements.summaryMessage.textContent = state.generationError || state.summaryMessage;
  elements.generationProgress.classList.toggle('is-hidden', !isGenerationWorkflowBusy());
  elements.generationProgressLabel.textContent = state.progressLabel;
  elements.setNamedModeButton.classList.toggle('is-active', state.outputMode === 'named');
  elements.setAnonymousModeButton.classList.toggle('is-active', state.outputMode === 'anonymous');
  elements.draftModePill.textContent = state.outputMode === 'anonymous' ? 'Anonymous Draft' : 'Named Draft';
  elements.draftLifecyclePill.textContent = getDraftLifecycleLabel();

  if (document.activeElement !== elements.summaryEditor) {
    setRichDocumentContent(elements.summaryEditor, state.summary);
  }

  elements.approveDraftButton.disabled = isGenerationWorkflowBusy() || !canApproveDraft();
  elements.copySummaryButton.disabled = isGenerationWorkflowBusy() || !canCopySummary();
  elements.shareByEmailButton.disabled = isGenerationWorkflowBusy() || !canShareByEmail();
  elements.exportWordDraftButton.disabled = isGenerationWorkflowBusy() || !canExportWordDraft();
  elements.revealWordDraftButton.disabled = !state.lastExportPath;
  elements.openWordDraftButton.disabled = !state.lastExportPath;
  elements.openWordDraftButton.classList.toggle('is-hidden', !state.lastExportPath);
  elements.generateButton.disabled = !canGenerateSummary();
  elements.debugTrace.textContent = formatDebugTrace();
  elements.templateLabel.textContent = state.templateLabel;
  renderApprovalWarnings();
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
  const briefingStatus = state.isGenerating
    ? 'Generating'
    : (state.isSavingWordDraft ? 'Saving' : (hasBriefingReview ? 'Ready' : 'No Briefing'));
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
  renderSettingsForm();
  renderSettingsStatus();
  updateSourcePanelStatus();
  renderSummary();
  renderBriefing();
  setView(state.view);
  setWorkbenchTab(state.workbenchTab);
  setSettingsTab(state.settingsTab);
}

function setSummaryMessage(message) {
  state.summaryMessage = message;
  state.generationError = '';
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

function invalidateSummary(message) {
  state.briefing = null;
  state.briefingReview = '';
  state.summary = '';
  state.draftLifecycle = 'empty';
  state.approvalWarnings = [];
  state.lastExportPath = '';
  state.debugTrace = [];
  state.isSavingWordDraft = false;
  state.isSharingEmail = false;
  state.summaryStatus = 'No Draft';
  state.progressLabel = 'Generating summary with the configured model...';
  setSummaryMessage(message);
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
  const warnings = state.outputMode === 'anonymous' ? state.approvalWarnings : [];
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

function markDraftEdited() {
  if (!state.summary.trim()) {
    return;
  }

  if (state.draftLifecycle === 'generated' || state.draftLifecycle === 'approved') {
    state.draftLifecycle = 'edited';
    state.lastExportPath = '';
    state.summaryMessage = state.outputMode === 'anonymous'
      ? 'Anonymous draft updated. Re-review masking and approve again before copying or exporting.'
      : 'Draft updated. Approve again before copying or exporting.';
    state.generationError = '';
  }
}

function setOutputMode(mode) {
  const normalizedMode = mode === 'anonymous' ? 'anonymous' : 'named';

  if (state.outputMode === normalizedMode) {
    return;
  }

  state.outputMode = normalizedMode;
  state.lastExportPath = '';
  state.approvalWarnings = [];

  if (state.summary.trim()) {
    invalidateSummary(
      normalizedMode === 'anonymous'
        ? 'Draft mode changed to anonymous. Generate a fresh draft to apply anonymization.'
        : 'Draft mode changed to named. Generate a fresh draft to restore named output.'
    );
  }

  render();
}

function approveDraft() {
  if (!canApproveDraft() || isGenerationWorkflowBusy()) {
    return;
  }

  state.draftLifecycle = 'approved';
  state.summaryStatus = 'Ready';
  state.summaryMessage = state.outputMode === 'anonymous'
    ? 'Anonymous draft approved. Copy and Word export are now enabled.'
    : 'Draft approved. Copy and Word export are now enabled.';
  state.generationError = '';
  renderSummary();
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
  state.providers = await window.recruitmentApi.getLlmProviders();
  const result = await window.recruitmentApi.loadLlmSettings();
  state.settings = result.settings;
  state.settingsValidation = result.validation;

  if (forceSettingsView || !result.validation.isValid) {
    state.view = 'settings';
  }

  render();
}

async function saveSettings() {
  const payload = buildSettingsPayloadFromForm();
  const result = await window.recruitmentApi.saveLlmSettings(payload);

  state.settings = result.settings;
  state.settingsValidation = result.validation;

  if (!result.validation.isValid) {
    state.view = 'settings';
    state.settingsTab = result.validation.errors.some((error) => /reference template/i.test(error))
      ? 'summary-guidance'
      : (result.validation.errors.some((error) => /output template|word/i.test(error))
        ? 'word-template'
        : 'llm');
  }

  render();
}

async function chooseReferenceTemplate() {
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
  state.settingsTab = 'summary-guidance';
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
  state.settingsTab = 'word-template';
  render();
}

async function chooseBriefingOutputFolder() {
  const result = await window.recruitmentApi.pickBriefingOutputFolder();

  if (!result || !state.settings) {
    return;
  }

  state.settings = {
    ...state.settings,
    outputBriefingFolderPath: result.path
  };
  state.settingsTab = 'word-template';
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

async function importDocumentIntoSlot(filePath, slot) {
  const result = await window.recruitmentApi.importDocument({ filePath });
  applyImportedDocument(result, slot);
}

function applyImportedDocument(result, slot) {
  state.documents[slot] = {
    slot,
    file: result.file,
    text: result.text,
    previewText: result.previewText,
    warnings: result.warnings,
    error: result.error
  };

  if (result.error) {
    invalidateSummary('Fix the import issue before generating the summary.');
  } else {
    invalidateSummary('Document imported. Load the other source or generate the summary.');
  }

  render();
}

async function chooseDocument(slot) {
  const result = await window.recruitmentApi.pickDocument({ slot });

  if (!result) {
    return;
  }

  applyImportedDocument(result, slot);
}

function swapDocumentAssignments() {
  const fromState = state.documents.cv;
  const toState = state.documents.jd;

  state.documents.cv = { ...toState, slot: 'cv' };
  state.documents.jd = { ...fromState, slot: 'jd' };

  invalidateSummary('Document assignment updated. Generate a fresh draft to reflect the new slot mapping.');
  render();
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
    cvDocument: state.documents.cv,
    jdDocument: state.documents.jd
  });

  state.briefing = result.briefing || state.briefing;
  state.briefingReview = result.hiringManagerBriefingReview || '';
  state.summary = result.summary || state.summary;
  state.approvalWarnings = result.approvalWarnings || [];
}

async function refreshBriefingReview() {
  if (!state.briefing) {
    state.briefingReview = '';
    return;
  }

  await syncBriefingReviewFromCurrentSummary();
}

function isGenerationWorkflowBusy() {
  return state.isGenerating || state.isSavingWordDraft || state.isSharingEmail;
}

async function generateSummary() {
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
  state.debugTrace = [];
  state.generationError = '';
  state.summaryMessage = 'Generating the candidate summary and hiring-manager briefing review.';
  state.progressLabel = 'Generating candidate summary and hiring-manager briefing review...';
  state.workbenchTab = 'summary';
  renderSummary();

  try {
    const result = await window.recruitmentApi.generateSummary({
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd,
      outputMode: state.outputMode
    });

    state.briefing = result.briefing || null;
    state.briefingReview = result.hiringManagerBriefingReview || '';
    state.summary = result.summary;
    state.outputMode = result.outputMode || state.outputMode;
    state.approvalWarnings = result.approvalWarnings || [];
    state.draftLifecycle = 'generated';
    state.templateLabel = result.templateLabel;
    state.workbenchTab = 'summary';
    state.summaryStatus = 'Ready';
    state.summaryMessage = state.outputMode === 'anonymous'
      ? (state.approvalWarnings.length > 0
        ? 'Anonymous draft is ready. Review the residual privacy warnings and approve it before export.'
        : 'Anonymous draft is ready. Review and approve it before copying or exporting.')
      : 'Candidate summary and hiring-manager briefing are ready for review and approval.';
    state.isGenerating = false;
    state.progressLabel = 'Generating summary with the configured model...';
    state.workbenchTab = 'summary';
    renderSummary();
  } catch (error) {
    state.isGenerating = false;
    state.summaryStatus = 'Failed';
    state.progressLabel = 'Generating summary with the configured model...';
    state.generationError = error instanceof Error
      ? error.message
      : 'Unable to generate a summary. Review the settings and imported documents, then try again.';
    state.workbenchTab = 'summary';
    renderSummary();
  }
}

async function copySummary() {
  if (!state.summary.trim()) {
    return;
  }

  await window.recruitmentApi.writeClipboard(state.summary);
  state.summaryStatus = 'Copied';
  state.summaryMessage = 'Summary copied to the clipboard.';
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
  state.generationError = '';
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
  } catch (error) {
    const parsed = splitErrorMessageAndTrace(
      error instanceof Error ? error.message : 'Unable to prepare the email draft.'
    );

    if (parsed.debugTrace.length > 0) {
      state.debugTrace = parsed.debugTrace;
    }

    state.summaryStatus = 'Failed';
    state.generationError = parsed.userMessage || 'Unable to prepare the email draft.';
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
  state.generationError = '';
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
  } catch (error) {
    const parsed = splitErrorMessageAndTrace(
      error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'
    );

    if (parsed.debugTrace.length > 0) {
      state.debugTrace = parsed.debugTrace;
    }

    state.summaryStatus = 'Failed';
    state.generationError = parsed.userMessage || 'Unable to export the hiring-manager Word draft.';
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
    state.workbenchTab = 'summary';
    renderSummary();
  } catch (error) {
    state.summaryStatus = 'Failed';
    state.generationError = error instanceof Error
      ? error.message
      : 'Unable to reveal the saved Word draft.';
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
    state.generationError = '';
    renderSummary();
  } catch (error) {
    state.summaryStatus = 'Failed';
    state.generationError = error instanceof Error
      ? error.message
      : 'Unable to open the generated hiring-manager briefing.';
    renderSummary();
  }
}

function resetWorkspace() {
  state.documents.cv = createEmptyDocumentSlot('cv');
  state.documents.jd = createEmptyDocumentSlot('jd');
  state.briefing = null;
  state.briefingReview = '';
  state.summary = '';
  state.draftLifecycle = 'empty';
  state.approvalWarnings = [];
  state.lastExportPath = '';
  state.debugTrace = [];
  state.isGenerating = false;
  state.isSavingWordDraft = false;
  state.isSharingEmail = false;
  state.progressLabel = 'Generating summary with the configured model...';
  state.summaryStatus = 'No Draft';
  state.summaryMessage = state.settingsValidation.isValid
    ? 'Workspace reset. Import both documents to generate a new draft.'
    : 'Workspace reset. Save valid settings, then import both documents.';
  state.generationError = '';
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
    try {
      await refreshBriefingReview();
    } catch (_error) {
      // Keep the last rendered review if the refresh fails.
    }
  }

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
elements.cv.chooseButton.addEventListener('click', () => chooseDocument('cv'));
elements.jd.chooseButton.addEventListener('click', () => chooseDocument('jd'));
elements.swapSourceButton.addEventListener('click', swapDocumentAssignments);
elements.setNamedModeButton.addEventListener('click', () => setOutputMode('named'));
elements.setAnonymousModeButton.addEventListener('click', () => setOutputMode('anonymous'));
elements.generateButton.addEventListener('click', generateSummary);
elements.approveDraftButton.addEventListener('click', approveDraft);
elements.copySummaryButton.addEventListener('click', copySummary);
elements.shareByEmailButton.addEventListener('click', shareByEmail);
elements.exportWordDraftButton.addEventListener('click', exportWordDraft);
elements.revealWordDraftButton.addEventListener('click', revealWordDraft);
elements.openWordDraftButton.addEventListener('click', openWordDraft);
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
    try {
      await refreshBriefingReview();
    } catch (_error) {
      // Keep the current review state if the refresh fails.
    }
  }

  setRichDocumentContent(elements.summaryEditor, state.summary);
  renderBriefing();
  renderSummary();
});

bindDropTarget(elements.dropzone, null);
bindDropTarget(elements.cv.card, 'cv');
bindDropTarget(elements.jd.card, 'jd');

loadConfiguration().catch((error) => {
  state.generationError = error instanceof Error ? error.message : 'Unable to load configuration.';
  state.view = 'settings';
  render();
});

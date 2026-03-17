const state = {
  view: 'workbench',
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
  summary: '',
  lastExportPath: '',
  debugTrace: [],
  summaryStatus: 'Draft Not Generated',
  summaryMessage: 'Configure the model and import both documents to generate a summary.',
  generationError: '',
  templateLabel: 'Default Recruiter Profile Template'
};

const elements = {
  workbenchView: document.getElementById('workbench-view'),
  settingsView: document.getElementById('settings-view'),
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
  openTemplateSettingsTab: document.getElementById('open-template-settings-tab'),
  llmSettingsPanel: document.getElementById('llm-settings-panel'),
  templateSettingsPanel: document.getElementById('template-settings-panel'),
  chooseWordTemplateButton: document.getElementById('choose-word-template-button'),
  clearWordTemplateButton: document.getElementById('clear-word-template-button'),
  wordTemplateName: document.getElementById('word-template-name'),
  wordTemplatePath: document.getElementById('word-template-path'),
  templateConfigNote: document.getElementById('template-config-note'),
  sourcePanelStatus: document.getElementById('source-panel-status'),
  dropzone: document.getElementById('dropzone'),
  generateButton: document.getElementById('generate-summary-button'),
  resetButton: document.getElementById('reset-workspace-button'),
  summaryStatus: document.getElementById('summary-status'),
  summaryMessage: document.getElementById('summary-message'),
  summaryEditor: document.getElementById('summary-editor'),
  copySummaryButton: document.getElementById('copy-summary-button'),
  exportWordDraftButton: document.getElementById('export-word-draft-button'),
  revealWordDraftButton: document.getElementById('reveal-word-draft-button'),
  debugTrace: document.getElementById('debug-trace'),
  templateLabel: document.getElementById('template-label'),
  draftMeta: document.getElementById('draft-meta'),
  cv: {
    card: document.getElementById('cv-card'),
    chooseButton: document.getElementById('choose-cv-button'),
    assignButton: document.getElementById('assign-cv-button'),
    filePill: document.getElementById('cv-file-pill'),
    typePill: document.getElementById('cv-type-pill'),
    statusPill: document.getElementById('cv-status-pill'),
    note: document.getElementById('cv-picker-note'),
    previewStatus: document.getElementById('cv-preview-status'),
    previewText: document.getElementById('cv-preview-text')
  },
  jd: {
    card: document.getElementById('jd-card'),
    chooseButton: document.getElementById('choose-jd-button'),
    assignButton: document.getElementById('assign-jd-button'),
    filePill: document.getElementById('jd-file-pill'),
    typePill: document.getElementById('jd-type-pill'),
    statusPill: document.getElementById('jd-status-pill'),
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

function formatStatus(slotState) {
  if (!slotState.file) {
    return 'Not imported';
  }

  if (slotState.error) {
    return 'Import error';
  }

  if (slotState.warnings.length > 0) {
    return 'Imported with warning';
  }

  return 'Imported';
}

function getSlotDefaultNote(slot) {
  return slot === 'cv'
    ? 'Use the file picker or drag and drop to load a candidate resume from this machine.'
    : 'Use the file picker or drag and drop to load a role description from this machine.';
}

function getSlotDefaultPreview(slot) {
  return slot === 'cv'
    ? 'Imported CV text will appear here. The recruiter should be able to spot missing sections, noisy parsing, or evidence that matters for the role before generation begins.'
    : 'Parsed JD content will appear here. This panel will help the recruiter confirm the role title, scope, and requirement signals that the summary should anchor against.';
}

function getSlotStatusChip(slotState) {
  if (!slotState.file) {
    return 'Awaiting Extraction';
  }

  if (slotState.error) {
    return 'Import Error';
  }

  if (slotState.warnings.length > 0) {
    return 'Imported With Warning';
  }

  return 'Imported and Ready';
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

  return `Stored in app template library: ${state.settings.outputTemplatePath}`;
}

function setView(view) {
  state.view = view;
  elements.workbenchView.classList.toggle('is-hidden', view !== 'workbench');
  elements.settingsView.classList.toggle('is-hidden', view !== 'settings');
}

function setSettingsTab(tab) {
  state.settingsTab = tab;
  elements.openLlmSettingsTab.classList.toggle('is-active', tab === 'llm');
  elements.openTemplateSettingsTab.classList.toggle('is-active', tab === 'templates');
  elements.llmSettingsPanel.classList.toggle('is-hidden', tab !== 'llm');
  elements.templateSettingsPanel.classList.toggle('is-hidden', tab !== 'templates');
}

function updateSourcePanelStatus() {
  const importedCount = ['cv', 'jd'].filter((slot) => state.documents[slot].file).length;

  if (importedCount === 0) {
    elements.sourcePanelStatus.textContent = 'Awaiting Documents';
    return;
  }

  if (importedCount === 1) {
    elements.sourcePanelStatus.textContent = '1 Document Loaded';
    return;
  }

  elements.sourcePanelStatus.textContent = 'Ready to Generate';
}

function renderSlot(slot) {
  const slotState = state.documents[slot];
  const slotElements = elements[slot];
  const hasFile = Boolean(slotState.file);

  slotElements.filePill.textContent = hasFile ? slotState.file.name : 'No file selected';
  slotElements.typePill.textContent = hasFile ? formatExtension(slotState.file.extension) : 'File type pending';
  slotElements.statusPill.textContent = formatStatus(slotState);
  slotElements.filePill.classList.toggle('pill-emphasis', hasFile && !slotState.error);
  slotElements.note.textContent =
    slotState.error ||
    slotState.warnings[0] ||
    (hasFile ? slotState.file.path : getSlotDefaultNote(slot));
  slotElements.previewStatus.textContent = getSlotStatusChip(slotState);
  slotElements.previewText.textContent = slotState.previewText || getSlotDefaultPreview(slot);
  slotElements.assignButton.disabled = !hasFile;
}

function renderSettingsStatus() {
  const isValid = Boolean(state.settingsValidation?.isValid);

  elements.settingsStatusChip.textContent = isValid ? 'Ready' : 'Settings Required';
  elements.settingsStatusMessage.textContent = isValid
    ? 'Settings saved successfully. DeepSeek-backed summary generation is ready.'
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
  elements.providerHelpText.textContent = selectedProvider?.helpText || '';
  elements.wordTemplateName.textContent = getTemplateDisplayName();
  elements.wordTemplatePath.textContent = getTemplateDisplayPath();
  elements.clearWordTemplateButton.disabled = !state.settings.outputTemplatePath;
  elements.templateConfigNote.textContent = state.settings.outputTemplatePath
    ? 'The recruiter workbench stays on the default text summary. The selected Word template is stored in the application template library for future hiring-manager output.'
    : 'The recruiter workbench stays on the default text summary. Add a Word .docx or .dotx template and save settings when you want to define the hiring-manager output format.';
}

function renderSummary() {
  elements.summaryStatus.textContent = state.summaryStatus;
  elements.summaryMessage.textContent = state.generationError || state.summaryMessage;
  elements.summaryEditor.value = state.summary;
  elements.copySummaryButton.disabled = state.summary.trim().length === 0;
  elements.exportWordDraftButton.disabled = !canExportWordDraft();
  elements.revealWordDraftButton.disabled = !state.lastExportPath;
  elements.generateButton.disabled = !canGenerateSummary();
  elements.debugTrace.textContent = formatDebugTrace();
  elements.templateLabel.textContent = state.templateLabel;
  if (state.lastExportPath) {
    elements.draftMeta.textContent = `Last saved Word draft: ${state.lastExportPath}`;
    return;
  }

  elements.draftMeta.textContent = state.settings?.outputTemplateName
    ? `In-app review uses the default text summary structure. Save Word Draft uses ${state.settings.outputTemplateName} from the application template library for hiring-manager output.`
    : 'In-app review uses the default text summary structure. A Word output template can be configured in the settings page for future hiring-manager sharing.';
}

function render() {
  renderSlot('cv');
  renderSlot('jd');
  renderSettingsForm();
  renderSettingsStatus();
  updateSourcePanelStatus();
  renderSummary();
  setView(state.view);
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
  state.summary = '';
  state.summaryStatus = 'Draft Not Generated';
  setSummaryMessage(message);
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
    outputTemplatePath: state.settings?.outputTemplatePath || '',
    outputTemplateName: state.settings?.outputTemplateName || '',
    outputTemplateExtension: state.settings?.outputTemplateExtension || ''
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

async function loadConfiguration() {
  state.providers = await window.recruitmentApi.getLlmProviders();
  const result = await window.recruitmentApi.loadLlmSettings();
  state.settings = result.settings;
  state.settingsValidation = result.validation;

  if (!result.validation.isValid) {
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
    state.settingsTab = 'llm';
  }

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
  state.settingsTab = 'templates';
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
    invalidateSummary('Fix the import issue before generating a summary.');
  } else {
    invalidateSummary('Document imported successfully. Load the remaining file or generate the draft when ready.');
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

function swapDocumentAssignments(fromSlot, toSlot) {
  const fromState = state.documents[fromSlot];
  const toState = state.documents[toSlot];

  state.documents[fromSlot] = { ...toState, slot: fromSlot };
  state.documents[toSlot] = { ...fromState, slot: toSlot };

  invalidateSummary('Document assignment updated. Generate a fresh draft to reflect the new slot mapping.');
  render();
}

function canGenerateSummary() {
  return state.settingsValidation.isValid && ['cv', 'jd'].every((slot) => {
    const slotState = state.documents[slot];
    return slotState.file && !slotState.error && slotState.text.trim().length > 0;
  });
}

function canExportWordDraft() {
  return Boolean(state.settings?.outputTemplatePath) &&
    ['.docx', '.dotx'].includes(state.settings.outputTemplateExtension) &&
    state.summary.trim().length > 0;
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
    state.summaryStatus = 'Draft Not Generated';
    state.generationError = 'Both the CV and JD must be imported successfully before generation.';
    renderSummary();
    return;
  }

  state.summaryStatus = 'Generating Draft';
  state.generationError = '';
  state.summaryMessage = 'Generating recruiter summary with the configured model.';
  renderSummary();

  try {
    const result = await window.recruitmentApi.generateSummary({
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd
    });

    state.summary = result.summary;
    state.summaryStatus = 'Draft Ready for Review';
    state.summaryMessage = 'Draft generated successfully. Review and edit it before copying.';
    state.templateLabel = result.templateLabel;
    renderSummary();
  } catch (error) {
    state.summaryStatus = 'Generation Failed';
    state.generationError = error instanceof Error
      ? error.message
      : 'Unable to generate a summary. Review the settings and imported documents, then try again.';
    renderSummary();
  }
}

async function copySummary() {
  if (!state.summary.trim()) {
    return;
  }

  await window.recruitmentApi.writeClipboard(state.summary);
  state.summaryStatus = 'Draft Copied';
  state.summaryMessage = 'Summary copied to the clipboard.';
  renderSummary();
}

async function exportWordDraft() {
  if (!canExportWordDraft()) {
    state.debugTrace = ['Export request blocked before the save dialog opened.'];
    state.summaryStatus = 'Word Draft Not Ready';
    state.generationError = state.settings?.outputTemplatePath
      ? 'A saved recruiter summary is required before exporting the hiring-manager Word draft.'
      : 'Configure a Word .docx or .dotx template before exporting the hiring-manager draft.';
    renderSummary();
    return;
  }

  state.debugTrace = [
    `Export requested from workbench at ${new Date().toISOString()}`
  ];
  state.summaryStatus = 'Saving Word Draft';
  state.generationError = '';
  state.summaryMessage = 'Applying the configured Word template to the reviewed summary.';
  renderSummary();

  try {
    const result = await window.recruitmentApi.exportHiringManagerWordDraft({
      summary: state.summary,
      cvDocument: state.documents.cv,
      jdDocument: state.documents.jd
    });

    if (!result || result.canceled) {
      state.debugTrace = result?.debugTrace || state.debugTrace;
      state.summaryStatus = 'Draft Ready for Review';
      state.summaryMessage = 'Word draft save cancelled. The recruiter summary is still ready for review.';
      renderSummary();
      return;
    }

    state.debugTrace = result.debugTrace || state.debugTrace;
    state.lastExportPath = result.filePath;
    state.summaryStatus = 'Word Draft Saved';
    state.summaryMessage = `Hiring-manager Word draft saved to ${result.filePath}.`;
    renderSummary();
  } catch (error) {
    const parsed = splitErrorMessageAndTrace(
      error instanceof Error ? error.message : 'Unable to export the hiring-manager Word draft.'
    );

    if (parsed.debugTrace.length > 0) {
      state.debugTrace = parsed.debugTrace;
    }

    state.summaryStatus = 'Word Draft Export Failed';
    state.generationError = parsed.userMessage || 'Unable to export the hiring-manager Word draft.';
    renderSummary();
  }
}

async function revealWordDraft() {
  if (!state.lastExportPath) {
    return;
  }

  try {
    await window.recruitmentApi.revealInFolder(state.lastExportPath);
    state.summaryStatus = 'Word Draft Saved';
    state.summaryMessage = `Revealed saved Word draft in Finder: ${state.lastExportPath}.`;
    renderSummary();
  } catch (error) {
    state.summaryStatus = 'Word Draft Reveal Failed';
    state.generationError = error instanceof Error
      ? error.message
      : 'Unable to reveal the saved Word draft.';
    renderSummary();
  }
}

function resetWorkspace() {
  state.documents.cv = createEmptyDocumentSlot('cv');
  state.documents.jd = createEmptyDocumentSlot('jd');
  state.summary = '';
  state.lastExportPath = '';
  state.debugTrace = [];
  state.summaryStatus = 'Draft Not Generated';
  state.summaryMessage = state.settingsValidation.isValid
    ? 'Workspace reset. Import both documents to generate a new draft.'
    : 'Workspace reset. Save valid model settings and import both documents to generate a new draft.';
  state.generationError = '';
  state.templateLabel = 'Default Recruiter Profile Template';
  render();
}

async function handleDroppedFiles(fileList, preferredSlot) {
  const files = [...fileList].filter((file) => file.path);

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
  });

  element.addEventListener('drop', async (event) => {
    event.preventDefault();
    await handleDroppedFiles(event.dataTransfer.files, preferredSlot);
  });
}

elements.openSettingsView.addEventListener('click', () => {
  state.view = 'settings';
  render();
});

elements.returnToWorkbenchButton.addEventListener('click', () => {
  state.view = 'workbench';
  render();
});

elements.openLlmSettingsTab.addEventListener('click', () => {
  state.settingsTab = 'llm';
  render();
});

elements.openTemplateSettingsTab.addEventListener('click', () => {
  state.settingsTab = 'templates';
  render();
});

elements.providerSelect.addEventListener('change', () => {
  applyProviderPreset(elements.providerSelect.value);
  render();
});

elements.saveSettingsButton.addEventListener('click', saveSettings);
elements.chooseWordTemplateButton.addEventListener('click', chooseWordTemplate);
elements.clearWordTemplateButton.addEventListener('click', clearWordTemplate);
elements.cv.chooseButton.addEventListener('click', () => chooseDocument('cv'));
elements.jd.chooseButton.addEventListener('click', () => chooseDocument('jd'));
elements.cv.assignButton.addEventListener('click', () => swapDocumentAssignments('cv', 'jd'));
elements.jd.assignButton.addEventListener('click', () => swapDocumentAssignments('jd', 'cv'));
elements.generateButton.addEventListener('click', generateSummary);
elements.copySummaryButton.addEventListener('click', copySummary);
elements.exportWordDraftButton.addEventListener('click', exportWordDraft);
elements.revealWordDraftButton.addEventListener('click', revealWordDraft);
elements.resetButton.addEventListener('click', resetWorkspace);
elements.summaryEditor.addEventListener('input', (event) => {
  state.summary = event.target.value;
  elements.copySummaryButton.disabled = state.summary.trim().length === 0;
  elements.exportWordDraftButton.disabled = !canExportWordDraft();
});

bindDropTarget(elements.dropzone, null);
bindDropTarget(elements.cv.card, 'cv');
bindDropTarget(elements.jd.card, 'jd');

loadConfiguration().catch((error) => {
  state.generationError = error instanceof Error ? error.message : 'Unable to load configuration.';
  state.view = 'settings';
  render();
});

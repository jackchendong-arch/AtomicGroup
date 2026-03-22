const path = require('node:path');

const { normalizeOutputLanguage } = require('./output-language-service');

const WORKSPACE_ID_PATTERN = /^[a-f0-9]{16}$/i;
const MAX_CLIPBOARD_TEXT_LENGTH = 200000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requirePlainObject(value, message) {
  if (!isPlainObject(value)) {
    throw new Error(message);
  }

  return value;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireNonEmptyString(value, message) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function validateAbsolutePath(value, message) {
  const normalized = requireNonEmptyString(value, message);

  if (!path.isAbsolute(normalized)) {
    throw new Error(message);
  }

  return normalized;
}

function validateOptionalAbsolutePath(value, message) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return '';
  }

  if (!path.isAbsolute(normalized)) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOutputMode(value) {
  return normalizeString(value) === 'anonymous' ? 'anonymous' : 'named';
}

function validateDocumentLike(document, { required = true, label = 'Document' } = {}) {
  if (document == null && !required) {
    return null;
  }

  const normalizedDocument = requirePlainObject(document, `${label} payload is required.`);
  const file = requirePlainObject(normalizedDocument.file, `${label} file metadata is required.`);
  const filePath = validateOptionalAbsolutePath(file.path, `${label} file path must be an absolute path.`);
  const fileName = normalizeString(file.name);

  if (!filePath && !fileName) {
    throw new Error(`${label} file metadata must include a name or absolute path.`);
  }

  return normalizedDocument;
}

function validateDraftPayload(payload, { requireSummary = false } = {}) {
  const normalizedPayload = requirePlainObject(payload, 'A draft payload is required.');
  const summary = String(normalizedPayload.summary || '');

  if (requireSummary && !summary.trim()) {
    throw new Error('A generated recruiter summary is required.');
  }

  if (normalizedPayload.briefing != null && !isPlainObject(normalizedPayload.briefing)) {
    throw new Error('The draft briefing payload must be an object when provided.');
  }

  return {
    ...normalizedPayload,
    cvDocument: validateDocumentLike(normalizedPayload.cvDocument, { label: 'Candidate CV' }),
    jdDocument: validateDocumentLike(normalizedPayload.jdDocument, { label: 'Job description' }),
    summary,
    briefing: normalizedPayload.briefing || null,
    outputMode: normalizeOutputMode(normalizedPayload.outputMode),
    outputLanguage: normalizeOutputLanguage(normalizedPayload.outputLanguage)
  };
}

function validateDocumentPickPayload(payload) {
  const normalizedPayload = requirePlainObject(payload, 'A document pick payload is required.');
  const slot = normalizeString(normalizedPayload.slot).toLowerCase();

  if (!['cv', 'jd'].includes(slot)) {
    throw new Error('Document pick requests must target the CV or JD slot.');
  }

  return { slot };
}

function validateDocumentImportPayload(payload) {
  const normalizedPayload = requirePlainObject(payload, 'A document import payload is required.');

  return {
    filePath: validateAbsolutePath(normalizedPayload.filePath, 'Document import requires an absolute file path.')
  };
}

function validateSourceFolderListPayload(payload) {
  const normalizedPayload = requirePlainObject(payload, 'A source folder payload is required.');

  return {
    folderPath: validateAbsolutePath(normalizedPayload.folderPath, 'A source folder requires an absolute folder path.')
  };
}

function validateWorkspaceProfilePayload(payload) {
  const normalizedPayload = requirePlainObject(payload || {}, 'A workspace profile payload is required.');

  return {
    cvDocument: validateDocumentLike(normalizedPayload.cvDocument, { required: false, label: 'Candidate CV' }),
    jdDocument: validateDocumentLike(normalizedPayload.jdDocument, { required: false, label: 'Job description' })
  };
}

function validateWorkspaceSnapshotPayload(payload) {
  const normalizedPayload = requirePlainObject(payload, 'A workspace snapshot payload is required.');

  validateOptionalAbsolutePath(normalizedPayload.sourceFolderPath, 'Workspace source folder paths must be absolute.');
  validateOptionalAbsolutePath(normalizedPayload.selectedJdPath, 'Selected JD paths must be absolute.');
  validateOptionalAbsolutePath(normalizedPayload.selectedCvPath, 'Selected CV paths must be absolute.');
  validateOptionalAbsolutePath(normalizedPayload.loadedJdPath, 'Loaded JD paths must be absolute.');
  validateOptionalAbsolutePath(normalizedPayload.loadedCvPath, 'Loaded CV paths must be absolute.');
  validateOptionalAbsolutePath(normalizedPayload.lastExportPath, 'Exported draft paths must be absolute.');

  return normalizedPayload;
}

function validateLoadWorkspaceSnapshotPayload(payload) {
  const normalizedPayload = requirePlainObject(payload, 'A recent-work request payload is required.');
  const workspaceId = requireNonEmptyString(normalizedPayload.workspaceId, 'A recent workspace ID is required.');

  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    throw new Error('The recent workspace ID is invalid.');
  }

  return { workspaceId };
}

function validateLlmSettingsPayload(payload) {
  return requirePlainObject(payload, 'A settings payload is required.');
}

function validateSummaryGenerationPayload(payload) {
  return validateDraftPayload(payload, { requireSummary: false });
}

function validateDraftTranslationPayload(payload) {
  const normalizedPayload = validateDraftPayload(payload, { requireSummary: false });

  return {
    ...normalizedPayload,
    sourceLanguage: normalizeOutputLanguage(normalizedPayload.sourceLanguage),
    targetLanguage: normalizeOutputLanguage(normalizedPayload.targetLanguage)
  };
}

function validateRenderBriefingPayload(payload) {
  return validateDraftPayload(payload, { requireSummary: true });
}

function validateClipboardTextPayload(value) {
  if (typeof value !== 'string') {
    throw new Error('Clipboard writes require text content.');
  }

  if (value.length > MAX_CLIPBOARD_TEXT_LENGTH) {
    throw new Error('Clipboard writes are limited to 200000 characters.');
  }

  return value;
}

function validateShellPathPayload(filePath) {
  return validateAbsolutePath(filePath, 'A local absolute file path is required.');
}

module.exports = {
  MAX_CLIPBOARD_TEXT_LENGTH,
  validateClipboardTextPayload,
  validateDocumentImportPayload,
  validateDocumentLike,
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
};

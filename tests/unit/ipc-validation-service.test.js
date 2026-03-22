const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_CLIPBOARD_TEXT_LENGTH,
  validateClipboardTextPayload,
  validateDocumentImportPayload,
  validateDocumentPickPayload,
  validateDraftTranslationPayload,
  validateLoadWorkspaceSnapshotPayload,
  validateRenderBriefingPayload,
  validateShellPathPayload,
  validateSourceFolderListPayload,
  validateSummaryGenerationPayload,
  validateWorkspaceProfilePayload,
  validateWorkspaceSnapshotPayload
} = require('../../services/ipc-validation-service');

function createDocument(pathValue, name = 'sample.txt') {
  return {
    file: {
      path: pathValue,
      name
    },
    text: 'sample text'
  };
}

test('document pick only accepts cv and jd slots', () => {
  assert.deepEqual(validateDocumentPickPayload({ slot: 'cv' }), { slot: 'cv' });
  assert.deepEqual(validateDocumentPickPayload({ slot: 'jd' }), { slot: 'jd' });
  assert.throws(() => validateDocumentPickPayload({ slot: 'notes' }), /CV or JD slot/);
});

test('file and folder handlers require absolute paths', () => {
  assert.equal(
    validateDocumentImportPayload({ filePath: '/tmp/candidate.pdf' }).filePath,
    '/tmp/candidate.pdf'
  );
  assert.equal(
    validateSourceFolderListPayload({ folderPath: '/tmp/workspace' }).folderPath,
    '/tmp/workspace'
  );
  assert.equal(validateShellPathPayload('/tmp/output.docx'), '/tmp/output.docx');

  assert.throws(() => validateDocumentImportPayload({ filePath: 'candidate.pdf' }), /absolute file path/);
  assert.throws(() => validateSourceFolderListPayload({ folderPath: './workspace' }), /absolute folder path/);
  assert.throws(() => validateShellPathPayload('output.docx'), /absolute file path/);
});

test('summary generation requires CV and JD document payloads', () => {
  const payload = validateSummaryGenerationPayload({
    cvDocument: createDocument('/tmp/candidate.pdf'),
    jdDocument: createDocument('/tmp/job.pdf'),
    outputMode: 'anonymous',
    outputLanguage: 'cn'
  });

  assert.equal(payload.outputMode, 'anonymous');
  assert.equal(payload.outputLanguage, 'zh');
  assert.throws(
    () => validateSummaryGenerationPayload({ cvDocument: createDocument('/tmp/candidate.pdf') }),
    /Job description payload is required/
  );
});

test('translation payloads normalize language and reject invalid briefing shapes', () => {
  const payload = validateDraftTranslationPayload({
    summary: 'Example summary',
    briefing: { fit_summary: 'Example fit' },
    cvDocument: createDocument('/tmp/candidate.pdf'),
    jdDocument: createDocument('/tmp/job.pdf'),
    sourceLanguage: 'english',
    targetLanguage: 'cn'
  });

  assert.equal(payload.sourceLanguage, 'en');
  assert.equal(payload.targetLanguage, 'zh');
  assert.throws(
    () => validateDraftTranslationPayload({
      summary: 'Example summary',
      briefing: [],
      cvDocument: createDocument('/tmp/candidate.pdf'),
      jdDocument: createDocument('/tmp/job.pdf')
    }),
    /briefing payload must be an object/
  );
});

test('render-review payload requires a generated summary', () => {
  assert.throws(
    () => validateRenderBriefingPayload({
      summary: '',
      briefing: {},
      cvDocument: createDocument('/tmp/candidate.pdf'),
      jdDocument: createDocument('/tmp/job.pdf')
    }),
    /generated recruiter summary is required/
  );
});

test('workspace payloads validate IDs and optional stored paths', () => {
  assert.equal(
    validateLoadWorkspaceSnapshotPayload({ workspaceId: '0123456789abcdef' }).workspaceId,
    '0123456789abcdef'
  );
  assert.throws(
    () => validateLoadWorkspaceSnapshotPayload({ workspaceId: 'bad-id' }),
    /workspace ID is invalid/
  );

  assert.doesNotThrow(() => validateWorkspaceSnapshotPayload({
    sourceFolderPath: '/tmp/workspace',
    selectedJdPath: '/tmp/workspace/jd.pdf',
    selectedCvPath: '/tmp/workspace/cv.pdf',
    loadedJdPath: '/tmp/workspace/jd.pdf',
    loadedCvPath: '/tmp/workspace/cv.pdf',
    lastExportPath: '/tmp/output.docx'
  }));
  assert.throws(
    () => validateWorkspaceSnapshotPayload({ loadedCvPath: 'cv.pdf' }),
    /Loaded CV paths must be absolute/
  );
});

test('workspace profile payload accepts optional document inputs', () => {
  const profilePayload = validateWorkspaceProfilePayload({
    cvDocument: createDocument('/tmp/candidate.pdf'),
    jdDocument: null
  });

  assert.equal(profilePayload.cvDocument.file.path, '/tmp/candidate.pdf');
  assert.equal(profilePayload.jdDocument, null);
});

test('clipboard writes are limited to bounded text payloads', () => {
  assert.equal(validateClipboardTextPayload('hello'), 'hello');
  assert.throws(
    () => validateClipboardTextPayload('x'.repeat(MAX_CLIPBOARD_TEXT_LENGTH + 1)),
    /limited to 200000 characters/
  );
});

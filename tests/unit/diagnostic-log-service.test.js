const test = require('node:test');
const assert = require('node:assert/strict');

const {
  categorizeOperationError,
  createDiagnosticRunId,
  pushDiagnosticContext,
  pushDiagnosticResult
} = require('../../services/diagnostic-log-service');

test('createDiagnosticRunId prefixes a uuid-like identifier', () => {
  const runId = createDiagnosticRunId('summary');

  assert.match(runId, /^summary-[0-9a-f-]{36}$/i);
});

test('categorizeOperationError maps common failure classes', () => {
  assert.equal(categorizeOperationError(new Error('Settings validation failed.')), 'settings-error');
  assert.equal(categorizeOperationError(new Error('Malformed JSON parse failure.')), 'parse-error');
  assert.equal(categorizeOperationError(new Error('Draft translation failed.')), 'translation-error');
  assert.equal(categorizeOperationError(new Error('Unable to export the document.')), 'export-error');
  assert.equal(categorizeOperationError(new Error('Email handoff fallback used.')), 'email-error');
  assert.equal(categorizeOperationError(new Error('Unexpected issue.')), 'unknown-error');
});

test('pushDiagnosticContext and pushDiagnosticResult write support-friendly metadata lines', () => {
  const debugTrace = [];

  pushDiagnosticContext(debugTrace, {
    operation: 'Summary generation',
    runId: 'summary-123'
  });
  pushDiagnosticResult(debugTrace, {
    status: 'failed',
    error: new Error('Malformed JSON parse failure.')
  });

  assert.match(debugTrace[0], /^Summary generation started at /);
  assert.equal(debugTrace[1], 'Run ID: summary-123');
  assert.equal(debugTrace[2], 'Result status: failed');
  assert.equal(debugTrace[3], 'Error category: parse-error');
});

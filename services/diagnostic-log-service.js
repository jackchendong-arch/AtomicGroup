const { randomUUID } = require('node:crypto');

function createDiagnosticRunId(prefix = 'run') {
  return `${prefix}-${randomUUID()}`;
}

function categorizeOperationError(error) {
  const message = String(error instanceof Error ? error.message : error || '')
    .toLowerCase()
    .trim();

  if (!message) {
    return 'unknown-error';
  }

  if (message.includes('settings') || message.includes('api key')) {
    return 'settings-error';
  }

  if (message.includes('validation')) {
    return 'validation-error';
  }

  if (message.includes('parse') || message.includes('json')) {
    return 'parse-error';
  }

  if (message.includes('translate') || message.includes('translation')) {
    return 'translation-error';
  }

  if (message.includes('email')) {
    return 'email-error';
  }

  if (message.includes('export') || message.includes('template') || message.includes('save')) {
    return 'export-error';
  }

  if (message.includes('clipboard') || message.includes('mailto') || message.includes('open')) {
    return 'shell-error';
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('provider')) {
    return 'provider-error';
  }

  return 'unknown-error';
}

function pushDiagnosticContext(debugTrace, {
  operation,
  runId,
  startedAt = new Date().toISOString()
}) {
  debugTrace.push(`${operation} started at ${startedAt}`);
  debugTrace.push(`Run ID: ${runId}`);
}

function pushDiagnosticResult(debugTrace, {
  status,
  error = null
}) {
  debugTrace.push(`Result status: ${status}`);
  debugTrace.push(`Error category: ${error ? categorizeOperationError(error) : 'none'}`);
}

module.exports = {
  categorizeOperationError,
  createDiagnosticRunId,
  pushDiagnosticContext,
  pushDiagnosticResult
};

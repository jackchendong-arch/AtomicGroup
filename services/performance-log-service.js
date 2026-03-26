const fs = require('node:fs/promises');
const path = require('node:path');

function roundDurationMs(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric * 10) / 10;
}

function normalizePhaseDurations(phases = {}) {
  if (!phases || typeof phases !== 'object' || Array.isArray(phases)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(phases)
      .map(([key, value]) => {
        const normalizedKey = String(key || '').trim();
        const numericValue = Number(value);

        if (!normalizedKey || !Number.isFinite(numericValue) || numericValue < 0) {
          return null;
        }

        return [normalizedKey, roundDurationMs(numericValue)];
      })
      .filter(Boolean)
  );
}

function normalizeContext(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(context)
      .map(([key, value]) => {
        const normalizedKey = String(key || '').trim();

        if (!normalizedKey || value == null) {
          return null;
        }

        if (typeof value === 'number') {
          return [normalizedKey, roundDurationMs(value)];
        }

        if (typeof value === 'boolean') {
          return [normalizedKey, value];
        }

        return [normalizedKey, String(value).trim()];
      })
      .filter(Boolean)
  );
}

function buildPerformancePayload({ totalMs, phases = {} } = {}) {
  return {
    totalMs: roundDurationMs(totalMs),
    phases: normalizePhaseDurations(phases)
  };
}

function buildPerformanceRecord({
  operation,
  runId,
  status,
  startedAt,
  completedAt = new Date().toISOString(),
  errorCategory = 'none',
  totalMs,
  phases = {},
  context = {}
} = {}) {
  return {
    operation: String(operation || '').trim() || 'unknown-operation',
    runId: String(runId || '').trim() || 'unknown-run',
    status: String(status || '').trim() || 'unknown',
    startedAt: String(startedAt || '').trim() || completedAt,
    completedAt: String(completedAt || '').trim() || new Date().toISOString(),
    errorCategory: String(errorCategory || '').trim() || 'none',
    performance: buildPerformancePayload({
      totalMs,
      phases
    }),
    context: normalizeContext(context)
  };
}

async function appendPerformanceRecord(logPath, record) {
  const normalizedLogPath = String(logPath || '').trim();

  if (!normalizedLogPath) {
    throw new Error('A performance log path is required.');
  }

  await fs.mkdir(path.dirname(normalizedLogPath), { recursive: true });
  await fs.appendFile(normalizedLogPath, `${JSON.stringify(record)}\n`, 'utf8');
}

module.exports = {
  appendPerformanceRecord,
  buildPerformancePayload,
  buildPerformanceRecord,
  normalizePhaseDurations,
  roundDurationMs
};

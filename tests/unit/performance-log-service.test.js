const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const {
  appendPerformanceRecord,
  buildPerformancePayload,
  buildPerformanceRecord
} = require('../../services/performance-log-service');

test('buildPerformancePayload rounds timings and keeps numeric phases', () => {
  const payload = buildPerformancePayload({
    totalMs: 1234.567,
    phases: {
      promptPreparationMs: 50.987,
      providerWaitMs: 1000.444,
      ignored: Number.NaN
    }
  });

  assert.deepEqual(payload, {
    totalMs: 1234.6,
    phases: {
      promptPreparationMs: 51,
      providerWaitMs: 1000.4
    }
  });
});

test('buildPerformanceRecord normalizes context and wraps the performance payload', () => {
  const record = buildPerformanceRecord({
    operation: 'summary-generation',
    runId: 'summary-123',
    status: 'success',
    startedAt: '2026-03-26T00:00:00.000Z',
    completedAt: '2026-03-26T00:00:05.000Z',
    errorCategory: 'none',
    totalMs: 5012.3,
    phases: {
      summaryLlmMs: 3100.44,
      reviewAssemblyMs: 88.88
    },
    context: {
      candidateFile: 'CV4-2.pdf',
      outputLanguage: 'zh',
      promptTokensEstimate: 1234.56,
      skipped: null
    }
  });

  assert.deepEqual(record, {
    operation: 'summary-generation',
    runId: 'summary-123',
    status: 'success',
    startedAt: '2026-03-26T00:00:00.000Z',
    completedAt: '2026-03-26T00:00:05.000Z',
    errorCategory: 'none',
    performance: {
      totalMs: 5012.3,
      phases: {
        summaryLlmMs: 3100.4,
        reviewAssemblyMs: 88.9
      }
    },
    context: {
      candidateFile: 'CV4-2.pdf',
      outputLanguage: 'zh',
      promptTokensEstimate: 1234.6
    }
  });
});

test('appendPerformanceRecord writes json lines to disk', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-performance-log-'));
  const logPath = path.join(tempDir, 'performance-stats.jsonl');

  const record = buildPerformanceRecord({
    operation: 'draft-translation',
    runId: 'translation-123',
    status: 'success',
    startedAt: '2026-03-26T00:00:00.000Z',
    completedAt: '2026-03-26T00:00:02.000Z',
    totalMs: 2050.1,
    phases: {
      summaryTranslationMs: 500,
      coreBriefingTranslationMs: 1200
    },
    context: {
      candidateFile: 'CV4-3.pdf'
    }
  });

  await appendPerformanceRecord(logPath, record);

  const content = await fs.readFile(logPath, 'utf8');
  const lines = content.trim().split('\n');

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), record);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { importDocument } = require('../../services/document-service');

const appRoot = path.resolve(__dirname, '..', '..');

test('importDocument records basic performance timings for supported files', async () => {
  const result = await importDocument(path.join(appRoot, 'samples', 'sample-cv.txt'));

  assert.equal(result.error, null);
  assert.equal(typeof result.performance?.totalMs, 'number');
  assert.equal(typeof result.performance?.extractMs, 'number');
  assert.equal(typeof result.performance?.normalizeMs, 'number');
  assert(result.performance.totalMs >= 0);
  assert(result.performance.extractMs >= 0);
  assert(result.performance.normalizeMs >= 0);
});

test('importDocument records total timing for unsupported files', async () => {
  const result = await importDocument(path.join(appRoot, 'samples', 'unsupported-image.png'));

  assert.match(result.error || '', /Unsupported file type/);
  assert.equal(typeof result.performance?.totalMs, 'number');
  assert(result.performance.totalMs >= 0);
});

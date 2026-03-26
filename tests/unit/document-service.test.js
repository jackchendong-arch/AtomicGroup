const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const { importDocument } = require('../../services/document-service');

const appRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = '/Users/jack/Dev/Test/AtomicGroup/Role4';

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

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

test(
  'importDocument uses OCR fallback for weak image-based PDFs when local OCR tooling is available',
  {
    skip: fs.existsSync(path.join(fixtureRoot, 'CV4-3.pdf')) &&
      commandExists('pdftoppm') &&
      commandExists('tesseract')
      ? false
      : 'OCR fixture or local OCR tooling is not available on this machine.'
  },
  async () => {
    const result = await importDocument(path.join(fixtureRoot, 'CV4-3.pdf'));

    assert.equal(result.error, null);
    assert.match(result.text, /Galxe \| Golang Engineer \| Apr 2022 - Jan 2024/i);
    assert.match(result.text, /OPPO \| PHP Engineer \| Feb 2017 - May 2019/i);
    assert.match(result.text, /Low-Latency Solana Transaction Engine/i);
    assert.doesNotMatch(result.text, /--\s*1 of 3\s*--/i);
    assert.match((result.warnings || []).join('\n'), /OCR fallback was used/i);
  }
);

test(
  'importDocument strips standalone opaque PDF extraction artifact lines from CV previews',
  {
    skip: fs.existsSync(path.join(fixtureRoot, 'CV4-1.pdf'))
      ? false
      : 'Role4 fixture is not available on this machine.'
  },
  async () => {
    const result = await importDocument(path.join(fixtureRoot, 'CV4-1.pdf'));

    assert.equal(result.error, null);
    assert.match(result.text, /Noah Zhang/);
    assert.match(result.text, /托福 113，GRE 325/);
    assert.doesNotMatch(result.text, /4f9d19693e1546211HZ43di_EldUwY-6UfyXWOOmlvXRPxln3Q~~/);
    assert.doesNotMatch(result.text, /(?:^|\n)\s*~\s*(?:\n|$)/);
  }
);

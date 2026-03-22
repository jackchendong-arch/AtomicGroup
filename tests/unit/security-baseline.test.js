const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

test('main window keeps explicit Electron hardening enabled', () => {
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /webSecurity:\s*true/);
  assert.match(mainSource, /allowRunningInsecureContent:\s*false/);
  assert.match(mainSource, /setWindowOpenHandler\(\(\)\s*=>\s*\(\{\s*action:\s*'deny'\s*\}\)\)/);
  assert.match(mainSource, /will-navigate/);
});

test('renderer keeps a restrictive content security policy', () => {
  assert.match(indexSource, /Content-Security-Policy/);
  assert.match(indexSource, /default-src 'self'/);
  assert.match(indexSource, /script-src 'self'/);
  assert.match(indexSource, /object-src 'none'/);
  assert.match(indexSource, /frame-src 'none'/);
});

test('persistent diagnostics avoid raw candidate-content log lines', () => {
  assert.doesNotMatch(mainSource, /Structured briefing raw response:/);
  assert.doesNotMatch(mainSource, /Experience section preview:/);
  assert.doesNotMatch(mainSource, /candidate name:/);
  assert.doesNotMatch(mainSource, /candidate location:/);
  assert.match(mainSource, /Structured briefing raw response digest:/);
});

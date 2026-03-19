const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDefaultSettings,
  validateSettings
} = require('../../services/llm-settings-service');

test('default LLM settings do not include a committed API key', () => {
  const defaults = createDefaultSettings();

  assert.equal(defaults.apiKey, '');
});

test('LLM settings validation requires the user to provide an API key', () => {
  const validation = validateSettings(createDefaultSettings());

  assert.equal(validation.isValid, false);
  assert.match(validation.errors.join(' '), /API key is required/i);
});

test('LLM settings validation requires a selected file when local reference template mode is enabled', () => {
  const validation = validateSettings({
    ...createDefaultSettings(),
    apiKey: 'test-only-placeholder',
    referenceTemplateMode: 'local-file'
  });

  assert.equal(validation.isValid, false);
  assert.match(validation.errors.join(' '), /Choose a local reference template file/i);
});

test('LLM settings validation accepts a supported local reference template file', () => {
  const validation = validateSettings({
    ...createDefaultSettings(),
    apiKey: 'test-only-placeholder',
    referenceTemplateMode: 'local-file',
    referenceTemplatePath: '/tmp/reference-template.md',
    referenceTemplateName: 'reference-template.md',
    referenceTemplateExtension: '.md'
  });

  assert.equal(validation.isValid, true);
  assert.equal(validation.settings.referenceTemplateMode, 'local-file');
  assert.equal(validation.settings.referenceTemplateExtension, '.md');
});

test('LLM settings validation rejects non-Markdown reference template files', () => {
  const validation = validateSettings({
    ...createDefaultSettings(),
    apiKey: 'test-only-placeholder',
    referenceTemplateMode: 'local-file',
    referenceTemplatePath: '/tmp/reference-template.docx',
    referenceTemplateName: 'reference-template.docx',
    referenceTemplateExtension: '.docx'
  });

  assert.equal(validation.isValid, false);
  assert.match(validation.errors.join(' '), /Markdown \(\.md\) document/i);
});

test('LLM settings validation preserves an optional briefing output folder path', () => {
  const validation = validateSettings({
    ...createDefaultSettings(),
    apiKey: 'test-only-placeholder',
    outputBriefingFolderPath: '/Users/jack/Documents/AtomicGroup Briefings'
  });

  assert.equal(validation.isValid, true);
  assert.equal(validation.settings.outputBriefingFolderPath, '/Users/jack/Documents/AtomicGroup Briefings');
});

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

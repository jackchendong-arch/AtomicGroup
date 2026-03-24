const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  LlmSettingsStore,
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

test('LlmSettingsStore saves API keys only in encrypted mode when secure storage is available', async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-llm-settings-'));
  const safeStorage = {
    isEncryptionAvailable() {
      return true;
    },
    encryptString(value) {
      return Buffer.from(`enc:${value}`, 'utf8');
    },
    decryptString(buffer) {
      return String(buffer).replace(/^enc:/, '');
    }
  };
  const store = new LlmSettingsStore({ userDataPath, safeStorage });
  const settings = {
    ...createDefaultSettings(),
    apiKey: 'test-only-placeholder'
  };

  const result = await store.save(settings);
  const persisted = JSON.parse(await fs.readFile(path.join(userDataPath, 'llm-settings.json'), 'utf8'));

  assert.equal(result.validation.isValid, true);
  assert.equal(persisted.apiKeyMode, 'encrypted');
  assert.notEqual(persisted.apiKey, 'test-only-placeholder');

  const loaded = await store.load();
  assert.equal(loaded.apiKey, 'test-only-placeholder');

  await fs.rm(userDataPath, { recursive: true, force: true });
});

test('LlmSettingsStore rejects saving API keys when secure storage is unavailable', async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-llm-settings-'));
  const safeStorage = {
    isEncryptionAvailable() {
      return false;
    }
  };
  const store = new LlmSettingsStore({ userDataPath, safeStorage });
  const settings = {
    ...createDefaultSettings(),
    apiKey: 'test-only-placeholder'
  };

  const result = await store.save(settings);
  const persisted = JSON.parse(await fs.readFile(path.join(userDataPath, 'llm-settings.json'), 'utf8'));
  const loaded = await store.load();

  assert.equal(result.validation.isValid, true);
  assert.equal(result.settings.apiKeyStorageMode, 'session');
  assert.equal(result.apiKeyStatus.statusCode, 'secure-storage-unavailable');
  assert.equal(persisted.apiKeyMode, 'empty');
  assert.equal(persisted.apiKey, '');
  assert.equal(loaded.apiKey, 'test-only-placeholder');
  assert.equal(loaded.apiKeyStorageMode, 'session');

  await fs.rm(userDataPath, { recursive: true, force: true });
});

test('LlmSettingsStore strips any legacy plaintext API key from disk on load', async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-llm-settings-'));
  const filePath = path.join(userDataPath, 'llm-settings.json');
  await fs.writeFile(filePath, JSON.stringify({
    ...createDefaultSettings(),
    apiKeyMode: 'plain',
    apiKey: 'legacy-plaintext-key'
  }, null, 2));

  const store = new LlmSettingsStore({
    userDataPath,
    safeStorage: {
      isEncryptionAvailable() {
        return true;
      },
      encryptString(value) {
        return Buffer.from(`enc:${value}`, 'utf8');
      },
      decryptString(buffer) {
        return String(buffer).replace(/^enc:/, '');
      }
    }
  });

  const loaded = await store.load();
  const sanitized = JSON.parse(await fs.readFile(filePath, 'utf8'));

  assert.equal(loaded.apiKey, '');
  assert.equal(sanitized.apiKeyMode, 'empty');
  assert.equal(sanitized.apiKey, '');

  await fs.rm(userDataPath, { recursive: true, force: true });
});

test('LlmSettingsStore reports a secure-storage read failure when encrypted keys cannot be decrypted', async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-llm-settings-'));
  const filePath = path.join(userDataPath, 'llm-settings.json');
  await fs.writeFile(filePath, JSON.stringify({
    ...createDefaultSettings(),
    apiKeyMode: 'encrypted',
    apiKey: Buffer.from('enc:test-only-placeholder', 'utf8').toString('base64')
  }, null, 2));

  const store = new LlmSettingsStore({
    userDataPath,
    safeStorage: {
      isEncryptionAvailable() {
        return true;
      },
      encryptString(value) {
        return Buffer.from(`enc:${value}`, 'utf8');
      },
      decryptString() {
        throw new Error('Access denied by policy');
      }
    }
  });

  const loaded = await store.load();
  const validation = validateSettings(loaded);

  assert.equal(loaded.apiKey, '');
  assert.equal(loaded.apiKeyStorageMode, 'error');
  assert.equal(loaded.apiKeyStatusCode, 'secure-storage-policy-blocked');
  assert.match(loaded.apiKeyStatusMessage, /Support code: secure-storage-policy-blocked/i);
  assert.equal(validation.isValid, false);
  assert.match(validation.errors.join(' '), /policy|profile restrictions/i);

  await fs.rm(userDataPath, { recursive: true, force: true });
});

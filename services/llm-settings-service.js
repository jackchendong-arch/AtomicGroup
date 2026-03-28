const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const API_KEY_OPTIONAL_PROVIDER_IDS = new Set(['ollama_deepseek_r1']);
const LOCAL_OLLAMA_MIN_MAX_TOKENS = 3200;

function createDefaultSettings() {
  return {
    providerId: 'deepseek',
    providerLabel: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    apiKey: '',
    temperature: 0.2,
    maxTokens: 1200,
    systemPrompt:
      'You are an executive search recruiter assistant. Produce grounded, evidence-based candidate profile summaries for hiring managers. Do not invent facts. Call out strengths and gaps clearly.',
    referenceTemplateMode: 'default',
    referenceTemplatePath: '',
    referenceTemplateName: '',
    referenceTemplateExtension: '',
    outputTemplatePath: '',
    outputTemplateName: '',
    outputTemplateExtension: '',
    outputBriefingFolderPath: '',
    apiKeyStorageMode: 'empty',
    apiKeyStatusCode: '',
    apiKeyStatusMessage: ''
  };
}

function createApiKeyStatus({
  storageMode = 'empty',
  statusCode = '',
  message = ''
} = {}) {
  return {
    storageMode,
    statusCode,
    message
  };
}

function applyApiKeyStatus(settings, apiKeyStatus = createApiKeyStatus()) {
  return {
    ...settings,
    apiKeyStorageMode: apiKeyStatus.storageMode,
    apiKeyStatusCode: apiKeyStatus.statusCode,
    apiKeyStatusMessage: apiKeyStatus.message
  };
}

function classifySecureStorageFailure({ phase = 'save', error, secureStorageAvailable = true } = {}) {
  const message = String(error?.message || '').toLowerCase();

  if (!secureStorageAvailable) {
    return createApiKeyStatus({
      storageMode: phase === 'save' ? 'session' : 'error',
      statusCode: 'secure-storage-unavailable',
      message: phase === 'save'
        ? 'Secure OS-backed storage is unavailable. The API key will be used only for this session and must be entered again after restart. Support code: secure-storage-unavailable.'
        : 'Secure OS-backed storage is unavailable, so the saved API key cannot be read on this device. Re-enter the API key or restore secure storage availability. Support code: secure-storage-unavailable.'
    });
  }

  if (
    message.includes('policy') ||
    message.includes('denied') ||
    message.includes('permission') ||
    message.includes('not permitted') ||
    message.includes('access')
  ) {
    return createApiKeyStatus({
      storageMode: phase === 'save' ? 'session' : 'error',
      statusCode: 'secure-storage-policy-blocked',
      message: phase === 'save'
        ? 'Secure credential storage is blocked by local policy or profile restrictions. The API key will be used only for this session. Support code: secure-storage-policy-blocked.'
        : 'The saved API key cannot be read because secure credential storage is blocked by local policy or profile restrictions. Re-enter the API key or contact support. Support code: secure-storage-policy-blocked.'
    });
  }

  return createApiKeyStatus({
    storageMode: phase === 'save' ? 'session' : 'error',
    statusCode: phase === 'save' ? 'secure-storage-write-failed' : 'secure-storage-read-failed',
    message: phase === 'save'
      ? 'Secure OS-backed storage failed while saving the API key. The API key will be used only for this session. Support code: secure-storage-write-failed.'
      : 'The saved API key could not be read from secure storage. Re-enter the API key or contact support. Support code: secure-storage-read-failed.'
  });
}

function normalizeNumericValue(value, fallback) {
  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return numeric;
}

function normalizeSettings(input = {}) {
  const defaults = createDefaultSettings();
  const merged = {
    ...defaults,
    ...input
  };
  const providerId = String(merged.providerId || defaults.providerId);
  const normalizedMaxTokens = normalizeNumericValue(merged.maxTokens, defaults.maxTokens);
  const maxTokens = providerId === 'ollama_deepseek_r1'
    ? Math.max(normalizedMaxTokens, LOCAL_OLLAMA_MIN_MAX_TOKENS)
    : normalizedMaxTokens;

  return {
    providerId,
    providerLabel: String(merged.providerLabel || defaults.providerLabel),
    baseUrl: String(merged.baseUrl || defaults.baseUrl).trim(),
    model: String(merged.model || defaults.model).trim(),
    apiKey: String(merged.apiKey || '').trim(),
    temperature: normalizeNumericValue(merged.temperature, defaults.temperature),
    maxTokens,
    systemPrompt: String(merged.systemPrompt || defaults.systemPrompt).trim(),
    referenceTemplateMode: String(merged.referenceTemplateMode || defaults.referenceTemplateMode).trim() || 'default',
    referenceTemplatePath: String(merged.referenceTemplatePath || '').trim(),
    referenceTemplateName: String(merged.referenceTemplateName || '').trim(),
    referenceTemplateExtension: String(merged.referenceTemplateExtension || '').trim().toLowerCase(),
    outputTemplatePath: String(merged.outputTemplatePath || '').trim(),
    outputTemplateName: String(merged.outputTemplateName || '').trim(),
    outputTemplateExtension: String(merged.outputTemplateExtension || '').trim().toLowerCase(),
    outputBriefingFolderPath: String(merged.outputBriefingFolderPath || '').trim(),
    apiKeyStorageMode: String(merged.apiKeyStorageMode || 'empty').trim() || 'empty',
    apiKeyStatusCode: String(merged.apiKeyStatusCode || '').trim(),
    apiKeyStatusMessage: String(merged.apiKeyStatusMessage || '').trim()
  };
}

function providerRequiresApiKey(providerId = '') {
  return !API_KEY_OPTIONAL_PROVIDER_IDS.has(String(providerId || '').trim());
}

function validateSettings(input = {}) {
  const settings = normalizeSettings(input);
  const errors = [];

  if (!settings.providerId) {
    errors.push('Provider is required.');
  }

  if (!settings.baseUrl) {
    errors.push('Base URL is required.');
  }

  if (!/^https?:\/\//i.test(settings.baseUrl)) {
    errors.push('Base URL must start with http:// or https://.');
  }

  if (!settings.model) {
    errors.push('Model is required.');
  }

  if (!settings.apiKey && providerRequiresApiKey(settings.providerId)) {
    if (settings.apiKeyStatusCode === 'secure-storage-unavailable') {
      errors.push('Secure storage is unavailable, so the saved API key could not be loaded. Re-enter the API key for this session.');
    } else if (settings.apiKeyStatusCode === 'secure-storage-policy-blocked') {
      errors.push('Secure credential storage is blocked by local policy or profile restrictions. Re-enter the API key or contact support.');
    } else if (settings.apiKeyStatusCode === 'secure-storage-read-failed') {
      errors.push('The saved API key could not be read from secure storage. Re-enter the API key or contact support.');
    } else {
      errors.push('API key is required.');
    }
  }

  if (settings.temperature < 0 || settings.temperature > 2) {
    errors.push('Temperature must be between 0 and 2.');
  }

  if (settings.maxTokens < 128 || settings.maxTokens > 8192) {
    errors.push('Max tokens must be between 128 and 8192.');
  }

  if (!settings.systemPrompt) {
    errors.push('System prompt is required.');
  }

  if (!['default', 'local-file'].includes(settings.referenceTemplateMode)) {
    errors.push('Reference template mode must be `default` or `local-file`.');
  }

  if (settings.referenceTemplateMode === 'local-file' && !settings.referenceTemplatePath) {
    errors.push('Choose a local reference template file or switch back to the built-in default template.');
  }

  if (
    settings.referenceTemplatePath &&
    settings.referenceTemplateExtension !== '.md'
  ) {
    errors.push('The reference template must be a Markdown (.md) document.');
  }

  if (
    settings.outputTemplatePath &&
    !['.docx', '.dotx'].includes(settings.outputTemplateExtension)
  ) {
    errors.push('The hiring-manager output template must be a Word .docx or .dotx document.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    settings
  };
}

function isPathInside(parentPath, childPath) {
  if (!parentPath || !childPath) {
    return false;
  }

  const relativePath = path.relative(parentPath, childPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function removeFileIfExists(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

class LlmSettingsStore {
  constructor({ userDataPath, safeStorage }) {
    this.filePath = path.join(userDataPath, 'llm-settings.json');
    this.templateDirectoryPath = path.join(userDataPath, 'templates');
    this.safeStorage = safeStorage;
    this.sessionApiKey = '';
    this.testSecureStorageMode = 'normal';
  }

  setTestSecureStorageMode(mode = 'normal') {
    const normalizedMode = String(mode || 'normal').trim().toLowerCase();
    this.testSecureStorageMode = normalizedMode || 'normal';
  }

  shouldUseTestSecureStorage() {
    return ['available', 'policy-blocked', 'write-failed', 'read-failed'].includes(this.testSecureStorageMode);
  }

  encryptWithTestSecureStorage(apiKey) {
    return Buffer.from(`atomicgroup-test:${String(apiKey || '')}`, 'utf8').toString('base64');
  }

  decryptWithTestSecureStorage(encodedValue) {
    const decodedValue = Buffer.from(String(encodedValue || ''), 'base64').toString('utf8');

    if (!decodedValue.startsWith('atomicgroup-test:')) {
      throw new Error('Secure credential storage read failed.');
    }

    return decodedValue.slice('atomicgroup-test:'.length);
  }

  isManagedTemplatePath(filePath) {
    return isPathInside(this.templateDirectoryPath, filePath);
  }

  buildManagedTemplatePath(extension) {
    const normalizedExtension = extension || '.docx';
    return path.join(
      this.templateDirectoryPath,
      `candidate-summary-template-${randomUUID()}${normalizedExtension}`
    );
  }

  async removeManagedTemplateFile(filePath) {
    if (!this.isManagedTemplatePath(filePath)) {
      return;
    }

    await removeFileIfExists(filePath);
  }

  async prepareTemplateSettings(settings, existingSettings) {
    if (!settings.outputTemplatePath) {
      await this.removeManagedTemplateFile(existingSettings.outputTemplatePath);
      return settings;
    }

    if (this.isManagedTemplatePath(settings.outputTemplatePath)) {
      return settings;
    }

    await fs.access(settings.outputTemplatePath);
    await fs.mkdir(this.templateDirectoryPath, { recursive: true });

    const targetPath = this.buildManagedTemplatePath(settings.outputTemplateExtension);
    await fs.copyFile(settings.outputTemplatePath, targetPath);

    if (existingSettings.outputTemplatePath !== targetPath) {
      await this.removeManagedTemplateFile(existingSettings.outputTemplatePath);
    }

    return {
      ...settings,
      outputTemplatePath: targetPath,
      outputTemplateName: settings.outputTemplateName || path.basename(settings.outputTemplatePath),
      outputTemplateExtension:
        settings.outputTemplateExtension || path.extname(settings.outputTemplatePath).toLowerCase()
    };
  }

  hasSecureApiKeyStorage() {
    if (this.testSecureStorageMode === 'unavailable') {
      return false;
    }

    if (this.shouldUseTestSecureStorage()) {
      return true;
    }

    return Boolean(
      this.safeStorage &&
      typeof this.safeStorage.isEncryptionAvailable === 'function' &&
      this.safeStorage.isEncryptionAvailable() &&
      typeof this.safeStorage.encryptString === 'function' &&
      typeof this.safeStorage.decryptString === 'function'
    );
  }

  encryptApiKey(apiKey) {
    if (!apiKey) {
      return {
        apiKeyMode: 'empty',
        apiKey: ''
      };
    }

    if (this.hasSecureApiKeyStorage()) {
      if (this.testSecureStorageMode === 'policy-blocked') {
        throw new Error('Secure credential storage access denied by local policy.');
      }

      if (this.testSecureStorageMode === 'write-failed') {
        throw new Error('Secure credential storage write failed.');
      }

      if (this.shouldUseTestSecureStorage()) {
        return {
          apiKeyMode: 'encrypted',
          apiKey: this.encryptWithTestSecureStorage(apiKey)
        };
      }

      return {
        apiKeyMode: 'encrypted',
        apiKey: this.safeStorage.encryptString(apiKey).toString('base64')
      };
    }

    throw new Error('Secure OS-backed encryption is unavailable, so the API key cannot be saved.');
  }

  decryptApiKey(record = {}) {
    if (record.apiKeyMode === 'encrypted' && record.apiKey) {
      if (!this.hasSecureApiKeyStorage()) {
        return {
          apiKey: '',
          apiKeyStatus: classifySecureStorageFailure({
            phase: 'load',
            secureStorageAvailable: false
          })
        };
      }

      try {
        if (this.testSecureStorageMode === 'policy-blocked') {
          throw new Error('Secure credential storage access denied by local policy.');
        }

        if (this.testSecureStorageMode === 'read-failed') {
          throw new Error('Secure credential storage read failed.');
        }

        if (this.shouldUseTestSecureStorage()) {
          return {
            apiKey: this.decryptWithTestSecureStorage(record.apiKey),
            apiKeyStatus: createApiKeyStatus({
              storageMode: 'persistent'
            })
          };
        }

        const decrypted = this.safeStorage.decryptString(Buffer.from(record.apiKey, 'base64'));
        return {
          apiKey: decrypted,
          apiKeyStatus: createApiKeyStatus({
            storageMode: 'persistent'
          })
        };
      } catch (error) {
        return {
          apiKey: '',
          apiKeyStatus: classifySecureStorageFailure({
            phase: 'load',
            error,
            secureStorageAvailable: true
          })
        };
      }
    }

    if (this.sessionApiKey) {
      return {
        apiKey: this.sessionApiKey,
        apiKeyStatus: createApiKeyStatus({
          storageMode: 'session',
          statusCode: 'session-only',
          message: 'The API key is available only for this running app session and must be entered again after restart. Support code: session-only.'
        })
      };
    }

    return {
      apiKey: '',
      apiKeyStatus: createApiKeyStatus({
        storageMode: 'empty'
      })
    };
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (parsed.apiKeyMode === 'plain' && parsed.apiKey) {
        const sanitizedRecord = {
          ...parsed,
          apiKeyMode: 'empty',
          apiKey: ''
        };

        await fs.writeFile(this.filePath, JSON.stringify(sanitizedRecord, null, 2));
      }

      const decrypted = this.decryptApiKey(parsed);

      return applyApiKeyStatus(normalizeSettings({
        ...parsed,
        apiKey: decrypted.apiKey
      }), decrypted.apiKeyStatus);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return applyApiKeyStatus(normalizeSettings({
          ...createDefaultSettings(),
          apiKey: this.sessionApiKey
        }), this.sessionApiKey
          ? createApiKeyStatus({
            storageMode: 'session',
            statusCode: 'session-only',
            message: 'The API key is available only for this running app session and must be entered again after restart. Support code: session-only.'
          })
          : createApiKeyStatus({ storageMode: 'empty' }));
      }

      throw error;
    }
  }

  async save(input) {
    const validation = validateSettings(input);
    const existingSettings = await this.load();
    let settings = validation.settings;

    if (!validation.isValid) {
      return {
        settings,
        validation
      };
    }

    try {
      settings = await this.prepareTemplateSettings(settings, existingSettings);
    } catch (error) {
      return {
        settings,
        validation: {
          isValid: false,
          errors: [
            'The selected Word template could not be copied into the application template folder.',
            error instanceof Error ? error.message : 'Unknown template storage error.'
          ],
          settings
        }
      };
    }

    let encrypted;
    let apiKeyStatus = createApiKeyStatus({
      storageMode: settings.apiKey ? 'persistent' : 'empty'
    });

    try {
      encrypted = this.encryptApiKey(settings.apiKey);
      this.sessionApiKey = '';
    } catch (error) {
      encrypted = {
        apiKeyMode: 'empty',
        apiKey: ''
      };
      this.sessionApiKey = settings.apiKey;
      apiKeyStatus = classifySecureStorageFailure({
        phase: 'save',
        error,
        secureStorageAvailable: this.hasSecureApiKeyStorage()
      });
    }

    const storedRecord = {
      providerId: settings.providerId,
      providerLabel: settings.providerLabel,
      baseUrl: settings.baseUrl,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
      referenceTemplateMode: settings.referenceTemplateMode,
      referenceTemplatePath: settings.referenceTemplatePath,
      referenceTemplateName: settings.referenceTemplateName,
      referenceTemplateExtension: settings.referenceTemplateExtension,
      outputTemplatePath: settings.outputTemplatePath,
      outputTemplateName: settings.outputTemplateName,
      outputTemplateExtension: settings.outputTemplateExtension,
      outputBriefingFolderPath: settings.outputBriefingFolderPath,
      apiKeyMode: encrypted.apiKeyMode,
      apiKey: encrypted.apiKey
    };

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(storedRecord, null, 2));

    const returnedSettings = applyApiKeyStatus(settings, apiKeyStatus);

    return {
      settings: returnedSettings,
      validation: {
        ...validation,
        settings: returnedSettings
      },
      apiKeyStatus
    };
  }
}

module.exports = {
  LlmSettingsStore,
  LOCAL_OLLAMA_MIN_MAX_TOKENS,
  createDefaultSettings,
  normalizeSettings,
  providerRequiresApiKey,
  validateSettings
};

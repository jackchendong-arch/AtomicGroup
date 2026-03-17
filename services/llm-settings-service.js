const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

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
    outputTemplatePath: '',
    outputTemplateName: '',
    outputTemplateExtension: ''
  };
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

  return {
    providerId: String(merged.providerId || defaults.providerId),
    providerLabel: String(merged.providerLabel || defaults.providerLabel),
    baseUrl: String(merged.baseUrl || defaults.baseUrl).trim(),
    model: String(merged.model || defaults.model).trim(),
    apiKey: String(merged.apiKey || '').trim(),
    temperature: normalizeNumericValue(merged.temperature, defaults.temperature),
    maxTokens: normalizeNumericValue(merged.maxTokens, defaults.maxTokens),
    systemPrompt: String(merged.systemPrompt || defaults.systemPrompt).trim(),
    outputTemplatePath: String(merged.outputTemplatePath || '').trim(),
    outputTemplateName: String(merged.outputTemplateName || '').trim(),
    outputTemplateExtension: String(merged.outputTemplateExtension || '').trim().toLowerCase()
  };
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

  if (!settings.apiKey) {
    errors.push('API key is required.');
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

  encryptApiKey(apiKey) {
    if (!apiKey) {
      return {
        apiKeyMode: 'empty',
        apiKey: ''
      };
    }

    if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
      return {
        apiKeyMode: 'encrypted',
        apiKey: this.safeStorage.encryptString(apiKey).toString('base64')
      };
    }

    return {
      apiKeyMode: 'plain',
      apiKey
    };
  }

  decryptApiKey(record = {}) {
    if (record.apiKeyMode === 'encrypted' && record.apiKey) {
      try {
        const decrypted = this.safeStorage.decryptString(Buffer.from(record.apiKey, 'base64'));
        return decrypted;
      } catch (_error) {
        return '';
      }
    }

    if (record.apiKeyMode === 'plain') {
      return record.apiKey || '';
    }

    return '';
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return normalizeSettings({
        ...parsed,
        apiKey: this.decryptApiKey(parsed)
      });
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return createDefaultSettings();
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

    const encrypted = this.encryptApiKey(settings.apiKey);
    const storedRecord = {
      providerId: settings.providerId,
      providerLabel: settings.providerLabel,
      baseUrl: settings.baseUrl,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
      outputTemplatePath: settings.outputTemplatePath,
      outputTemplateName: settings.outputTemplateName,
      outputTemplateExtension: settings.outputTemplateExtension,
      apiKeyMode: encrypted.apiKeyMode,
      apiKey: encrypted.apiKey
    };

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(storedRecord, null, 2));

    return {
      settings,
      validation
    };
  }
}

module.exports = {
  LlmSettingsStore,
  createDefaultSettings,
  normalizeSettings,
  validateSettings
};

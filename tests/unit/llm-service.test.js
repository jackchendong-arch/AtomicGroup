const test = require('node:test');
const assert = require('node:assert/strict');

const { createDefaultSettings } = require('../../services/llm-settings-service');
const { getProviderOptions, generateWithConfiguredProvider, listOllamaModels } = require('../../services/llm-service');

test('provider options include a local Ollama DeepSeek R1 preset', () => {
  const providers = getProviderOptions();
  const ollamaProvider = providers.find((provider) => provider.id === 'ollama_deepseek_r1');

  assert.ok(ollamaProvider);
  assert.equal(ollamaProvider.label, 'DeepSeek R1 (Ollama Local)');
  assert.equal(ollamaProvider.defaultBaseUrl, 'http://localhost:11434/v1');
  assert.equal(ollamaProvider.defaultModel, 'deepseek-r1:latest');
  assert.equal(ollamaProvider.defaultMaxTokens, 3200);
  assert.equal(ollamaProvider.requiresApiKey, false);
});

test('local Ollama DeepSeek R1 requests target /v1/chat/completions without requiring Authorization', async () => {
  let observedUrl = '';
  let observedOptions = null;

  const result = await generateWithConfiguredProvider({
    settings: {
      ...createDefaultSettings(),
      providerId: 'ollama_deepseek_r1',
      providerLabel: 'DeepSeek R1 (Ollama Local)',
      baseUrl: 'http://localhost:11434',
      model: 'deepseek-r1:latest',
      apiKey: ''
    },
    messages: [{ role: 'user', content: 'Hello' }],
    fetchImpl: async (url, options) => {
      observedUrl = url;
      observedOptions = options;

      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: 'ok'
                }
              }
            ]
          };
        }
      };
    }
  });

  assert.equal(result.text, 'ok');
  assert.equal(observedUrl, 'http://localhost:11434/v1/chat/completions');
  assert.equal(observedOptions.headers.Authorization, undefined);
});

test('local Ollama model discovery targets /api/tags and returns installed model names', async () => {
  let observedUrl = '';

  const result = await listOllamaModels({
    baseUrl: 'http://localhost:11434/v1',
    fetchImpl: async (url) => {
      observedUrl = url;

      return {
        ok: true,
        async json() {
          return {
            models: [
              { name: 'deepseek-r1:1.5b' },
              { name: 'qwen2.5:latest' }
            ]
          };
        }
      };
    }
  });

  assert.equal(observedUrl, 'http://localhost:11434/api/tags');
  assert.deepEqual(result.models, ['deepseek-r1:1.5b', 'qwen2.5:latest']);
});

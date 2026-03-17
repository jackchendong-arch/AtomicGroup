const { normalizeSettings, validateSettings } = require('./llm-settings-service');

const REQUEST_TIMEOUT_MS = 60_000;

const PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    helpText: 'DeepSeek uses an OpenAI-compatible chat completions API.'
  },
  openai_compatible: {
    id: 'openai_compatible',
    label: 'OpenAI-Compatible',
    type: 'openai-compatible',
    defaultBaseUrl: '',
    defaultModel: '',
    helpText: 'Use this for any vendor exposing an OpenAI-compatible /chat/completions endpoint.'
  }
};

function getProviderOptions() {
  return Object.values(PROVIDERS);
}

function buildOpenAiCompatibleChatUrl(baseUrl) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');

  if (normalizedBaseUrl.endsWith('/chat/completions')) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

function formatFetchFailure(requestUrl, error) {
  const details = [];
  const cause = error?.cause;

  if (cause?.code) {
    details.push(`code ${cause.code}`);
  }

  if (cause?.errno && cause?.errno !== cause?.code) {
    details.push(`errno ${cause.errno}`);
  }

  if (cause?.address) {
    details.push(`address ${cause.address}`);
  }

  if (cause?.port) {
    details.push(`port ${cause.port}`);
  }

  if (cause?.message) {
    details.push(cause.message);
  } else if (error?.message) {
    details.push(error.message);
  }

  return `Unable to reach the configured LLM endpoint (${requestUrl}). ${details.join(' ')}`.trim();
}

function extractMessageContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

async function requestOpenAiCompatibleChat({ settings, messages, fetchImpl = fetch }) {
  const requestUrl = buildOpenAiCompatibleChatUrl(settings.baseUrl);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetchImpl(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: false,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens
      }),
      signal: abortController.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`The LLM request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds (${requestUrl}).`);
    }

    throw new Error(formatFetchFailure(requestUrl, error));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed (${response.status}) at ${requestUrl}: ${errorText}`);
  }

  const payload = await response.json();
  const content = extractMessageContent(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('The LLM returned an empty response.');
  }

  return {
    text: content,
    raw: payload
  };
}

async function generateWithConfiguredProvider({ settings: inputSettings, messages, fetchImpl = fetch }) {
  const validation = validateSettings(inputSettings);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const settings = normalizeSettings(validation.settings);

  if (PROVIDERS[settings.providerId]?.type === 'openai-compatible') {
    return requestOpenAiCompatibleChat({ settings, messages, fetchImpl });
  }

  throw new Error(`Unsupported provider: ${settings.providerId}`);
}

module.exports = {
  PROVIDERS,
  getProviderOptions,
  generateWithConfiguredProvider
};

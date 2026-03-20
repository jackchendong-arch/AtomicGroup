const DEFAULT_OUTPUT_LANGUAGE = 'en';

function normalizeOutputLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'cn' || normalized === 'chinese') {
    return 'zh';
  }

  return DEFAULT_OUTPUT_LANGUAGE;
}

function isChineseOutputLanguage(value) {
  return normalizeOutputLanguage(value) === 'zh';
}

function getOutputLanguageLabel(value) {
  return isChineseOutputLanguage(value) ? 'Chinese' : 'English';
}

module.exports = {
  DEFAULT_OUTPUT_LANGUAGE,
  getOutputLanguageLabel,
  isChineseOutputLanguage,
  normalizeOutputLanguage
};

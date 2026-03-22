const { normalizeOutputLanguage } = require('./output-language-service');

function normalizeLine(value) {
  return String(value || '').trim();
}

function collectBriefingNarrativeSegments(briefing = {}) {
  const segments = [];
  const push = (value) => {
    const normalized = normalizeLine(value);

    if (normalized) {
      segments.push(normalized);
    }
  };

  push(briefing.fit_summary);
  push(briefing.recommended_next_step);

  (Array.isArray(briefing.relevant_experience) ? briefing.relevant_experience : []).forEach(push);
  (Array.isArray(briefing.potential_concerns) ? briefing.potential_concerns : []).forEach(push);

  (Array.isArray(briefing.match_requirements) ? briefing.match_requirements : []).forEach((entry) => {
    push(entry?.requirement);
    push(entry?.evidence);
  });

  (Array.isArray(briefing.employment_history) ? briefing.employment_history : []).forEach((entry) => {
    push(entry?.job_title);
    (Array.isArray(entry?.responsibilities) ? entry.responsibilities : []).forEach(push);
  });

  return segments;
}

function countLatinWords(value) {
  return (String(value || '').match(/[A-Za-z]{3,}/g) || []).length;
}

function hasChineseCharacters(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ''));
}

function isLikelyEnglishNarrative(value) {
  const text = normalizeLine(value);

  if (!text || hasChineseCharacters(text)) {
    return false;
  }

  return countLatinWords(text) >= 4;
}

function isLikelyChineseNarrative(value) {
  const text = normalizeLine(value);

  if (!text) {
    return false;
  }

  return hasChineseCharacters(text);
}

function briefingNeedsLanguageNormalization(briefing, targetLanguage = 'en') {
  const normalizedTargetLanguage = normalizeOutputLanguage(targetLanguage);
  const segments = collectBriefingNarrativeSegments(briefing);

  if (segments.length === 0) {
    return false;
  }

  let targetCount = 0;
  let oppositeCount = 0;

  segments.forEach((segment) => {
    if (normalizedTargetLanguage === 'zh') {
      if (isLikelyChineseNarrative(segment)) {
        targetCount += 1;
      } else if (isLikelyEnglishNarrative(segment)) {
        oppositeCount += 1;
      }

      return;
    }

    if (isLikelyEnglishNarrative(segment)) {
      targetCount += 1;
    } else if (isLikelyChineseNarrative(segment)) {
      oppositeCount += 1;
    }
  });

  return oppositeCount >= 2 && oppositeCount > targetCount;
}

module.exports = {
  briefingNeedsLanguageNormalization,
  collectBriefingNarrativeSegments
};

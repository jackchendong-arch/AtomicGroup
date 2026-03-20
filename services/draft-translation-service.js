const {
  normalizeBriefing
} = require('./briefing-service');
const {
  normalizeGeneratedSummary
} = require('./summary-service');
const {
  isChineseOutputLanguage,
  normalizeOutputLanguage
} = require('./output-language-service');

function getLanguageDescriptor(value) {
  return isChineseOutputLanguage(value) ? 'Simplified Chinese' : 'English';
}

function extractJsonPayload(responseText) {
  const source = String(responseText || '').trim();
  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1);
  }

  return source;
}

function createTranslatableDraftPayload({ summary, briefing }) {
  const normalizedBriefing = normalizeBriefing(briefing);

  return {
    summary: normalizeGeneratedSummary(summary || ''),
    candidate: {
      name: normalizedBriefing.candidate.name,
      gender: normalizedBriefing.candidate.gender,
      nationality: normalizedBriefing.candidate.nationality,
      location: normalizedBriefing.candidate.location,
      preferred_location: normalizedBriefing.candidate.preferred_location,
      languages: normalizedBriefing.candidate.languages,
      notice_period: normalizedBriefing.candidate.notice_period,
      education: normalizedBriefing.candidate.education
    },
    role: {
      title: normalizedBriefing.role.title,
      company: normalizedBriefing.role.company,
      hiring_manager: normalizedBriefing.role.hiring_manager
    },
    fit_summary: normalizedBriefing.fit_summary,
    relevant_experience: normalizedBriefing.relevant_experience,
    match_requirements: normalizedBriefing.match_requirements.map((entry) => ({
      requirement: entry.requirement,
      evidence: entry.evidence
    })),
    potential_concerns: normalizedBriefing.potential_concerns,
    recommended_next_step: normalizedBriefing.recommended_next_step,
    employment_history: normalizedBriefing.employment_history.map((entry) => ({
      job_title: entry.job_title,
      company_name: entry.company_name,
      start_date: entry.start_date,
      end_date: entry.end_date,
      responsibilities: entry.responsibilities
    }))
  };
}

function applyTranslatedDraftPayload({ briefing, translatedPayload }) {
  const base = normalizeBriefing(briefing);
  const translated = createTranslatableDraftPayload({
    summary: translatedPayload.summary,
    briefing: translatedPayload
  });

  const matchRequirements = translated.match_requirements.length > 0
    ? translated.match_requirements.map((entry, index) => ({
      requirement: entry.requirement || base.match_requirements[index]?.requirement || '',
      evidence: entry.evidence || base.match_requirements[index]?.evidence || '',
      evidence_refs: base.match_requirements[index]?.evidence_refs || []
    }))
    : base.match_requirements;

  const employmentHistory = base.employment_history.map((entry, index) => {
    const translatedEntry = translated.employment_history[index];

    if (!translatedEntry) {
      return entry;
    }

    return {
      ...entry,
      job_title: translatedEntry.job_title || entry.job_title,
      company_name: translatedEntry.company_name || entry.company_name,
      start_date: translatedEntry.start_date || entry.start_date,
      end_date: translatedEntry.end_date || entry.end_date,
      responsibilities: translatedEntry.responsibilities.length > 0
        ? translatedEntry.responsibilities
        : entry.responsibilities,
      evidence_refs: entry.evidence_refs || []
    };
  });

  return {
    summary: translated.summary,
    briefing: normalizeBriefing({
      ...base,
      candidate: {
        ...base.candidate,
        ...translated.candidate
      },
      role: {
        ...base.role,
        ...translated.role
      },
      fit_summary: translated.fit_summary || base.fit_summary,
      relevant_experience: translated.relevant_experience.length > 0
        ? translated.relevant_experience
        : base.relevant_experience,
      match_requirements: matchRequirements,
      potential_concerns: translated.potential_concerns.length > 0
        ? translated.potential_concerns
        : base.potential_concerns,
      recommended_next_step: translated.recommended_next_step || base.recommended_next_step,
      employment_history: employmentHistory
    })
  };
}

function parseTranslatedDraftResponse(responseText, originalBriefing) {
  const jsonPayload = extractJsonPayload(responseText);

  if (!jsonPayload) {
    throw new Error('The LLM did not return a translated draft payload.');
  }

  let parsed;

  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(`The translated draft payload was not valid JSON. ${error.message}`);
  }

  return applyTranslatedDraftPayload({
    briefing: originalBriefing,
    translatedPayload: parsed
  });
}

function buildDraftTranslationRequest({
  summary,
  briefing,
  outputMode = 'named',
  sourceLanguage = 'en',
  targetLanguage = 'en'
}) {
  const normalizedSourceLanguage = normalizeOutputLanguage(sourceLanguage);
  const normalizedTargetLanguage = normalizeOutputLanguage(targetLanguage);
  const translatablePayload = createTranslatableDraftPayload({ summary, briefing });
  const sourceDescriptor = getLanguageDescriptor(normalizedSourceLanguage);
  const targetDescriptor = getLanguageDescriptor(normalizedTargetLanguage);

  const prompt = [
    `Translate the current recruiter summary and hiring-manager briefing content from ${sourceDescriptor} to ${targetDescriptor}.`,
    'This is a translation task only.',
    'Do not add new claims, remove information, summarize, expand, reinterpret, or change the assessment.',
    'Preserve the current section order, bullet structure, and level of detail.',
    'Keep names, company names, school names, product names, emails, phone numbers, URLs, dates, numbers, and other exact factual identifiers exactly as written unless simple localization of a common language/country term is required for readability.',
    'Translate narrative prose, headings, labels, bullets, and human-readable evidence phrasing into the target language while keeping the same meaning.',
    'Return only valid JSON with this exact shape:',
    JSON.stringify(translatablePayload, null, 2),
    ...(outputMode === 'anonymous'
      ? [
        'Keep the draft anonymous in the translated output.',
        isChineseOutputLanguage(normalizedTargetLanguage)
          ? '在叙述性句子中，使用自然表达，如“该候选人”或“候选人”，不要使用生硬重复的匿名名称。'
          : 'In narrative sentences, use natural phrasing such as "the candidate" or "this candidate" rather than awkward repetition of an anonymous label.'
      ]
      : []),
    '',
    'Current translatable draft payload:',
    JSON.stringify(translatablePayload, null, 2)
  ].join('\n');

  return {
    prompt,
    payload: translatablePayload,
    messages: [
      {
        role: 'system',
        content: 'You are a precise business translation engine for recruiter and hiring-manager documents. Return only valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
}

function buildDraftTranslationRepairRequest({ malformedResponse, expectedPayload }) {
  const prompt = [
    'Repair the following malformed JSON translation output.',
    'Do not change wording, meaning, or structure beyond what is required to make it valid JSON.',
    'Return only valid JSON.',
    'Expected JSON shape:',
    JSON.stringify(expectedPayload, null, 2),
    '',
    'Malformed JSON response:',
    String(malformedResponse || '')
  ].join('\n');

  return {
    prompt,
    messages: [
      {
        role: 'system',
        content: 'You repair malformed JSON. Return only valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
}

module.exports = {
  applyTranslatedDraftPayload,
  buildDraftTranslationRepairRequest,
  buildDraftTranslationRequest,
  createTranslatableDraftPayload,
  parseTranslatedDraftResponse
};

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

function extractPlainTextPayload(responseText) {
  const source = String(responseText || '').trim();
  const fencedMatch = source.match(/```(?:text|markdown)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return source;
}

function createTranslatableDraftPayload({ summary, briefing, includeSummary = true }) {
  const normalizedBriefing = normalizeBriefing(briefing);

  const payload = {
    candidate: {
      gender: normalizedBriefing.candidate.gender,
      nationality: normalizedBriefing.candidate.nationality,
      location: normalizedBriefing.candidate.location,
      preferred_location: normalizedBriefing.candidate.preferred_location,
      languages: normalizedBriefing.candidate.languages,
      notice_period: normalizedBriefing.candidate.notice_period,
      education: normalizedBriefing.candidate.education
    },
    role: {
      title: normalizedBriefing.role.title
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
      responsibilities: entry.responsibilities
    }))
  };

  if (includeSummary) {
    payload.summary = normalizeGeneratedSummary(summary || '');
  }

  return payload;
}

function mergeTranslatedBriefing(baseBriefing, translatedBriefing) {
  const base = normalizeBriefing(baseBriefing);
  const translated = normalizeBriefing(translatedBriefing);

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

  return normalizeBriefing({
    ...base,
    candidate: {
      ...base.candidate,
      gender: translated.candidate.gender || base.candidate.gender,
      nationality: translated.candidate.nationality || base.candidate.nationality,
      location: translated.candidate.location || base.candidate.location,
      preferred_location: translated.candidate.preferred_location || base.candidate.preferred_location,
      languages: translated.candidate.languages.length > 0 ? translated.candidate.languages : base.candidate.languages,
      notice_period: translated.candidate.notice_period || base.candidate.notice_period,
      education: translated.candidate.education.length > 0 ? translated.candidate.education : base.candidate.education
    },
    role: {
      ...base.role,
      title: translated.role.title || base.role.title
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
  });
}

function mergeTranslatedEmploymentHistorySlice({ briefing, translatedBriefing, startIndex = 0 }) {
  const base = normalizeBriefing(briefing);
  const translated = normalizeBriefing(translatedBriefing);
  const nextEmploymentHistory = [...base.employment_history];

  translated.employment_history.forEach((translatedEntry, translatedIndex) => {
    const baseIndex = startIndex + translatedIndex;
    const existingEntry = nextEmploymentHistory[baseIndex];

    if (!existingEntry) {
      return;
    }

    nextEmploymentHistory[baseIndex] = {
      ...existingEntry,
      job_title: translatedEntry.job_title || existingEntry.job_title,
      company_name: translatedEntry.company_name || existingEntry.company_name,
      start_date: translatedEntry.start_date || existingEntry.start_date,
      end_date: translatedEntry.end_date || existingEntry.end_date,
      responsibilities: translatedEntry.responsibilities.length > 0
        ? translatedEntry.responsibilities
        : existingEntry.responsibilities,
      evidence_refs: existingEntry.evidence_refs || []
    };
  });

  return normalizeBriefing({
    ...base,
    employment_history: nextEmploymentHistory
  });
}

function applyTranslatedDraftPayload({ briefing, translatedPayload }) {
  const translatedBriefing = mergeTranslatedBriefing(
    briefing,
    createTranslatableDraftPayload({
      summary: translatedPayload.summary,
      briefing: translatedPayload
    })
  );

  return {
    summary: translatedPayload.summary || '',
    briefing: translatedBriefing
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

function parseTranslatedSummaryResponse(responseText) {
  const translatedText = normalizeGeneratedSummary(extractPlainTextPayload(responseText));

  if (!translatedText) {
    throw new Error('The LLM did not return translated summary text.');
  }

  return translatedText;
}

function buildDraftTranslationRequest({
  summary,
  briefing,
  outputMode = 'named',
  sourceLanguage = 'en',
  targetLanguage = 'en',
  includeSummary = true
}) {
  const normalizedSourceLanguage = normalizeOutputLanguage(sourceLanguage);
  const normalizedTargetLanguage = normalizeOutputLanguage(targetLanguage);
  const translatablePayload = createTranslatableDraftPayload({ summary, briefing, includeSummary });
  const sourceDescriptor = getLanguageDescriptor(normalizedSourceLanguage);
  const targetDescriptor = getLanguageDescriptor(normalizedTargetLanguage);

  const prompt = [
    `Translate the current ${includeSummary ? 'recruiter summary and hiring-manager briefing' : 'hiring-manager briefing'} content from ${sourceDescriptor} to ${targetDescriptor}.`,
    'This is a translation task only.',
    'Do not add new claims, remove information, summarize, expand, reinterpret, or change the assessment.',
    'Preserve the current section order, bullet structure, and level of detail.',
    'Keep names, company names, school names, product names, emails, phone numbers, URLs, dates, numbers, and other exact factual identifiers exactly as written unless simple localization of a common language/country term is required for readability.',
    'Translate narrative prose, headings, labels, bullets, and human-readable derived display fields into the target language while keeping the same meaning.',
    `Translate all narrative or human-readable derived content inside these fields: ${includeSummary ? '`summary`, ' : ''}\`candidate.gender\`, \`candidate.nationality\`, \`candidate.location\`, \`candidate.preferred_location\`, \`candidate.languages\`, \`candidate.notice_period\`, \`candidate.education[].degree_name\`, \`candidate.education[].degreeName\`, \`role.title\`, \`fit_summary\`, \`relevant_experience\`, \`match_requirements[].requirement\`, \`match_requirements[].evidence\`, \`potential_concerns\`, \`recommended_next_step\`, \`employment_history[].job_title\`, and \`employment_history[].responsibilities\`.`,
    'Do not leave whole source-language sentences untranslated inside those fields when the target language is different.',
    'Do not modify or invent stable factual identifiers that are not present in the payload, such as candidate names, company names, dates, URLs, phone numbers, or evidence reference metadata.',
    'For `employment_history`, keep company names, dates, and technical identifiers such as Go, Solana, RESTful API, SDK, or product names as-is when appropriate, but translate the surrounding role titles, role descriptions, and responsibility sentences.',
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

function buildSummaryTranslationRequest({
  summary,
  sourceLanguage = 'en',
  targetLanguage = 'en'
}) {
  const normalizedSourceLanguage = normalizeOutputLanguage(sourceLanguage);
  const normalizedTargetLanguage = normalizeOutputLanguage(targetLanguage);
  const sourceDescriptor = getLanguageDescriptor(normalizedSourceLanguage);
  const targetDescriptor = getLanguageDescriptor(normalizedTargetLanguage);
  const normalizedSummary = normalizeGeneratedSummary(summary || '');

  const prompt = [
    `Translate the following recruiter summary from ${sourceDescriptor} to ${targetDescriptor}.`,
    'This is a translation task only.',
    'Do not add new claims, remove information, summarize, expand, reinterpret, or change the assessment.',
    'Preserve section order, headings, bullets, labels, and level of detail.',
    'Keep names, company names, school names, product names, emails, phone numbers, URLs, dates, numbers, and other exact factual identifiers exactly as written unless simple localization of a common language/country term is required for readability.',
    'Return only the translated summary text. Do not return JSON. Do not wrap the answer in code fences.',
    '',
    normalizedSummary
  ].join('\n');

  return {
    prompt,
    sourceSummary: normalizedSummary,
    messages: [
      {
        role: 'system',
        content: 'You are a precise business translation engine for recruiter summaries. Return only the translated summary text.'
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
  buildSummaryTranslationRequest,
  createTranslatableDraftPayload,
  mergeTranslatedBriefing,
  mergeTranslatedEmploymentHistorySlice,
  parseTranslatedDraftResponse,
  parseTranslatedSummaryResponse
};

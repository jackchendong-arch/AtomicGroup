const { normalizeBriefing } = require('./briefing-service');
const { parseStructuredSummary } = require('./hiring-manager-template-service');

const FILE_EXTENSION_PATTERN = /\.(pdf|docx|txt)$/i;

const GENERIC_CANDIDATE_LABELS = new Set([
  'candidate',
  'candidate cv',
  'candidate profile',
  'candidate resume',
  'cv',
  'profile',
  'resume'
]);

const GENERIC_ROLE_LABELS = new Set([
  'about the job',
  'information',
  'job',
  'job description',
  'job summary',
  'overview',
  'position',
  'role',
  '岗位信息',
  '岗位描述',
  '职位',
  '职位信息',
  '职位描述',
  '信息'
]);

const OVERCONFIDENT_PATTERNS = [
  /\b100%\s+(?:fit|match)\b/i,
  /\b(?:definitely|guarantee(?:d|s)?|ideal candidate|perfect (?:candidate|fit|match)|undoubtedly|without question)\b/i,
  /\b(?:fully meets all requirements|meets every requirement|no gaps?)\b/i,
  /(?:百分之百匹配|保证匹配|毫无疑问|完全匹配|没有任何差距)/
];
const REPORT_QUALITY_WARNING_PREFIX = 'Word report review required: ';

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values) {
  const seen = new Set();

  return values.filter((value) => {
    const normalized = cleanLine(value);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function normalizeRetrievalManifest(entries) {
  return Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry === 'object')
    : [];
}

function looksLikeGenericCandidateLabel(value) {
  const normalized = cleanLine(value).toLowerCase();

  return Boolean(
    normalized &&
    (FILE_EXTENSION_PATTERN.test(normalized) || GENERIC_CANDIDATE_LABELS.has(normalized))
  );
}

function looksLikeGenericRoleLabel(value) {
  const normalized = cleanLine(value).toLowerCase();

  return Boolean(
    normalized &&
    (FILE_EXTENSION_PATTERN.test(normalized) || GENERIC_ROLE_LABELS.has(normalized))
  );
}

function hasStrongClaimLanguage(text) {
  const normalized = cleanLine(text);

  if (!normalized) {
    return false;
  }

  return OVERCONFIDENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasMatchEvidence(matchRequirement) {
  return Boolean(
    cleanLine(matchRequirement?.evidence) ||
    (Array.isArray(matchRequirement?.evidence_refs) && matchRequirement.evidence_refs.length > 0)
  );
}

function buildDraftReviewWarnings({
  recruiterSummary = '',
  briefing = null,
  outputMode = 'named',
  existingWarnings = [],
  reportQualityBlockers = [],
  summaryRetrievalManifest = [],
  briefingRetrievalManifest = []
} = {}) {
  const warnings = [];
  const sections = parseStructuredSummary(recruiterSummary || '');
  const normalizedBriefing = normalizeBriefing(briefing || {});
  const summaryEvidence = normalizeRetrievalManifest(summaryRetrievalManifest);
  const briefingEvidence = normalizeRetrievalManifest(briefingRetrievalManifest);
  const combinedNarrative = [
    recruiterSummary,
    normalizedBriefing.fit_summary,
    ...(normalizedBriefing.relevant_experience || []),
    ...(normalizedBriefing.potential_concerns || []),
    normalizedBriefing.recommended_next_step
  ].join('\n');

  if (!cleanLine(sections.fit_summary)) {
    warnings.push('Recruiter summary is missing the fit summary section.');
  }

  if (!cleanLine(sections.relevant_experience)) {
    warnings.push('Recruiter summary is missing the relevant experience section.');
  }

  if (!cleanLine(sections.match_requirements)) {
    warnings.push('Recruiter summary is missing the match against key requirements section.');
  }

  if (!cleanLine(sections.recommended_next_step)) {
    warnings.push('Recruiter summary is missing the recommended next step section.');
  }

  if (!normalizedBriefing.employment_history.length) {
    warnings.push('Hiring-manager briefing is missing employment history details.');
  }

  if (!normalizedBriefing.match_requirements.length) {
    warnings.push('Hiring-manager briefing is missing requirement-to-evidence matches.');
  } else {
    const supportedMatches = normalizedBriefing.match_requirements.filter(hasMatchEvidence).length;

    if (supportedMatches < Math.ceil(normalizedBriefing.match_requirements.length / 2)) {
      warnings.push('Several requirement matches do not include clear supporting evidence. Recheck the draft before approval.');
    }
  }

  if (outputMode !== 'anonymous' && looksLikeGenericCandidateLabel(normalizedBriefing.candidate.name)) {
    warnings.push('Candidate name looks generic or file-derived. Recheck the loaded CV before sharing.');
  }

  if (looksLikeGenericRoleLabel(normalizedBriefing.role.title)) {
    warnings.push('Role title looks generic or source-derived. Recheck the loaded JD before sharing.');
  }

  if (hasStrongClaimLanguage(combinedNarrative)) {
    warnings.push('The draft uses strong certainty language. Verify that the evidence supports those claims before approval.');
  }

  if (summaryEvidence.length === 0 || briefingEvidence.length === 0) {
    warnings.push('Source evidence is incomplete for this draft. Verify key claims manually before approval.');
  }

  if (Array.isArray(reportQualityBlockers) && reportQualityBlockers.length > 0) {
    reportQualityBlockers.forEach((blocker) => {
      const normalizedBlocker = cleanLine(blocker);

      if (normalizedBlocker) {
        warnings.push(`${REPORT_QUALITY_WARNING_PREFIX}${normalizedBlocker}`);
      }
    });
  }

  return uniqueStrings([
    ...(Array.isArray(existingWarnings) ? existingWarnings.map((warning) => cleanLine(warning)) : []),
    ...warnings
  ]);
}

module.exports = {
  REPORT_QUALITY_WARNING_PREFIX,
  buildDraftReviewWarnings
};

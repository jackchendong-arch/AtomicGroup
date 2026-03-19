const {
  extractDocumentDerivedProfile
} = require('./hiring-manager-template-service');

const ANONYMOUS_CANDIDATE_LABEL = 'Anonymous Candidate';
const GENERIC_FILE_NAME_TOKENS = new Set([
  'candidate',
  'candidates',
  'cv',
  'resume',
  'resumes',
  'profile',
  'profiles',
  'final',
  'updated',
  'latest',
  'version',
  'v1',
  'v2',
  'v3',
  'draft'
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LINKEDIN_PATTERN = /\b(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/[^\s)]+/gi;
const PHONE_PATTERNS = [
  /\+\d[\d()\s.-]{6,}\d/g,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{2,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b/g
];
const LABELED_ADDRESS_PATTERN = /\b(?:address|home address|current address)\s*[:：][^\n]+/gi;
const STREET_ADDRESS_PATTERN = /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy)\b/gi;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanNameVariant(value) {
  return String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeFilenameForNameVariants(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .split(/[^A-Za-z]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !GENERIC_FILE_NAME_TOKENS.has(token.toLowerCase()));
}

function buildCandidateNamePatterns(candidateName, fileName = '') {
  const variants = new Set();
  const cleaned = cleanNameVariant(candidateName);
  const nameParts = cleaned.split(/\s+/).filter(Boolean);
  const fileTokens = tokenizeFilenameForNameVariants(fileName);

  if (cleaned && cleaned.toLowerCase() !== 'candidate') {
    variants.add(cleaned);
    variants.add(String(candidateName || '').trim());
  }

  if (nameParts.length >= 2) {
    if (nameParts[0].length >= 4) {
      variants.add(nameParts[0]);
    }

    if (nameParts[nameParts.length - 1].length >= 4) {
      variants.add(nameParts[nameParts.length - 1]);
    }
  }

  if (fileTokens.length >= 2) {
    variants.add(fileTokens.join(' '));
  }

  fileTokens.forEach((token) => {
    variants.add(token);
  });

  return [...variants]
    .filter(Boolean)
    .map((variant) => new RegExp(`\\b${variant.split(/\s+/).map(escapeRegExp).join('\\s+')}\\b`, 'gi'));
}

function buildAnonymizationContext({ cvDocument, jdDocument }) {
  const profile = extractDocumentDerivedProfile({ cvDocument, jdDocument });
  const candidateNamePatterns = buildCandidateNamePatterns(profile.candidateName, cvDocument?.file?.name);

  return {
    profile,
    candidateNamePatterns
  };
}

function normalizePhoneMatch(match) {
  const digits = String(match || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function hasRegexMatch(pattern, text) {
  pattern.lastIndex = 0;
  const result = pattern.test(String(text || ''));
  pattern.lastIndex = 0;
  return result;
}

function looksLikeStreetAddress(value) {
  const text = String(value || '').trim();

  if (!text) {
    return false;
  }

  return hasRegexMatch(LABELED_ADDRESS_PATTERN, text) || hasRegexMatch(STREET_ADDRESS_PATTERN, text);
}

function replacePhoneLikeContent(text) {
  let next = String(text || '');

  for (const pattern of PHONE_PATTERNS) {
    next = next.replace(pattern, (match) => (normalizePhoneMatch(match) ? '[phone redacted]' : match));
  }

  return next;
}

function anonymizeText(text, candidateNamePatterns) {
  let next = String(text || '');

  for (const pattern of candidateNamePatterns) {
    next = next.replace(pattern, ANONYMOUS_CANDIDATE_LABEL);
  }

  next = next
    .replace(EMAIL_PATTERN, '[email redacted]')
    .replace(LINKEDIN_PATTERN, '[LinkedIn redacted]')
    .replace(LABELED_ADDRESS_PATTERN, (match) => {
      const label = match.split(/[:：]/)[0];
      return `${label}: [address redacted]`;
    })
    .replace(STREET_ADDRESS_PATTERN, '[address redacted]');

  return replacePhoneLikeContent(next);
}

function buildAnonymizedSourceDocument(document, candidateNamePatterns, fallbackName) {
  const originalName = String(document?.file?.name || '');
  const extensionMatch = originalName.match(/(\.[^.]+)$/);
  const safeName = `${fallbackName}${extensionMatch?.[1] || ''}`;

  return {
    ...document,
    text: anonymizeText(document?.text || '', candidateNamePatterns),
    file: {
      ...(document?.file || {}),
      name: safeName
    }
  };
}

function anonymizeValue(value, candidateNamePatterns, path = '') {
  if (typeof value === 'string') {
    if (path === 'candidate.name') {
      return ANONYMOUS_CANDIDATE_LABEL;
    }

    if (path === 'candidate.location' || path === 'candidate.preferred_location') {
      return looksLikeStreetAddress(value) ? '[address redacted]' : anonymizeText(value, candidateNamePatterns);
    }

    return anonymizeText(value, candidateNamePatterns);
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => anonymizeValue(entry, candidateNamePatterns, `${path}[${index}]`));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        const nextPath = path ? `${path}.${key}` : key;
        return [key, anonymizeValue(entry, candidateNamePatterns, nextPath)];
      })
    );
  }

  return value;
}

function collectStrings(value, bucket = []) {
  if (typeof value === 'string') {
    bucket.push(value);
    return bucket;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, bucket));
    return bucket;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStrings(entry, bucket));
  }

  return bucket;
}

function findResidualWarnings({ summary, briefing, candidateNamePatterns }) {
  const warnings = [];
  const combinedText = [summary, ...collectStrings(briefing)].join('\n');
  const hasUnredactedAddressLabel = combinedText
    .split('\n')
    .map((line) => line.trim())
    .some((line) => /^(?:address|home address|current address)\s*[:：]/i.test(line) && !/\[address redacted\]/i.test(line));

  if (candidateNamePatterns.some((pattern) => hasRegexMatch(pattern, combinedText))) {
    warnings.push('Candidate name may still appear in the anonymized draft.');
  }

  if (hasRegexMatch(EMAIL_PATTERN, combinedText)) {
    warnings.push('Email address content may still appear in the anonymized draft.');
  }

  if (hasRegexMatch(LINKEDIN_PATTERN, combinedText)) {
    warnings.push('LinkedIn content may still appear in the anonymized draft.');
  }

  if (PHONE_PATTERNS.some((pattern) => hasRegexMatch(pattern, combinedText))) {
    warnings.push('Phone number content may still appear in the anonymized draft.');
  }

  if (hasUnredactedAddressLabel || hasRegexMatch(STREET_ADDRESS_PATTERN, combinedText)) {
    warnings.push('Address-like content may still appear in the anonymized draft.');
  }

  return warnings;
}

function anonymizeDraftOutput({ recruiterSummary, briefing, cvDocument, jdDocument }) {
  const { candidateNamePatterns } = buildAnonymizationContext({ cvDocument, jdDocument });
  const anonymizedSummary = anonymizeText(recruiterSummary, candidateNamePatterns);
  const anonymizedBriefing = anonymizeValue(
    JSON.parse(JSON.stringify(briefing || {})),
    candidateNamePatterns
  );
  const warnings = findResidualWarnings({
    summary: anonymizedSummary,
    briefing: anonymizedBriefing,
    candidateNamePatterns
  });

  return {
    summary: anonymizedSummary,
    briefing: anonymizedBriefing,
    warnings,
    modeLabel: 'Anonymous Draft'
  };
}

function buildAnonymizedGenerationInputs({ cvDocument, jdDocument }) {
  const { candidateNamePatterns } = buildAnonymizationContext({ cvDocument, jdDocument });

  return {
    cvDocument: buildAnonymizedSourceDocument(cvDocument, candidateNamePatterns, 'anonymous-candidate'),
    jdDocument: buildAnonymizedSourceDocument(jdDocument, candidateNamePatterns, 'job-description')
  };
}

module.exports = {
  ANONYMOUS_CANDIDATE_LABEL,
  buildAnonymizedGenerationInputs,
  anonymizeDraftOutput
};

const path = require('node:path');

const { extractCandidateName, extractRequirements, extractRoleTitle } = require('./summary-service');
const {
  extractEducationEntries,
  extractDocumentDerivedProfile,
  extractExperienceHistory,
  extractProjectExperiences
} = require('./hiring-manager-template-service');
const { buildWorkspaceSourceModel } = require('./workspace-source-service');

const GENERIC_CANDIDATE_LABELS = new Set([
  'candidate',
  'candidate cv',
  'candidate profile',
  'candidate resume',
  'cv',
  'profile',
  'resume',
  'summary',
  'technical skills',
  'work experience',
  'experience',
  'projects',
  'skills',
  'technical skills'
]);

const GENERIC_ROLE_LABELS = new Set([
  'about the job',
  'information',
  'job',
  'job description',
  'job summary',
  'overview',
  'position',
  'requirements',
  'responsibilities',
  'role'
]);

const GENERIC_SECTION_LABELS = new Set([
  'candidate cv',
  'candidate summary',
  'confidential candidate report',
  'education',
  'email',
  'employment experience',
  'end of report',
  'experience',
  'job description',
  'key projects',
  'languages',
  'motivation',
  'overview',
  'professional experience',
  'projects',
  'requirements',
  'responsibilities',
  'skills',
  'summary',
  'technical skills',
  'work experience'
]);

const COMPANY_HINT_PATTERN =
  /\b(bank|blockchain|capital|college|company|corp|corporation|finance|financial|group|holdings|inc|institute|limited|ltd|llc|recruitment|school|search|staffing|technologies|technology|university)\b|(?:公司|科技|信息|银行|集团|大学|学院)/i;
const ROLE_HINT_PATTERN =
  /\b(analyst|architect|consultant|coordinator|designer|developer|director|engineer|head|lead|manager|officer|owner|partner|president|principal|product|program|project|recruiter|researcher|scientist|specialist|vice president|vp)\b|(?:工程师|开发|架构师|经理|总监|负责人|顾问|分析师|研究员|产品经理|技术负责人)/i;
const EDUCATION_HINT_PATTERN =
  /\b(bachelor|b\.?a\.?|b\.?eng|b\.?s\.?c?|b\.?s|college|degree|diploma|doctor|institute|master|m\.?a\.?|m\.?eng|m\.?s\.?c?|m\.?s|mba|phd|school|university)\b|(?:本科|硕士|博士|学士|大学|学院|学校)/i;
const EDUCATION_INSTITUTION_HINT_PATTERN =
  /\b(college|institute|school|university)\b|(?:大学|学院|学校|研究院|研究所)/i;
const DEGREE_VALUE_HINT_PATTERN =
  /\b(bachelor|b\.?a\.?|b\.?eng|b\.?s\.?c?|b\.?s|degree|diploma|doctor|master|m\.?a\.?|m\.?eng|m\.?s\.?c?|m\.?s|mba|phd)\b|(?:本科|硕士|博士|学士)/i;
const PROJECT_SIGNAL_HINT_PATTERN =
  /\b(?:app|automation|blockchain|browser|cloud|engine|exchange|feed|framework|marketplace|module|nas|netbackup|phibox|phicoin|platform|portal|product|project|search|service|solution|storage|system|taas|testing|trading|vcf|wallet)\b/i;
const SUSPICIOUS_PROJECT_PREFIX_PATTERN = /^(?:and|for|from|in|of|on|or|to|with)\b/i;
const SUSPICIOUS_PROJECT_LABEL_PATTERN = /^(?:english|language|languages|skills?)[:：]/i;
const EXPLICIT_LOCATION_PREFIX_PATTERN = /^(?:location|current location|based in|所在地|地点|当前地点)\s*[:：]/i;
const DATE_RANGE_PATTERN =
  /(?:19|20)\d{2}[./-]\d{1,2}|(?:19|20)\d{2}\s*[–-]\s*(?:19|20)\d{2}|(?:19|20)\d{2}\s*[–-]\s*(?:present|current|now)|(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}/i;
const KNOWN_LOCATION_PATTERN =
  /\b(?:beijing|china|dubai|france|germany|hong kong|india|japan|london|new york|paris|san francisco|shanghai|shenzhen|singapore|sydney|tokyo|united arab emirates|united kingdom|united states|usa|uk)\b/i;
const KNOWN_LOCATION_TEXT_PATTERN =
  /(?:北京|上海|深圳|广州|杭州|香港|中国|新加坡|伦敦|纽约|东京|苏州|南京|武汉|成都|西安|厦门)/u;
const CANDIDATE_NAME_METADATA_HINT_PATTERN =
  /\b(?:age|citizenship|email|english|gender|height|location|mobile|nationality|notice period|phone|preferred location|residence|salary|wechat)\b|(?:性别|年龄|身高|出生|电话|手机|邮箱|微信|所在地|现居住地|期望|薪资|国籍|学历|本科|硕士|博士|英语六级|英语八级)/i;
const CANDIDATE_NAME_HEADING_OR_TABLE_HINT_PATTERN =
  /\b(?:company|experience|issues?|limited|ltd|inc|problem|profile|professional summary|skills?|summary|technical skills|time employer role|work experience)\b|(?:专业技能|个人优势|个人简介|个人信息|个人简历|公司|基本信息|工作经历|工作经验|技能|教育背景|有限(?:公司)?|经验|至今|自我评价|问题|项目经历)/i;
const PLAUSIBLE_LATIN_CANDIDATE_NAME_PATTERN =
  /^[A-Z][A-Za-z'’-]+(?:\s*\([A-Za-z][A-Za-z\s'’-]*\))?(?:\s+[A-Z][A-Za-z'’-]+(?:\s*\([A-Za-z][A-Za-z\s'’-]*\))?){0,4}$/;
const PLAUSIBLE_CHINESE_CANDIDATE_NAME_PATTERN = /^[\u4e00-\u9fff·]{2,6}$/u;
const PLAUSIBLE_MIXED_CANDIDATE_NAME_PATTERN =
  /^(?:[\u4e00-\u9fff·]{2,6}(?:\s+[A-Z][A-Za-z'’-]+(?:\s*\([A-Za-z][A-Za-z\s'’-]*\))?){1,4}|[A-Z][A-Za-z'’-]+(?:\s*\([A-Za-z][A-Za-z\s'’-]*\))?(?:\s+[A-Z][A-Za-z'’-]+(?:\s*\([A-Za-z][A-Za-z\s'’-]*\))?){0,3}\s+[\u4e00-\u9fff·]{1,6})$/u;

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return cleanLine(value).toLowerCase();
}

function tokenize(text) {
  return cleanLine(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ')
    .split(/\s+/)
    .flatMap((token) => {
      if (!token) {
        return [];
      }

      if (/[\u4e00-\u9fff]/.test(token)) {
        const chars = [...token];
        if (chars.length <= 1) {
          return chars;
        }

        const grams = [];
        for (let index = 0; index < chars.length - 1; index += 1) {
          grams.push(`${chars[index]}${chars[index + 1]}`);
        }
        return grams;
      }

      return [token];
    })
    .filter(Boolean);
}

function extractYear(value) {
  const match = cleanLine(value).match(/(19|20)\d{2}/);
  return match ? match[0] : '';
}

function compareYearDescending(left = '', right = '') {
  const leftYear = Number.parseInt(extractYear(left), 10) || 0;
  const rightYear = Number.parseInt(extractYear(right), 10) || 0;
  return rightYear - leftYear;
}

function parseDatePoint(value, boundary = 'start') {
  const normalized = cleanLine(value);

  if (!normalized) {
    return null;
  }

  if (/present|current|now/i.test(normalized)) {
    return boundary === 'start' ? 9999 * 12 : (9999 * 12) + 11;
  }

  const namedMonthMatch = normalized.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2})\b/i
  );

  if (namedMonthMatch) {
    const monthToken = namedMonthMatch[1].slice(0, 3).toLowerCase();
    const year = Number.parseInt(namedMonthMatch[2], 10);
    const monthIndex = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11
    }[monthToken];

    return (year * 12) + monthIndex;
  }

  const numericMonthMatch = normalized.match(/\b((?:19|20)\d{2})[./-](\d{1,2})\b/);

  if (numericMonthMatch) {
    const year = Number.parseInt(numericMonthMatch[1], 10);
    const month = Number.parseInt(numericMonthMatch[2], 10);

    if (month >= 1 && month <= 12) {
      return (year * 12) + (month - 1);
    }
  }

  const year = Number.parseInt(extractYear(normalized), 10);

  if (year) {
    return (year * 12) + (boundary === 'start' ? 0 : 11);
  }

  return null;
}

function dedupeBy(values, buildKey) {
  const seen = new Set();
  const deduped = [];

  for (const value of values) {
    const key = buildKey(value);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

function dedupeLooseStrings(values = []) {
  return dedupeBy(
    values.map((value) => cleanLine(value)).filter(Boolean),
    (value) => normalizeKey(value.replace(/^[-*•]\s*/, ''))
  );
}

function looksLikeGenericCandidateLabel(value) {
  const normalized = normalizeKey(value);
  return Boolean(normalized) && (
    GENERIC_CANDIDATE_LABELS.has(normalized) ||
    /^cv[\s._-]*\d+/i.test(normalized)
  );
}

function looksLikeGenericRoleLabel(value) {
  const normalized = normalizeKey(value);
  return Boolean(normalized) && GENERIC_ROLE_LABELS.has(normalized);
}

function looksLikeCandidateNameEmbeddedMetadata(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return (
    /[:：|/／]/.test(normalized) ||
    CANDIDATE_NAME_METADATA_HINT_PATTERN.test(normalized)
  );
}

function looksLikeCandidateNameHeadingOrTableHeader(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return (
    GENERIC_SECTION_LABELS.has(normalizeKey(normalized)) ||
    CANDIDATE_NAME_HEADING_OR_TABLE_HINT_PATTERN.test(normalized) ||
    looksLikeEmploymentOrProjectPollution(normalized)
  );
}

function looksLikeCandidateNameEmbeddedRoleOrBanner(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return ROLE_HINT_PATTERN.test(normalized);
}

function looksLikePlausibleCandidateName(value) {
  const normalized = cleanLine(value);
  const hasLatin = /[A-Za-z]/.test(normalized);
  const hasCjk = /[\u4e00-\u9fff]/u.test(normalized);
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;

  if (!normalized) {
    return false;
  }

  if (
    DATE_RANGE_PATTERN.test(normalized) ||
    /@/.test(normalized) ||
    /\d/.test(normalized) ||
    looksLikeCandidateNameEmbeddedMetadata(normalized) ||
    looksLikeCandidateNameHeadingOrTableHeader(normalized) ||
    looksLikeCandidateNameEmbeddedRoleOrBanner(normalized)
  ) {
    return false;
  }

  if (hasLatin && hasCjk && tokenCount <= 5) {
    return true;
  }

  return (
    PLAUSIBLE_LATIN_CANDIDATE_NAME_PATTERN.test(normalized) ||
    PLAUSIBLE_CHINESE_CANDIDATE_NAME_PATTERN.test(normalized) ||
    PLAUSIBLE_MIXED_CANDIDATE_NAME_PATTERN.test(normalized)
  );
}

function collectCandidateIdentityValidationFlags(candidateName) {
  const normalized = cleanLine(candidateName);
  const flags = [];

  if (!normalized || looksLikeGenericCandidateLabel(normalized)) {
    return ['candidate_name_missing_or_generic'];
  }

  if (looksLikeCandidateNameEmbeddedMetadata(normalized)) {
    flags.push('candidate_name_embedded_metadata');
  }

  if (looksLikeCandidateNameHeadingOrTableHeader(normalized)) {
    flags.push('candidate_name_heading_or_table_header');
  }

  if (looksLikeCandidateNameEmbeddedRoleOrBanner(normalized)) {
    flags.push('candidate_name_embedded_role_or_banner');
  }

  if (!flags.length && !looksLikePlausibleCandidateName(normalized)) {
    flags.push('candidate_name_missing_or_generic');
  }

  return [...new Set(flags)];
}

function looksLikeEmploymentOrProjectPollution(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return (
    /^\*/.test(normalized) ||
    COMPANY_HINT_PATTERN.test(normalized) ||
    ROLE_HINT_PATTERN.test(normalized) ||
    SUSPICIOUS_PROJECT_PREFIX_PATTERN.test(normalized) ||
    SUSPICIOUS_PROJECT_LABEL_PATTERN.test(normalized)
  );
}

function looksLikeSuspiciousProjectName(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return true;
  }

  if (SUSPICIOUS_PROJECT_PREFIX_PATTERN.test(normalized) || SUSPICIOUS_PROJECT_LABEL_PATTERN.test(normalized)) {
    return true;
  }

  if (
    DATE_RANGE_PATTERN.test(normalized) ||
    /^(?:certificate|certificates|certification|certifications)$/i.test(normalized) ||
    /\b(?:acp|aws|azure|ccna|ccnp|cet-\d|gcp|ielts|istqb|oracle|pmp|rhce|rhcsa|toefl)\b/i.test(normalized)
  ) {
    return true;
  }

  if (
    /^(?:technical points?|recommendation)\b[:：]?/i.test(normalized) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\b/i.test(normalized)
  ) {
    return true;
  }

  if (
    EDUCATION_HINT_PATTERN.test(normalized) &&
    !PROJECT_SIGNAL_HINT_PATTERN.test(normalized)
  ) {
    return true;
  }

  if (/^[a-z]/.test(normalized)) {
    return true;
  }

  if (
    ROLE_HINT_PATTERN.test(normalized) &&
    !PROJECT_SIGNAL_HINT_PATTERN.test(normalized)
  ) {
    return true;
  }

  if (/^(?:achieved|architected|built|contributed|delivered|designed|developed|handled|implemented|integrated|migrated|optimized|reduced)\b/i.test(normalized)) {
    return true;
  }

  if (
    normalized.split(/\s+/).length > 5 &&
    /\b(?:include(?:s|d)?|integrating|is|mainly|provides?|redirect|responsible|used?|using|was|were)\b/i.test(normalized)
  ) {
    return true;
  }

  if (normalized.length > 90) {
    return true;
  }

  if (/[。.!?]$/.test(normalized)) {
    return true;
  }

  if (/[。]/.test(normalized) || /(?:掌握|熟练|能够|负责|使用)/.test(normalized)) {
    return true;
  }

  if (normalized.length > 60 && !/[()（）]/.test(normalized)) {
    return true;
  }

  if ((/[，,;；]/.test(normalized) || /[:：]/.test(normalized)) && normalized.split(/\s+/).length > 8) {
    return true;
  }

  return false;
}

function buildSourceRef(block) {
  return {
    documentType: block.documentType,
    blockId: block.blockId,
    sectionKey: block.sectionKey,
    sectionLabel: block.sectionLabel,
    sourceName: block.sourceName,
    sourcePath: block.sourcePath,
    excerpt: cleanLine(block.text).slice(0, 220)
  };
}

function scoreBlockForTerms(block, queryTokens, preferredSectionKeys = []) {
  const blockTokens = new Set(tokenize(block.text));
  const overlap = queryTokens.filter((token) => blockTokens.has(token)).length;
  const preferredSectionBoost = preferredSectionKeys.includes(block.sectionKey) ? 2 : 0;
  return overlap + preferredSectionBoost;
}

function selectSourceRefs(blocks = [], { preferredSectionKeys = [], terms = [], limit = 2 } = {}) {
  const queryTokens = [...new Set(tokenize(terms.filter(Boolean).join(' ')))];
  const scored = blocks
    .map((block) => ({
      block,
      score: scoreBlockForTerms(block, queryTokens, preferredSectionKeys)
    }))
    .filter((entry) => entry.score > 0 || preferredSectionKeys.includes(entry.block.sectionKey))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.block.order - right.block.order;
    })
    .slice(0, limit)
    .map((entry) => buildSourceRef(entry.block));

  if (scored.length > 0) {
    return scored;
  }

  const fallbackBlocks = blocks
    .filter((block) => preferredSectionKeys.includes(block.sectionKey))
    .slice(0, limit)
    .map(buildSourceRef);

  return fallbackBlocks;
}

function looksLikeGenericSectionLabel(value) {
  return GENERIC_SECTION_LABELS.has(normalizeKey(value));
}

function buildBlockExtractionText(block) {
  const blockText = String(block?.text || '').trim();
  const sectionLabel = cleanLine(block?.sectionLabel);

  if (!sectionLabel || looksLikeGenericSectionLabel(sectionLabel) || sectionLabel === blockText) {
    return blockText;
  }

  return [sectionLabel, blockText].filter(Boolean).join('\n');
}

function resolveDocumentFileName(document, sourceDocument, fallbackName) {
  const explicitName = cleanLine(document?.file?.name);

  if (explicitName) {
    return explicitName;
  }

  const sourcePath = cleanLine(sourceDocument?.sourcePath);

  if (sourcePath) {
    return path.basename(sourcePath);
  }

  const sourceName = cleanLine(sourceDocument?.blocks?.[0]?.sourceName);

  if (sourceName) {
    return sourceName;
  }

  return fallbackName;
}

function collectLinesFromBlocks(blocks = []) {
  return blocks.flatMap((block) => buildBlockExtractionText(block)
    .split('\n')
    .map((line) => cleanLine(line))
    .filter(Boolean));
}

function collectSectionLines(blocks = [], sectionKeys = []) {
  const sectionKeySet = new Set(sectionKeys);
  return collectLinesFromBlocks(
    blocks.filter((block) => sectionKeySet.has(block.sectionKey))
  );
}

function collectPreferredSectionLines(blocks = [], primarySectionKeys = [], fallbackSectionKeys = []) {
  const primaryLines = collectSectionLines(blocks, primarySectionKeys);

  if (primaryLines.length > 0) {
    return primaryLines;
  }

  const fallbackLines = collectSectionLines(blocks, fallbackSectionKeys);

  if (fallbackLines.length > 0) {
    return fallbackLines;
  }

  return collectLinesFromBlocks(blocks);
}

function joinLines(lines = []) {
  return lines.join('\n');
}

function buildDocumentTextFromBlocks(blocks = []) {
  return blocks
    .map((block) => buildBlockExtractionText(block).trim())
    .filter(Boolean)
    .join('\n\n');
}

function isLikelyValidEducationEntry(entry = {}) {
  const degreeName = cleanLine(entry.degreeName);
  const institutionName = cleanLine(entry.university);
  const combined = cleanLine([degreeName, institutionName].join(' '));

  if (
    !degreeName ||
    !institutionName ||
    !combined ||
    !EDUCATION_HINT_PATTERN.test(combined)
  ) {
    return false;
  }

  if (
    looksLikeGenericSectionLabel(degreeName) ||
    looksLikeGenericSectionLabel(institutionName) ||
    degreeName === institutionName ||
    EDUCATION_INSTITUTION_HINT_PATTERN.test(degreeName) ||
    DEGREE_VALUE_HINT_PATTERN.test(institutionName)
  ) {
    return false;
  }

  if (degreeName && looksLikeEmploymentOrProjectPollution(degreeName) && !DEGREE_VALUE_HINT_PATTERN.test(degreeName)) {
    return false;
  }

  if (institutionName && looksLikeEmploymentOrProjectPollution(institutionName) && !EDUCATION_INSTITUTION_HINT_PATTERN.test(institutionName)) {
    return false;
  }

  return true;
}

function scoreEducationEntries(entries = []) {
  return entries.reduce((score, entry) => {
    const hasContent = cleanLine([
      entry.degreeName,
      entry.university,
      entry.startYear,
      entry.endYear
    ].join(' '));

    if (!hasContent) {
      return score;
    }

    if (isLikelyValidEducationEntry(entry)) {
      score.validCount += 1;
      return score;
    }

    score.malformedCount += 1;
    return score;
  }, {
    validCount: 0,
    malformedCount: 0
  });
}

function chooseEducationEntries(sectionEntries = [], fallbackEntries = []) {
  const sectionScore = scoreEducationEntries(sectionEntries);
  const fallbackScore = scoreEducationEntries(fallbackEntries);

  if (sectionScore.validCount === 0 && fallbackScore.validCount === 0) {
    if (sectionScore.malformedCount === 0 && fallbackScore.malformedCount === 0) {
      return [];
    }

    return sectionScore.malformedCount >= fallbackScore.malformedCount
      ? sectionEntries
      : fallbackEntries;
  }

  if (
    sectionScore.validCount > 0 &&
    (
      fallbackScore.validCount === 0 ||
      sectionScore.malformedCount <= fallbackScore.malformedCount
    )
  ) {
    return sectionEntries;
  }

  return fallbackScore.validCount > 0 ? fallbackEntries : [];
}

function chooseEducationEntriesWithSource(sectionEntries = [], fallbackEntries = []) {
  const selectedEntries = chooseEducationEntries(sectionEntries, fallbackEntries);

  if (selectedEntries === sectionEntries && sectionEntries.length > 0) {
    return {
      selectedEntries,
      selectionSource: 'section'
    };
  }

  if (selectedEntries === fallbackEntries && fallbackEntries.length > 0) {
    return {
      selectedEntries,
      selectionSource: 'fallback'
    };
  }

  return {
    selectedEntries,
    selectionSource: 'none'
  };
}

function shouldDropEducationNoiseEntry(entry = {}) {
  const degreeName = cleanLine(entry.degreeName);
  const institutionName = cleanLine(entry.university);
  const hasDates = Boolean(cleanLine(entry.startYear) || cleanLine(entry.endYear));

  if (
    isLikelyValidEducationEntry(entry) ||
    hasDates ||
    (!degreeName && !institutionName)
  ) {
    return false;
  }

  return (
    /[:：]/.test(degreeName) ||
    /[:：]/.test(institutionName) ||
    (
      EDUCATION_INSTITUTION_HINT_PATTERN.test(degreeName) &&
      DEGREE_VALUE_HINT_PATTERN.test(institutionName)
    ) ||
    (
      DEGREE_VALUE_HINT_PATTERN.test(degreeName) &&
      DEGREE_VALUE_HINT_PATTERN.test(institutionName)
    )
  );
}

function scoreEmploymentEntries(entries = []) {
  return entries.reduce((score, entry) => {
    const jobTitle = cleanLine(entry.jobTitle);
    const companyName = cleanLine(entry.companyName);
    const combined = cleanLine([jobTitle, companyName].join(' '));
    const responsibilityCount = Array.isArray(entry.responsibilities) ? entry.responsibilities.filter(Boolean).length : 0;
    const hasDates = Boolean(cleanLine(entry.startDate) || cleanLine(entry.endDate));
    const hasCoreFields = Boolean(jobTitle && companyName);
    const valid = isLikelyValidEmploymentEntry(entry);

    if (!combined && !hasDates) {
      return score;
    }

    score.totalScore +=
      (valid ? 30 : 0) +
      (jobTitle ? 6 : 0) +
      (companyName ? 6 : 0) +
      (hasDates ? 4 : 0) +
      Math.min(responsibilityCount, 3);

    if (hasCoreFields && valid) {
      score.validCount += 1;
    } else {
      score.malformedCount += 1;
    }

    return score;
  }, {
    validCount: 0,
    malformedCount: 0,
    totalScore: 0
  });
}

function chooseEmploymentEntries(sectionEntries = [], fallbackEntries = [], useSectionBoundary = false) {
  if (!useSectionBoundary) {
    return fallbackEntries.length > 0 ? fallbackEntries : [];
  }

  const sectionScore = scoreEmploymentEntries(sectionEntries);
  const fallbackScore = scoreEmploymentEntries(fallbackEntries);

  if (sectionScore.validCount === 0 && fallbackScore.validCount === 0) {
    if (sectionScore.totalScore === 0 && fallbackScore.totalScore > 0) {
      return fallbackEntries;
    }

    if (fallbackScore.totalScore === 0 && sectionScore.totalScore > 0) {
      return sectionEntries;
    }

    return sectionScore.totalScore >= fallbackScore.totalScore
      ? sectionEntries
      : fallbackEntries;
  }

  if (sectionScore.validCount !== fallbackScore.validCount) {
    return sectionScore.validCount > fallbackScore.validCount
      ? sectionEntries
      : fallbackEntries;
  }

  if (sectionScore.malformedCount !== fallbackScore.malformedCount) {
    return sectionScore.malformedCount < fallbackScore.malformedCount
      ? sectionEntries
      : fallbackEntries;
  }

  return sectionScore.totalScore >= fallbackScore.totalScore
    ? sectionEntries
    : fallbackEntries;
}

function scoreProjectEntries(entries = []) {
  return entries.reduce((score, entry) => {
    const projectName = cleanLine(entry.project_name);

    if (!projectName) {
      return score;
    }

    if (looksLikeSuspiciousProjectName(projectName)) {
      score.suspiciousCount += 1;
      return score;
    }

    score.validCount += 1;
    return score;
  }, {
    validCount: 0,
    suspiciousCount: 0
  });
}

function chooseProjectEntries(sectionEntries = [], fallbackEntries = []) {
  return chooseProjectEntriesWithSource(sectionEntries, fallbackEntries).selectedEntries;
}

function chooseProjectEntriesWithSource(sectionEntries = [], fallbackEntries = []) {
  const usableFallbackEntries = fallbackEntries.filter((entry) => !looksLikeSuspiciousProjectName(entry.project_name));
  const mergedByName = new Map();

  [
    ...sectionEntries.map((entry) => ({ entry, origin: 'section' })),
    ...usableFallbackEntries.map((entry) => ({ entry, origin: 'fallback' }))
  ].forEach(({ entry, origin }) => {
    const key = normalizeKey(entry.project_name);

    if (!key) {
      return;
    }

    const existing = mergedByName.get(key);

    if (!existing || scoreRawProjectEntry(entry) > scoreRawProjectEntry(existing.entry)) {
      mergedByName.set(key, { entry, origin });
    }
  });

  if (mergedByName.size === 0) {
    return {
      selectedEntries: [],
      selectedOrigins: [],
      selectionSource: 'none'
    };
  }

  const selectedWithOrigins = [...mergedByName.values()];
  const selectedEntries = selectedWithOrigins.map((value) => value.entry);
  const selectedOrigins = selectedWithOrigins.map((value) => ({
    projectName: cleanLine(value.entry.project_name),
    origin: value.origin
  }));
  const originSet = new Set(selectedOrigins.map((value) => value.origin));

  return {
    selectedEntries,
    selectedOrigins,
    selectionSource: originSet.size === 1 ? selectedOrigins[0].origin : 'merged'
  };
}

function cleanBulletPrefix(value) {
  return cleanLine(String(value || '').replace(/^[-*•]\s*/, ''));
}

function parseProjectHeadingParts(value) {
  const normalized = cleanLine(value);
  const trailingDateMatch = normalized.match(/^(.*?)\s*[（(]\s*([^()（）]+?)\s*[)）]\s*$/);

  if (!trailingDateMatch || !/(19|20)\d{2}/.test(trailingDateMatch[2])) {
    return {
      projectName: normalized,
      startDate: '',
      endDate: ''
    };
  }

  const rangeParts = trailingDateMatch[2]
    .split(/[–-]/)
    .map((part) => cleanLine(part))
    .filter(Boolean);

  return {
    projectName: cleanLine(trailingDateMatch[1]),
    startDate: rangeParts[0] || '',
    endDate: rangeParts[1] || rangeParts[0] || ''
  };
}

function looksLikeProjectHeadingCandidate(value) {
  const normalized = cleanLine(value);
  const parsedHeading = parseProjectHeadingParts(normalized);

  if (!normalized || normalized === '.' || /^[-*•]\s*/.test(normalized)) {
    return false;
  }

  if (/^(?:tech stack|使用技术)\s*[:：]/i.test(normalized)) {
    return false;
  }

  if (parsedHeading.startDate || parsedHeading.endDate) {
    return true;
  }

  if (/[.?!]$/.test(normalized)) {
    return false;
  }

  if (/^(?:achieved|architected|built|contributed|delivered|designed|developed|handled|implemented|integrated|migrated|optimized|reduced)\b/i.test(normalized)) {
    return false;
  }

  return !looksLikeSuspiciousProjectName(normalized) && normalized.split(/\s+/).length <= 12;
}

function scoreRawProjectEntry(entry = {}) {
  const bulletCount = Array.isArray(entry.project_bullets) ? entry.project_bullets.length : 0;
  const dateSpecificity = [entry.project_start_date, entry.project_end_date]
    .filter(Boolean)
    .reduce((score, value) => {
      if (/\d{4}[./-]\d{1,2}/.test(String(value))) {
        return score + 2;
      }

      if (/\d{4}/.test(String(value))) {
        return score + 1;
      }

      return score;
    }, 0);

  return dateSpecificity + Math.min(bulletCount, 3);
}

function buildProjectEntryFromBlock(block) {
  const lines = buildBlockExtractionText(block)
    .split('\n')
    .map((line) => cleanLine(line))
    .filter(Boolean);
  const customHeading = !looksLikeGenericSectionLabel(block?.sectionLabel)
    ? cleanLine(block.sectionLabel)
    : '';
  const heading = customHeading || (looksLikeProjectHeadingCandidate(lines[0] || '') ? lines[0] : '');

  if (!heading || heading === '.') {
    return null;
  }

  const parsedHeading = parseProjectHeadingParts(heading);
  const bulletLines = lines
    .filter((line, index) => {
      if (customHeading && index === 0 && line === customHeading) {
        return false;
      }

      return line !== heading && line !== '.';
    })
    .map((line) => cleanBulletPrefix(line))
    .filter(Boolean);

  return {
    project_name: parsedHeading.projectName,
    project_start_date: parsedHeading.startDate,
    project_end_date: parsedHeading.endDate,
    project_timeline_basis: parsedHeading.startDate || parsedHeading.endDate ? 'explicit' : '',
    linked_job_title: '',
    linked_company_name: '',
    project_bullets: bulletLines,
    project_bullet_originals: bulletLines.slice()
  };
}

function extractCanonicalProjectEntries(projectBlocks = []) {
  const sectionEntries = extractProjectExperiences(collectLinesFromBlocks(projectBlocks));
  const blockEntries = projectBlocks
    .map((block) => buildProjectEntryFromBlock(block))
    .filter(Boolean);
  const bestEntryByName = new Map();

  [...sectionEntries, ...blockEntries].forEach((entry) => {
    const key = normalizeKey(entry.project_name);

    if (!key) {
      return;
    }

    const existing = bestEntryByName.get(key);

    if (!existing || scoreRawProjectEntry(entry) > scoreRawProjectEntry(existing)) {
      bestEntryByName.set(key, entry);
    }
  });

  return [...bestEntryByName.values()];
}

function looksLikeCandidateLocation(value, candidateName = '') {
  const normalized = cleanLine(value);

  if (!normalized || normalized === candidateName) {
    return false;
  }

  if (
    normalized.length > 60 ||
    normalized.split(/\s+/).length > 6 ||
    DATE_RANGE_PATTERN.test(normalized) ||
    /@/.test(normalized) ||
    /\d{5,}/.test(normalized) ||
    /\|/.test(normalized) ||
    /[;；]/.test(normalized) ||
    /^[-*•]\s*/.test(normalized) ||
    /^(?:education|experience|projects|skills|languages|summary|profile)$/i.test(normalized) ||
    EDUCATION_HINT_PATTERN.test(normalized) ||
    COMPANY_HINT_PATTERN.test(normalized) ||
    ROLE_HINT_PATTERN.test(normalized) ||
    /(?:工作经历|项目经历|技能\/优势及其他|教育背景|经验总结)/u.test(normalized)
  ) {
    return false;
  }

  return (
    EXPLICIT_LOCATION_PREFIX_PATTERN.test(normalized) ||
    (/,/.test(normalized) && normalized.length <= 40) ||
    (KNOWN_LOCATION_PATTERN.test(normalized) && normalized.length <= 32) ||
    (KNOWN_LOCATION_TEXT_PATTERN.test(normalized) && normalized.length <= 16)
  );
}

function extractCandidateLocationFromBlocks(cvBlocks = [], candidateName = '') {
  const overviewLines = collectPreferredSectionLines(cvBlocks, ['overview', 'unknown'], []).slice(0, 12);

  for (const line of overviewLines) {
    if (EXPLICIT_LOCATION_PREFIX_PATTERN.test(line)) {
      return cleanLine(line.split(/[:：]/).slice(1).join(':'));
    }

    if (looksLikeCandidateLocation(line, candidateName)) {
      return line;
    }
  }

  return '';
}

function buildRawSectionExtractions({ cvDocument, jdDocument, cvSourceDocument, jdSourceDocument }) {
  const cvBlocks = cvSourceDocument?.blocks || [];
  const jdBlocks = jdSourceDocument?.blocks || [];
  const cvFileName = resolveDocumentFileName(cvDocument, cvSourceDocument, 'candidate');
  const jdFileName = resolveDocumentFileName(jdDocument, jdSourceDocument, 'role');
  const cvAllText = buildDocumentTextFromBlocks(cvBlocks);
  const jdAllText = buildDocumentTextFromBlocks(jdBlocks);
  const sourceBoundProfile = extractDocumentDerivedProfile({
    cvDocument: {
      text: cvAllText,
      file: {
        name: cvFileName,
        path: cleanLine(cvSourceDocument?.sourcePath)
      }
    },
    jdDocument: {
      text: jdAllText,
      file: {
        name: jdFileName,
        path: cleanLine(jdSourceDocument?.sourcePath)
      }
    }
  });
  const candidateNameFromBlocks = extractCandidateName(
    joinLines(collectPreferredSectionLines(cvBlocks, ['overview', 'unknown'], [])) || cvAllText,
    cvFileName
  );
  const roleTitleFromBlocks = extractRoleTitle(
    joinLines(collectPreferredSectionLines(jdBlocks, ['overview'], ['requirements', 'responsibilities'])) || jdAllText,
    jdFileName
  );
  const educationLines = collectSectionLines(cvBlocks, ['education']);
  const experienceLines = collectSectionLines(cvBlocks, ['experience']);
  const projectBlocks = cvBlocks.filter((block) => block.sectionKey === 'projects');
  const requirementLines = collectPreferredSectionLines(jdBlocks, ['requirements'], ['responsibilities']);
  const requirementEntries = dedupeLooseStrings(extractRequirements(joinLines(requirementLines)));
  const sectionEducationEntries = educationLines.length > 0
    ? extractEducationEntries(educationLines)
    : [];
  const sectionEmploymentEntries = experienceLines.length > 0
    ? extractExperienceHistory(experienceLines)
    : [];
  const sectionProjectEntries = projectBlocks.length > 0
    ? extractCanonicalProjectEntries(projectBlocks)
    : [];

  return {
    cvBlocks,
    jdBlocks,
    sourceBoundProfile,
    identity: {
      candidateNameFromBlocks,
      candidateLocationFromBlocks: extractCandidateLocationFromBlocks(cvBlocks, candidateNameFromBlocks),
      roleTitleFromBlocks
    },
    education: {
      sectionEntries: sectionEducationEntries,
      fallbackEntries: sourceBoundProfile.educationEntries || []
    },
    employmentHistory: {
      sectionEntries: sectionEmploymentEntries,
      fallbackEntries: sourceBoundProfile.employmentHistory || [],
      usedSectionBoundary: experienceLines.length > 0
    },
    projectExperiences: {
      sectionEntries: sectionProjectEntries,
      fallbackEntries: sourceBoundProfile.projectExperiences || []
    },
    jdRequirements: {
      sectionEntries: requirementEntries,
      fallbackEntries: dedupeLooseStrings(extractRequirements(jdAllText))
    }
  };
}

function resolveSelectedIdentity(rawIdentity = {}, sourceBoundProfile = {}) {
  const nameFromBlocks = cleanLine(rawIdentity.candidateNameFromBlocks);
  const fallbackName = cleanLine(sourceBoundProfile.candidateName);
  const locationFromBlocks = cleanLine(rawIdentity.candidateLocationFromBlocks);
  const fallbackLocation = cleanLine(sourceBoundProfile.candidateLocation);
  const roleTitleFromBlocks = cleanLine(rawIdentity.roleTitleFromBlocks);
  const fallbackRoleTitle = cleanLine(sourceBoundProfile.roleTitle);

  return {
    candidateName: nameFromBlocks && !looksLikeGenericCandidateLabel(nameFromBlocks)
      ? nameFromBlocks
      : fallbackName,
    candidateNameSelectionSource: nameFromBlocks && !looksLikeGenericCandidateLabel(nameFromBlocks)
      ? 'section'
      : (fallbackName ? 'fallback' : 'none'),
    candidateLocation: locationFromBlocks || fallbackLocation,
    candidateLocationSelectionSource: locationFromBlocks
      ? 'section'
      : (fallbackLocation ? 'fallback' : 'none'),
    roleTitle: roleTitleFromBlocks && !looksLikeGenericRoleLabel(roleTitleFromBlocks)
      ? roleTitleFromBlocks
      : fallbackRoleTitle,
    roleTitleSelectionSource: roleTitleFromBlocks && !looksLikeGenericRoleLabel(roleTitleFromBlocks)
      ? 'section'
      : (fallbackRoleTitle ? 'fallback' : 'none')
  };
}

function selectEmploymentEntriesWithSource(rawEmployment = {}) {
  const sectionEntries = Array.isArray(rawEmployment.sectionEntries) ? rawEmployment.sectionEntries : [];
  const fallbackEntries = Array.isArray(rawEmployment.fallbackEntries) ? rawEmployment.fallbackEntries : [];
  const useSectionBoundary = Boolean(rawEmployment.usedSectionBoundary);
  const selectedEntries = chooseEmploymentEntries(sectionEntries, fallbackEntries, useSectionBoundary);

  return {
    sectionEntries,
    fallbackEntries,
    selectedEntries,
    selectionSource: selectedEntries.length > 0
      ? (selectedEntries === sectionEntries ? 'section' : 'fallback')
      : 'none'
  };
}

function selectRequirementEntriesWithSource(rawRequirements = {}) {
  const sectionEntries = Array.isArray(rawRequirements.sectionEntries) ? rawRequirements.sectionEntries : [];
  const fallbackEntries = Array.isArray(rawRequirements.fallbackEntries) ? rawRequirements.fallbackEntries : [];
  const selectedEntries = sectionEntries.length > 0 ? sectionEntries : fallbackEntries;

  return {
    sectionEntries,
    fallbackEntries,
    selectedEntries,
    selectionSource: selectedEntries.length > 0
      ? (sectionEntries.length > 0 ? 'section' : 'fallback')
      : 'none'
  };
}

function looksLikeBareDateToken(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return (
    /^(?:19|20)\d{2}(?:[./-]\d{1,2})?$/.test(normalized) ||
    /^(?:present|current|now|至今|目前|现在)$/i.test(normalized)
  );
}

function looksLikeEmploymentNarrativeText(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return (
    normalized.length > 120 ||
    normalized.split(/\s+/).filter(Boolean).length > 18 ||
    /[。；;!?]$/.test(normalized)
  );
}

function looksLikePlausibleEmploymentCompanyName(value) {
  const normalized = cleanLine(value);

  if (
    !normalized ||
    /^[•]/u.test(normalized) ||
    looksLikeBareDateToken(normalized) ||
    DATE_RANGE_PATTERN.test(normalized) ||
    looksLikeGenericSectionLabel(normalized) ||
    /^curriculum vitae$/i.test(normalized) ||
    /^title\s*[:：]/i.test(normalized) ||
    looksLikeEmploymentNarrativeText(normalized) ||
    SUSPICIOUS_PROJECT_LABEL_PATTERN.test(normalized) ||
    /^(?:training|qualification|summary)$/i.test(normalized) ||
    /(?:专业技能|个人优势|项目经历|教育背景|工作经历|工作经验|简历)/u.test(normalized)
  ) {
    return false;
  }

  if (!COMPANY_HINT_PATTERN.test(normalized) && ROLE_HINT_PATTERN.test(normalized)) {
    return false;
  }

  if (
    !COMPANY_HINT_PATTERN.test(normalized) &&
    !/\s/.test(normalized) &&
    normalized.length > 18
  ) {
    return false;
  }

  return true;
}

function normalizeEmploymentJobTitleValue(value) {
  return cleanLine(value).replace(/^(?:job title|title)\s*[:：]\s*/i, '');
}

function looksLikePlausibleEmploymentJobTitle(value) {
  const normalized = normalizeEmploymentJobTitleValue(value);

  if (
    !normalized ||
    looksLikeBareDateToken(normalized) ||
    DATE_RANGE_PATTERN.test(normalized) ||
    looksLikeGenericSectionLabel(normalized) ||
    /^curriculum vitae$/i.test(normalized) ||
    looksLikeEmploymentNarrativeText(normalized)
  ) {
    return false;
  }

  if (COMPANY_HINT_PATTERN.test(normalized) && !ROLE_HINT_PATTERN.test(normalized)) {
    return false;
  }

  if (EDUCATION_INSTITUTION_HINT_PATTERN.test(normalized) && !ROLE_HINT_PATTERN.test(normalized)) {
    return false;
  }

  return true;
}

function isLikelyValidEmploymentEntry(entry = {}) {
  const companyName = cleanLine(entry.companyName);
  const jobTitle = normalizeEmploymentJobTitleValue(entry.jobTitle);

  if (!companyName || !jobTitle) {
    return false;
  }

  return looksLikePlausibleEmploymentCompanyName(companyName) &&
    looksLikePlausibleEmploymentJobTitle(jobTitle);
}

function shouldDropEmploymentNoiseEntry(entry = {}) {
  const companyName = cleanLine(entry.companyName);
  const jobTitle = normalizeEmploymentJobTitleValue(entry.jobTitle);
  const jobTitleTokenCount = jobTitle.split(/\s+/).filter(Boolean).length;
  const companyTokenCount = companyName.split(/\s+/).filter(Boolean).length;
  const responsibilityWordCount = Array.isArray(entry.responsibilities)
    ? entry.responsibilities
      .map((value) => cleanLine(value))
      .join(' ')
      .split(/\s+/)
      .filter(Boolean)
      .length
    : 0;

  if (
    isLikelyValidEmploymentEntry({
      ...entry,
      companyName,
      jobTitle
    }) ||
    !companyName ||
    !jobTitle
  ) {
    return !companyName && looksLikeGenericSectionLabel(jobTitle);
  }

  return (
    companyTokenCount > 18 ||
    /^project\b/i.test(companyName) ||
    (
      (
        jobTitleTokenCount > 25 ||
        responsibilityWordCount > 25
      ) &&
      (
        /\|/.test(companyName) ||
        /(?:project|项目)/i.test(companyName) ||
        !COMPANY_HINT_PATTERN.test(companyName)
      )
    )
  );
}

function normalizeSelfEmployedEmploymentEntry(companyName, jobTitle) {
  if (
    !companyName &&
    /^(?:independent|freelance|self-employed)\s+(?:consultant|contractor)$/i.test(jobTitle)
  ) {
    return {
      companyName: 'Self-employed',
      jobTitle
    };
  }

  return {
    companyName,
    jobTitle
  };
}

function parseDegreeAndField(degreeName) {
  const normalized = cleanLine(degreeName);
  const inPatternMatch = normalized.match(/^((?:MSc|BSc|MBA|PhD|BA|MA|Bachelor|Master|Doctor)[A-Za-z .()'-]*)\s+in\s+(.+)$/i);

  if (inPatternMatch) {
    return {
      degreeName: cleanLine(inPatternMatch[1]),
      fieldOfStudy: cleanLine(inPatternMatch[2])
    };
  }

  return {
    degreeName: normalized,
    fieldOfStudy: ''
  };
}

function normalizeEducationEntries(entries = [], cvBlocks = []) {
  const deduped = dedupeBy(entries, (entry) => normalizeKey([
    entry.degreeName,
    entry.university,
    entry.startYear,
    entry.endYear
  ].join('|')));
  const filtered = deduped.filter((entry) => !shouldDropEducationNoiseEntry(entry));

  return filtered
    .map((entry) => {
      const parsedDegree = parseDegreeAndField(entry.degreeName);
      const institutionName = cleanLine(entry.university);
      const validationFlags = [];

      if (!isLikelyValidEducationEntry({
        degreeName: parsedDegree.degreeName || entry.degreeName,
        university: institutionName,
        startYear: entry.startYear,
        endYear: entry.endYear
      })) {
        validationFlags.push('education_entry_malformed');
      }

      return {
        degreeName: parsedDegree.degreeName,
        fieldOfStudy: parsedDegree.fieldOfStudy,
        institutionName,
        startDate: cleanLine(entry.startYear),
        endDate: cleanLine(entry.endYear),
        confidence: validationFlags.length === 0 ? 'high' : 'low',
        validationFlags,
        sourceRefs: selectSourceRefs(cvBlocks, {
          preferredSectionKeys: ['education'],
          terms: [entry.degreeName, entry.university, entry.startYear, entry.endYear]
        })
      };
    })
    .sort((left, right) => compareYearDescending(left.endDate, right.endDate));
}

function normalizeEmploymentEntries(entries = [], cvBlocks = []) {
  const deduped = dedupeBy(entries, (entry) => normalizeKey([
    entry.companyName,
    entry.jobTitle,
    entry.startDate,
    entry.endDate
  ].join('|')));
  const filtered = deduped.filter((entry) => !shouldDropEmploymentNoiseEntry(entry));

  return filtered
    .map((entry) => {
      const normalizedEntry = normalizeSelfEmployedEmploymentEntry(
        cleanLine(entry.companyName),
        normalizeEmploymentJobTitleValue(entry.jobTitle)
      );
      const companyName = normalizedEntry.companyName;
      const jobTitle = normalizedEntry.jobTitle;
      const validationFlags = [];

      if (!isLikelyValidEmploymentEntry({
        ...entry,
        companyName,
        jobTitle
      })) {
        validationFlags.push('employment_entry_missing_core_fields');
      }

      const startYear = extractYear(entry.startDate);
      const endYear = extractYear(entry.endDate);

      if (startYear && endYear && Number.parseInt(startYear, 10) > Number.parseInt(endYear, 10)) {
        validationFlags.push('employment_chronology_invalid');
      }

      return {
        companyName,
        jobTitle,
        startDate: cleanLine(entry.startDate),
        endDate: cleanLine(entry.endDate),
        responsibilityBullets: Array.isArray(entry.responsibilities)
          ? entry.responsibilities.map((responsibility) => cleanLine(responsibility)).filter(Boolean)
          : [],
        confidence: validationFlags.length === 0 ? 'high' : 'low',
        validationFlags,
        sourceRefs: selectSourceRefs(cvBlocks, {
          preferredSectionKeys: ['experience'],
          terms: [entry.companyName, entry.jobTitle, entry.startDate, entry.endDate]
        })
      };
    })
    .sort((left, right) => compareYearDescending(left.endDate, right.endDate));
}

function parseProjectTechnologies(projectBullets = []) {
  const techBullet = projectBullets.find((bullet) => /^(?:tech stack|使用技术)\s*[:：]/i.test(cleanLine(bullet)));

  if (!techBullet) {
    return [];
  }

  return cleanLine(techBullet)
    .replace(/^(?:tech stack|使用技术)\s*[:：]\s*/i, '')
    .split(/[,，/]/)
    .map((value) => cleanLine(value))
    .filter(Boolean);
}

function buildProjectSummary(projectBullets = []) {
  const narrativeBullets = projectBullets
    .map((bullet) => cleanLine(bullet))
    .filter((bullet) => bullet && !/^(?:tech stack|使用技术)\s*[:：]/i.test(bullet));

  return narrativeBullets[0] || '';
}

function buildEmploymentLinkCandidate(employmentEntry, index) {
  return {
    employmentIndex: index,
    companyName: cleanLine(employmentEntry?.companyName),
    jobTitle: cleanLine(employmentEntry?.jobTitle),
    startDate: cleanLine(employmentEntry?.startDate),
    endDate: cleanLine(employmentEntry?.endDate)
  };
}

function findEmploymentLinkIndex(project, employmentHistory) {
  const projectStart = parseDatePoint(project.startDate, 'start');
  const projectEnd = parseDatePoint(project.endDate || project.startDate, 'end');

  if (projectStart === null) {
    return {
      linkedEmploymentIndex: null,
      ambiguous: false,
      candidateMatches: []
    };
  }

  const matches = employmentHistory
    .map((employmentEntry, index) => ({ employmentEntry, index }))
    .filter(({ employmentEntry }) => {
      const employmentStart = parseDatePoint(employmentEntry.startDate, 'start');
      const employmentEnd = parseDatePoint(employmentEntry.endDate || employmentEntry.startDate, 'end');

      if (employmentStart === null || employmentEnd === null) {
        return false;
      }

      return (
        projectStart >= employmentStart &&
        (projectEnd === null ? projectStart : projectEnd) <= employmentEnd
      );
    });

  if (matches.length === 1) {
    return {
      linkedEmploymentIndex: matches[0].index,
      ambiguous: false,
      candidateMatches: [buildEmploymentLinkCandidate(matches[0].employmentEntry, matches[0].index)]
    };
  }

  return {
    linkedEmploymentIndex: null,
    ambiguous: matches.length > 1,
    candidateMatches: matches.map(({ employmentEntry, index }) => buildEmploymentLinkCandidate(employmentEntry, index))
  };
}

function normalizeProjectEntries(entries = [], cvBlocks = [], employmentHistory = []) {
  const deduped = dedupeBy(entries, (entry) => normalizeKey([
    entry.project_name,
    entry.project_start_date,
    entry.project_end_date
  ].join('|')));
  const nonSuspiciousEntries = deduped.filter((entry) => !looksLikeSuspiciousProjectName(entry.project_name));
  const stronglySignaledEntries = deduped.filter((entry) => {
    const projectName = cleanLine(entry.project_name);
    const projectBullets = Array.isArray(entry.project_bullets)
      ? entry.project_bullets.map((value) => cleanLine(value)).filter(Boolean)
      : [];
    const signalText = cleanLine([projectName, ...projectBullets.slice(0, 3)].join(' '));
    const hasDates = Boolean(cleanLine(entry.project_start_date) || cleanLine(entry.project_end_date));

    if (!projectName) {
      return false;
    }

    if (!looksLikeSuspiciousProjectName(projectName)) {
      return true;
    }

    if (!hasDates && projectBullets.length === 0) {
      return false;
    }

    return PROJECT_SIGNAL_HINT_PATTERN.test(signalText);
  });
  const candidateEntries = nonSuspiciousEntries.length > 0
    ? nonSuspiciousEntries
    : stronglySignaledEntries;

  return candidateEntries
    .map((entry) => {
      const projectBullets = Array.isArray(entry.project_bullets) ? entry.project_bullets : [];
      const validationFlags = [];

      if (looksLikeSuspiciousProjectName(entry.project_name)) {
        validationFlags.push('project_name_suspicious');
      }

      const linkage = findEmploymentLinkIndex({
        startDate: entry.project_start_date,
        endDate: entry.project_end_date
      }, employmentHistory);

      if (linkage.ambiguous) {
        validationFlags.push('project_role_ambiguous');
      }

      return {
        projectName: cleanLine(entry.project_name),
        projectSummary: buildProjectSummary(projectBullets),
        startDate: cleanLine(entry.project_start_date),
        endDate: cleanLine(entry.project_end_date),
        technologies: parseProjectTechnologies(projectBullets),
        linkedEmploymentIndex: linkage.linkedEmploymentIndex,
        ambiguousEmploymentCandidates: linkage.ambiguous ? linkage.candidateMatches : [],
        confidence: validationFlags.length === 0 ? 'high' : 'medium',
        validationFlags,
        sourceRefs: selectSourceRefs(cvBlocks, {
          preferredSectionKeys: ['projects'],
          terms: [entry.project_name, entry.project_start_date, entry.project_end_date, ...projectBullets.slice(0, 2)]
        })
      };
    })
    .sort((left, right) => compareYearDescending(left.endDate, right.endDate));
}

function normalizeRequirementEntries(requirements = [], jdBlocks = [], roleTitle = '') {
  const normalizedRoleTitle = normalizeKey(roleTitle);

  return dedupeBy(
    requirements.map((requirement) => cleanLine(String(requirement || '').replace(/^[-*•]\s*/, ''))),
    (requirement) => normalizeKey(requirement)
  )
    .filter((requirement) => {
      const normalized = normalizeKey(requirement);

      if (!normalized) {
        return false;
      }

      if (normalized === normalizedRoleTitle) {
        return false;
      }

      if (
        /^role\s*[:：]/i.test(requirement) ||
        GENERIC_ROLE_LABELS.has(normalized) ||
        normalized === '岗位信息' ||
        normalized === '基础工作信息'
      ) {
        return false;
      }

      return normalized.split(/\s+/).length > 1 || /[\u4e00-\u9fff]{4,}/.test(normalized);
    })
    .map((requirement) => ({
      requirementText: cleanLine(requirement),
      confidence: 'medium',
      validationFlags: [],
      sourceRefs: selectSourceRefs(jdBlocks, {
        preferredSectionKeys: ['requirements'],
        terms: [requirement]
      })
    }));
}

function buildCanonicalValidationSummary({ candidateSchema, jdSchema }) {
  const issues = [];

  for (const validationFlag of Array.isArray(candidateSchema.identity.validationFlags)
    ? candidateSchema.identity.validationFlags
    : collectCandidateIdentityValidationFlags(candidateSchema.identity.name)) {
    const issueByCode = {
      candidate_name_missing_or_generic: 'Candidate name is missing, generic, or not person-like.',
      candidate_name_embedded_metadata: 'Candidate name contains inline metadata or profile details.',
      candidate_name_heading_or_table_header: 'Candidate name looks like a section heading, table row, or other extracted content.',
      candidate_name_embedded_role_or_banner: 'Candidate name contains role or recruiter-banner text.'
    }[validationFlag];

    if (!issueByCode) {
      continue;
    }

    issues.push({
      code: validationFlag,
      severity: 'red',
      section: 'identity',
      message: issueByCode,
      sourceRefs: candidateSchema.identity.sourceRefs || []
    });
  }

  if (!cleanLine(jdSchema.role.title) || looksLikeGenericRoleLabel(jdSchema.role.title)) {
    issues.push({
      code: 'role_title_missing_or_generic',
      severity: 'red',
      section: 'role',
      message: 'Role title is missing or generic.',
      sourceRefs: jdSchema.role.sourceRefs || []
    });
  }

  candidateSchema.education.forEach((entry, index) => {
    if (!entry.degreeName || !entry.institutionName || entry.validationFlags.includes('education_entry_malformed')) {
      issues.push({
        code: 'education_entry_malformed',
        severity: 'red',
        section: 'education',
        entryIndex: index,
        message: `Education entry ${index + 1} is malformed or incomplete.`,
        sourceRefs: entry.sourceRefs
      });
    }
  });

  candidateSchema.employmentHistory.forEach((entry, index) => {
    if (entry.validationFlags.includes('employment_entry_missing_core_fields')) {
      issues.push({
        code: 'employment_entry_missing_core_fields',
        severity: 'red',
        section: 'employment',
        entryIndex: index,
        message: `Employment entry ${index + 1} is missing a company or role.`,
        sourceRefs: entry.sourceRefs
      });
    }

    if (entry.validationFlags.includes('employment_chronology_invalid')) {
      issues.push({
        code: 'employment_chronology_invalid',
        severity: 'red',
        section: 'employment',
        entryIndex: index,
        message: `Employment entry ${index + 1} has invalid chronology.`,
        sourceRefs: entry.sourceRefs
      });
    }
  });

  candidateSchema.projectExperiences.forEach((entry, index) => {
    if (entry.validationFlags.includes('project_name_suspicious')) {
      issues.push({
        code: 'project_name_suspicious',
        severity: 'red',
        section: 'projects',
        entryIndex: index,
        message: `Project entry ${index + 1} looks like a fragment or malformed title.`,
        sourceRefs: entry.sourceRefs
      });
    }

    if (entry.validationFlags.includes('project_role_ambiguous')) {
      issues.push({
        code: 'project_role_ambiguous',
        severity: 'amber',
        section: 'projects',
        entryIndex: index,
        message: `Project entry ${index + 1} could not be linked to one role unambiguously.`,
        projectName: entry.projectName,
        projectStartDate: entry.startDate,
        projectEndDate: entry.endDate,
        ambiguousEmploymentCandidates: Array.isArray(entry.ambiguousEmploymentCandidates)
          ? entry.ambiguousEmploymentCandidates
          : [],
        sourceRefs: entry.sourceRefs
      });
    }
  });

  if (!jdSchema.requirements.length) {
    issues.push({
      code: 'jd_requirements_missing',
      severity: 'red',
      section: 'requirements',
      message: 'No JD requirements could be extracted.',
      sourceRefs: jdSchema.role.sourceRefs || []
    });
  }

  const state = issues.some((issue) => issue.severity === 'red')
    ? 'red'
    : issues.some((issue) => issue.severity === 'amber')
      ? 'amber'
      : 'green';

  return {
    state,
    issues
  };
}

function buildCanonicalExtractionReview({ cvDocument, jdDocument, sourceModel = null } = {}) {
  const resolvedSourceModel = sourceModel || buildWorkspaceSourceModel({ cvDocument, jdDocument });
  const cvSourceDocument = resolvedSourceModel.documents.find((document) => document.documentType === 'cv');
  const jdSourceDocument = resolvedSourceModel.documents.find((document) => document.documentType === 'jd');
  const rawSectionExtractions = buildRawSectionExtractions({
    cvDocument,
    jdDocument,
    cvSourceDocument,
    jdSourceDocument
  });
  const selectedIdentity = resolveSelectedIdentity(
    rawSectionExtractions.identity,
    rawSectionExtractions.sourceBoundProfile
  );
  const educationSelection = chooseEducationEntriesWithSource(
    rawSectionExtractions.education.sectionEntries,
    rawSectionExtractions.education.fallbackEntries
  );
  const employmentSelection = selectEmploymentEntriesWithSource(rawSectionExtractions.employmentHistory);
  const projectSelection = chooseProjectEntriesWithSource(
    rawSectionExtractions.projectExperiences.sectionEntries,
    rawSectionExtractions.projectExperiences.fallbackEntries
  );
  const requirementSelection = selectRequirementEntriesWithSource(rawSectionExtractions.jdRequirements);
  const profile = {
    candidateName: selectedIdentity.candidateName,
    candidateLocation: selectedIdentity.candidateLocation,
    roleTitle: selectedIdentity.roleTitle,
    educationEntries: educationSelection.selectedEntries,
    employmentHistory: employmentSelection.selectedEntries,
    projectExperiences: projectSelection.selectedEntries,
    requirementEntries: requirementSelection.selectedEntries
  };
  const candidateIdentityTerms = [
    selectedIdentity.candidateName,
    selectedIdentity.candidateLocation,
    rawSectionExtractions.identity.candidateNameFromBlocks,
    rawSectionExtractions.identity.candidateLocationFromBlocks,
    rawSectionExtractions.sourceBoundProfile.candidateName,
    rawSectionExtractions.sourceBoundProfile.candidateLocation
  ].filter(Boolean);
  const roleTerms = [
    selectedIdentity.roleTitle,
    rawSectionExtractions.identity.roleTitleFromBlocks,
    rawSectionExtractions.sourceBoundProfile.roleTitle
  ].filter(Boolean);

  const candidateSchema = {
    identity: {
      name: cleanLine(profile.candidateName),
      location: cleanLine(profile.candidateLocation),
      confidence: 'high',
      validationFlags: collectCandidateIdentityValidationFlags(profile.candidateName),
      sourceRefs: selectSourceRefs(cvSourceDocument?.blocks || [], {
        preferredSectionKeys: ['overview', 'experience', 'unknown'],
        terms: candidateIdentityTerms
      })
    },
    education: normalizeEducationEntries(profile.educationEntries || [], cvSourceDocument?.blocks || []),
    employmentHistory: normalizeEmploymentEntries(profile.employmentHistory || [], cvSourceDocument?.blocks || [])
  };

  candidateSchema.projectExperiences = normalizeProjectEntries(
    profile.projectExperiences || [],
    cvSourceDocument?.blocks || [],
    candidateSchema.employmentHistory
  );
  candidateSchema.identity.confidence = candidateSchema.identity.validationFlags.length === 0
    ? (cleanLine(profile.candidateName) ? 'high' : 'low')
    : 'low';

  const jdSchema = {
    role: {
      title: cleanLine(profile.roleTitle),
      company: '',
      confidence: cleanLine(profile.roleTitle) ? 'high' : 'low',
      validationFlags: [],
      sourceRefs: selectSourceRefs(jdSourceDocument?.blocks || [], {
        preferredSectionKeys: ['overview'],
        terms: roleTerms
      })
    },
    requirements: normalizeRequirementEntries(
      profile.requirementEntries || [],
      jdSourceDocument?.blocks || [],
      profile.roleTitle
    )
  };

  const validationSummary = buildCanonicalValidationSummary({
    candidateSchema,
    jdSchema
  });

  return {
    schemaVersion: 1,
    sourceModel: resolvedSourceModel,
    sectionExtractions: {
      identity: {
        candidateNameFromBlocks: cleanLine(rawSectionExtractions.identity.candidateNameFromBlocks),
        candidateLocationFromBlocks: cleanLine(rawSectionExtractions.identity.candidateLocationFromBlocks),
        sourceBoundCandidateName: cleanLine(rawSectionExtractions.sourceBoundProfile.candidateName),
        sourceBoundCandidateLocation: cleanLine(rawSectionExtractions.sourceBoundProfile.candidateLocation),
        selectedCandidateName: cleanLine(selectedIdentity.candidateName),
        selectedCandidateLocation: cleanLine(selectedIdentity.candidateLocation),
        candidateNameSelectionSource: selectedIdentity.candidateNameSelectionSource,
        candidateLocationSelectionSource: selectedIdentity.candidateLocationSelectionSource,
        validationFlags: candidateSchema.identity.validationFlags,
        roleTitleFromBlocks: cleanLine(rawSectionExtractions.identity.roleTitleFromBlocks),
        sourceBoundRoleTitle: cleanLine(rawSectionExtractions.sourceBoundProfile.roleTitle),
        selectedRoleTitle: cleanLine(selectedIdentity.roleTitle),
        roleTitleSelectionSource: selectedIdentity.roleTitleSelectionSource,
        candidateSourceRefs: selectSourceRefs(cvSourceDocument?.blocks || [], {
          preferredSectionKeys: ['overview', 'unknown', 'experience'],
          terms: candidateIdentityTerms
        }),
        roleSourceRefs: selectSourceRefs(jdSourceDocument?.blocks || [], {
          preferredSectionKeys: ['overview'],
          terms: roleTerms
        })
      },
      education: {
        sectionEntries: rawSectionExtractions.education.sectionEntries,
        fallbackEntries: rawSectionExtractions.education.fallbackEntries,
        selectedEntries: educationSelection.selectedEntries,
        selectionSource: educationSelection.selectionSource,
        sourceRefs: selectSourceRefs(cvSourceDocument?.blocks || [], {
          preferredSectionKeys: ['education']
        })
      },
      employmentHistory: {
        sectionEntries: employmentSelection.sectionEntries,
        fallbackEntries: employmentSelection.fallbackEntries,
        selectedEntries: employmentSelection.selectedEntries,
        selectionSource: employmentSelection.selectionSource,
        sourceRefs: selectSourceRefs(cvSourceDocument?.blocks || [], {
          preferredSectionKeys: ['experience']
        })
      },
      projectExperiences: {
        sectionEntries: rawSectionExtractions.projectExperiences.sectionEntries,
        fallbackEntries: rawSectionExtractions.projectExperiences.fallbackEntries,
        selectedEntries: projectSelection.selectedEntries,
        selectedOrigins: projectSelection.selectedOrigins,
        selectionSource: projectSelection.selectionSource,
        sourceRefs: selectSourceRefs(cvSourceDocument?.blocks || [], {
          preferredSectionKeys: ['projects']
        })
      },
      jdRequirements: {
        sectionEntries: requirementSelection.sectionEntries,
        fallbackEntries: requirementSelection.fallbackEntries,
        selectedEntries: requirementSelection.selectedEntries,
        selectionSource: requirementSelection.selectionSource,
        sourceRefs: selectSourceRefs(jdSourceDocument?.blocks || [], {
          preferredSectionKeys: ['requirements']
        })
      }
    },
    candidateSchema,
    jdSchema,
    validationSummary
  };
}

function buildCanonicalSchemas({ cvDocument, jdDocument, sourceModel = null } = {}) {
  const review = buildCanonicalExtractionReview({ cvDocument, jdDocument, sourceModel });

  return {
    schemaVersion: review.schemaVersion,
    candidateSchema: review.candidateSchema,
    jdSchema: review.jdSchema,
    validationSummary: review.validationSummary
  };
}

module.exports = {
  buildCanonicalExtractionReview,
  buildCanonicalSchemas
};

const fs = require('node:fs/promises');
const path = require('node:path');

const DocxtemplaterModule = require('docxtemplater');
const PizZip = require('pizzip');

const { extractCandidateName, extractRoleTitle } = require('./summary-service');

const Docxtemplater = DocxtemplaterModule.default || DocxtemplaterModule;

const SECTION_KEY_BY_HEADING = {
  Candidate: 'candidate_name',
  'Target Role': 'role_title',
  'Fit Summary': 'fit_summary',
  'Why This Candidate May Be a Fit': 'fit_summary',
  'Relevant Experience': 'relevant_experience',
  'Match Against Key Requirements': 'match_requirements',
  'Potential Concerns / Gaps': 'potential_concerns',
  'Recommended Next Step': 'recommended_next_step',
  候选人: 'candidate_name',
  目标职位: 'role_title',
  匹配概述: 'fit_summary',
  相关经验: 'relevant_experience',
  '与关键要求的匹配': 'match_requirements',
  '潜在顾虑 / 差距': 'potential_concerns',
  建议下一步: 'recommended_next_step'
};

const SUMMARY_FIELD_KEY_BY_LABEL = {
  candidate: 'candidate_name',
  'target role': 'role_title',
  候选人: 'candidate_name',
  目标职位: 'role_title'
};

const SUPPORTED_WORD_TEMPLATE_TAGS = [
  'candidate_name',
  'hiring_manager',
  'role_title',
  'employment_history',
  'fit_summary',
  'employment_experience',
  'relevant_experience',
  'match_requirements',
  'potential_concerns',
  'recommended_next_step',
  'candidate_summary',
  'candidate_gender',
  'candidate_nationality',
  'candidate_location',
  'candidate_preferred_location',
  'candidate_languages',
  'candidate_language_1',
  'candidate_language_2',
  'notice_period',
  'education_entries',
  'education_summary',
  'degree_name',
  'university',
  'start_year',
  'end_year',
  'job_title',
  'company_name',
  'start_date',
  'end_date',
  'responsibilities',
  'responsibility',
  'job_responsibility_1',
  'job_responsibility_2',
  'generation_date',
  'generation_timestamp'
];

const TEMPLATE_TAG_ALIASES = {
  candidate_name: 'candidate_name',
  Candidate_Name: 'candidate_name',
  role_title: 'role_title',
  'Hiring Manager': 'hiring_manager',
  Candidate_Summary: 'candidate_summary',
  Canddidate_Gender: 'candidate_gender',
  Candidate_nationality: 'candidate_nationality',
  Candidate_Location: 'candidate_location',
  Candidate_Preferred_Location: 'candidate_preferred_location',
  Candidate_Languages: 'candidate_languages',
  'Candidate_Language 1': 'candidate_language_1',
  'Candidate_Language 2': 'candidate_language_2',
  Notice_Period: 'notice_period',
  Education_Summary: 'education_summary',
  Degree_Name: 'degree_name',
  University: 'university',
  'Start Year': 'start_year',
  End_Year: 'end_year',
  'Job Title': 'job_title',
  'Company Name': 'company_name',
  Start_date: 'start_date',
  End_Date: 'end_date',
  Job_responsibility_1: 'job_responsibility_1',
  Job_responsibility_2: 'job_responsibility_2'
};

const DOCX_MAIN_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const DOTX_MAIN_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml';
const DEGREE_LINE_PATTERN =
  /\b(bachelor|master|phd|doctor|mba|b\.?sc|m\.?sc|ba|ma|degree|diploma)\b/i;
const YEAR_RANGE_PATTERN =
  /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?((?:19|20)\d{2})(?:[./-]\d{1,2})?\s*[–-]\s*(Present|Current|Now|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?((?:19|20)\d{2})(?:[./-]\d{1,2})?)/i;
const EDUCATION_ORG_PATTERN = /\b(university|college|school|institute|academy)\b/i;
const COMPANY_HINT_PATTERN =
  /\b(group|company|corp|corporation|inc|inc\.|ltd|limited|llc|plc|pte|partners|solutions|technologies|technology|systems|bank|capital|consulting|advisors|advisory|recruitment|staffing|search|university|college|school)\b/i;
const ROLE_TITLE_PATTERN =
  /\b(head|director|manager|lead|principal|engineer|developer|architect|consultant|analyst|specialist|officer|president|vice president|vp|associate|recruiter|coordinator|administrator|designer|product owner|product manager|program manager|project manager)\b|(?:软件|后端|前端|全栈|区块链|测试|运维|数据|算法|研发|系统)?(?:工程师|开发|架构师|经理|总监|负责人|顾问|分析师|研究员|实习生|产品经理|技术负责人)/i;
const ORGANIZATION_ACRONYM_PATTERN = /^(?:[A-Z][A-Z0-9&.-]{1,}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})$/;
const PDF_PAGE_ARTIFACT_PATTERN = /^(?:[-–—=\s]*)?(?:page\s+)?\d+\s+of\s+\d+(?:\s*[-–—=\s]*)?$/i;
const DECORATION_LINE_PATTERN = /^[-–—=\s]+$/;
const EXPERIENCE_SUBHEADING_PATTERN =
  /^(?:responsibilities|talent acquisition|team leadership(?:\s*&\s*development)?|system expert\/trainer|campaign(?:\s*&\s*initiatives)?|key achievement|key achievements|core expertise)\s*:?\s*$/i;
const KNOWN_LOCATION_LINE_SET = new Set([
  'australia',
  'beijing',
  'canada',
  'china',
  'dubai',
  'france',
  'germany',
  'hong kong',
  'hong kong sar',
  'india',
  'indonesia',
  'japan',
  'london',
  'malaysia',
  'new york',
  'paris',
  'philippines',
  'san francisco',
  'shanghai',
  'shenzhen',
  'singapore',
  'sydney',
  'taiwan',
  'thailand',
  'tokyo',
  'united arab emirates',
  'united kingdom',
  'united states',
  'usa',
  '上海',
  '北京',
  '深圳',
  '广州',
  '杭州',
  '南京',
  '苏州',
  '成都',
  '香港',
  '香港特别行政区',
  '新加坡',
  '中国',
  '英国',
  '美国',
  '日本'
]);
const SECTION_NAME_TO_KEY = {
  experience: 'experience',
  'employment experience': 'experience',
  'professional experience': 'experience',
  'project experience': 'projects',
  工作经历: 'experience',
  工作经验: 'experience',
  职业经历: 'experience',
  项目经历: 'projects',
  education: 'education',
  教育背景: 'education',
  教育经历: 'education',
  skills: 'skills',
  language: 'languages',
  languages: 'languages',
  语言: 'languages',
  availability: 'availability',
  'notice period': 'availability',
  到岗时间: 'availability',
  可到岗时间: 'availability'
};

function normalizeTextBlock(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function splitNonEmptyLines(value) {
  return normalizeTextBlock(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeHeadingKey(value) {
  return normalizeTextBlock(value)
    .replace(/^#+\s*/, '')
    .replace(/[:：]$/, '')
    .toLowerCase();
}

function isKnownCvSectionHeading(value) {
  return Object.prototype.hasOwnProperty.call(SECTION_NAME_TO_KEY, normalizeHeadingKey(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanBulletPrefix(value) {
  return normalizeTextBlock(value).replace(/^(?:[-*•–—]|l)\s*/i, '');
}

function isPdfArtifactLine(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized) {
    return false;
  }

  return PDF_PAGE_ARTIFACT_PATTERN.test(normalized) || DECORATION_LINE_PATTERN.test(normalized);
}

function isContactLine(value) {
  return /@|https?:\/\/|linkedin|^\+?[\d()\s-]{7,}$/.test(value);
}

function looksLikeRoleTitleLine(value) {
  return ROLE_TITLE_PATTERN.test(normalizeTextBlock(value));
}

function looksLikeLocationLine(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized || /\d/.test(normalized)) {
    return false;
  }

  const normalizedKey = normalized.toLowerCase();

  if (KNOWN_LOCATION_LINE_SET.has(normalizedKey)) {
    return true;
  }

  if (/^[\u4e00-\u9fff]{2,8}$/.test(normalized)) {
    return KNOWN_LOCATION_LINE_SET.has(normalized) ||
      /(?:市|省|区|县|国|特别行政区)$/.test(normalized);
  }

  if (normalized.includes(',') && normalized.split(/\s+/).length <= 5) {
    return normalized
      .split(',')
      .map((part) => part.trim())
      .every((part) => /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*$/.test(part));
  }

  return false;
}

function stripTrailingLocationSuffix(value) {
  const normalized = normalizeTextBlock(value);
  const match = normalized.match(/^(.*?)\s+\|\s+(.+)$/);

  if (!match) {
    return normalized;
  }

  return looksLikeLocationLine(match[2]) ? match[1].trim() : normalized;
}

function isResponsibilityBulletLine(value) {
  return /^(?:[-*•–—]|l)\s*/i.test(normalizeTextBlock(value));
}

function isLikelySectionSubheading(value) {
  const normalized = normalizeTextBlock(value);
  const candidate = normalized.replace(/:\s*$/, '');

  if (!candidate) {
    return false;
  }

  if (EXPERIENCE_SUBHEADING_PATTERN.test(candidate)) {
    return true;
  }

  if (
    isKnownCvSectionHeading(candidate) ||
    isPdfArtifactLine(candidate) ||
    looksLikeLocationLine(candidate) ||
    isResponsibilityBulletLine(candidate) ||
    YEAR_RANGE_PATTERN.test(candidate)
  ) {
    return false;
  }

  if (looksLikeRoleTitleLine(candidate) || looksLikeCompanyLine(candidate)) {
    return false;
  }

  return (
    candidate.length <= 64 &&
    /^[A-Z][A-Za-z0-9/&(),'\- ]+$/.test(candidate) &&
    !/[.?!]$/.test(candidate)
  );
}

function parseCvSections(cvText) {
  const lines = splitNonEmptyLines(cvText);
  const sections = {};
  let currentSection = null;

  for (const line of lines) {
    const sectionKey = SECTION_NAME_TO_KEY[normalizeHeadingKey(line)];

    if (sectionKey) {
      currentSection = sectionKey;
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  return {
    lines,
    sections
  };
}

function extractLabeledValue(lines, labels) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const label of labels) {
      const inlineMatch = line.match(new RegExp(`^${escapeRegExp(label)}\\s*[:：]?\\s*(.+)$`, 'i'));

      if (inlineMatch && inlineMatch[1]) {
        return inlineMatch[1].trim();
      }

      if (normalizeHeadingKey(line) === normalizeHeadingKey(label) && lines[index + 1]) {
        return lines[index + 1].trim();
      }
    }
  }

  return '';
}

function extractEarlyLocation(lines, candidateName) {
  for (const line of lines.slice(1, 8)) {
    if (!line || line === candidateName || isContactLine(line)) {
      continue;
    }

    if (isKnownCvSectionHeading(line)) {
      continue;
    }

    if (looksLikeLocationLine(line)) {
      return line;
    }
  }

  return '';
}

function extractLanguageList(lines, sectionLines = []) {
  const inlineValue = extractLabeledValue(lines, ['Languages', 'Language', '语言']);
  const rawValues = [
    inlineValue,
    ...(Array.isArray(sectionLines) ? sectionLines : [])
  ].filter(Boolean);

  if (rawValues.length === 0) {
    return [];
  }

  return [...new Set(rawValues
    .flatMap((value) => String(value).split(/[,/;|]+/))
    .map((value) => value.trim())
    .filter(Boolean))];
}

function extractEducationDetails(sectionLines = []) {
  const educationEntries = extractEducationEntries(sectionLines);

  if (educationEntries.length > 0) {
    const firstEducationEntry = educationEntries[0];

    return {
      degreeName: firstEducationEntry.degreeName,
      university: firstEducationEntry.university,
      startYear: firstEducationEntry.startYear,
      endYear: firstEducationEntry.endYear
    };
  }

  const yearLine = sectionLines.find((line) => YEAR_RANGE_PATTERN.test(line)) || '';
  const yearMatch = yearLine.match(YEAR_RANGE_PATTERN);
  const startYear = yearMatch?.[1] || '';
  const endYear = yearMatch?.[3] || (yearMatch?.[2] && !/present|current|now/i.test(yearMatch[2]) ? yearMatch[2] : '');
  const degreeName = sectionLines.find((line) => DEGREE_LINE_PATTERN.test(line)) || '';
  const university = sectionLines.find((line) => EDUCATION_ORG_PATTERN.test(line)) || '';

  return {
    degreeName,
    university,
    startYear,
    endYear
  };
}

function parseEducationEntry(sectionLines = []) {
  const normalizedLines = sectionLines
    .map(normalizeTextBlock)
    .filter((line) => line && !isPdfArtifactLine(line) && !isKnownCvSectionHeading(line));

  if (normalizedLines.length === 0) {
    return null;
  }

  const yearLine = normalizedLines.find((line) => YEAR_RANGE_PATTERN.test(line)) || '';
  const yearMatch = yearLine.match(YEAR_RANGE_PATTERN);
  const startYear = yearMatch?.[1] || '';
  const endYear = yearMatch?.[3] || (yearMatch?.[2] && !/present|current|now/i.test(yearMatch[2]) ? yearMatch[2] : '');
  const degreeName = normalizedLines.find((line) => DEGREE_LINE_PATTERN.test(line)) ||
    normalizedLines.find((line) => !YEAR_RANGE_PATTERN.test(line) && !EDUCATION_ORG_PATTERN.test(line)) ||
    '';
  const university = normalizedLines.find((line) => EDUCATION_ORG_PATTERN.test(line)) || '';

  if (!degreeName && !university && !startYear && !endYear) {
    return null;
  }

  return {
    degreeName,
    university,
    startYear,
    endYear
  };
}

function extractEducationEntries(sectionLines = []) {
  const lines = sectionLines
    .map(normalizeTextBlock)
    .filter((line) => line && !isPdfArtifactLine(line));

  if (lines.length === 0) {
    return [];
  }

  const yearLineIndices = lines
    .map((line, index) => (YEAR_RANGE_PATTERN.test(line) ? index : -1))
    .filter((index) => index >= 0);

  if (yearLineIndices.length === 0) {
    const singleEntry = parseEducationEntry(lines);
    return singleEntry ? [singleEntry] : [];
  }

  const entries = [];
  let cursor = 0;

  for (const yearLineIndex of yearLineIndices) {
    const entry = parseEducationEntry(lines.slice(cursor, yearLineIndex + 1));
    if (entry) {
      entries.push(entry);
    }
    cursor = yearLineIndex + 1;
  }

  if (cursor < lines.length && entries.length > 0) {
    const trailingEntry = parseEducationEntry(lines.slice(cursor));
    if (trailingEntry) {
      entries.push(trailingEntry);
    }
  }

  return entries;
}

function extractDateRange(value) {
  const match = value.match(YEAR_RANGE_PATTERN);

  if (!match) {
    return {
      startDate: '',
      endDate: ''
    };
  }

  return {
    startDate: match[1] || '',
    endDate: match[3] || match[2] || ''
  };
}

function splitRoleCompanyLine(value) {
  const normalized = stripTrailingLocationSuffix(value);

  if (!normalized) {
    return {
      jobTitle: '',
      companyName: ''
    };
  }

  const separators = [/\s+\|\s+/i, /\s+at\s+/i, /\s+@\s+/i];

  for (const separator of separators) {
    const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
      const candidateCompanyName = parts[1];

      return {
        jobTitle: parts[0],
        companyName: looksLikeLocationLine(candidateCompanyName) ? '' : candidateCompanyName
      };
    }
  }

  return {
    jobTitle: normalized,
    companyName: ''
  };
}

function looksLikeOrganizationText(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized) {
    return false;
  }

  return looksLikeCompanyLine(normalized) ||
    /[（(].+[)）]/.test(normalized) ||
    /\b(?:team|department|lab|studio)\b/i.test(normalized) ||
    /(?:公司|集团|大学|学院|研究所|科技|信息|银行|证券|招聘|工作室|部门|研发部)/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9&._-]*(?:\s+[A-Za-z0-9&._-]+)*$/.test(normalized);
}

function splitInlineCompanyRoleRemainder(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized) {
    return {
      companyName: '',
      jobTitle: ''
    };
  }

  const chineseSuffixMatch = normalized.match(
    /^(.*?)(软件工程师|后端工程师|前端工程师|全栈工程师|区块链工程师|开发工程师|测试工程师|运维工程师|数据工程师|算法工程师|工程师|架构师|产品经理|技术负责人|负责人|经理|总监|顾问|分析师|研究员|实习生)\s*$/
  );

  if (chineseSuffixMatch) {
    const companyName = chineseSuffixMatch[1].trim();
    const jobTitle = chineseSuffixMatch[2].trim();

    if (looksLikeOrganizationText(companyName)) {
      return {
        companyName,
        jobTitle
      };
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (let index = 1; index < tokens.length; index += 1) {
    const companyName = tokens.slice(0, index).join(' ').trim();
    const jobTitle = tokens.slice(index).join(' ').trim();

    if (looksLikeOrganizationText(companyName) && looksLikeRoleTitleLine(jobTitle) && !looksLikeCompanyLine(jobTitle)) {
      return {
        companyName,
        jobTitle
      };
    }
  }

  return {
    companyName: '',
    jobTitle: normalized
  };
}

function looksLikeCompanyLine(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized) {
    return false;
  }

  if (COMPANY_HINT_PATTERN.test(normalized)) {
    return true;
  }

  if (looksLikeRoleTitleLine(normalized)) {
    return false;
  }

  return ORGANIZATION_ACRONYM_PATTERN.test(normalized);
}

function looksLikeExperienceEntryLine(value) {
  const normalized = normalizeTextBlock(value);

  if (!normalized) {
    return false;
  }

  return (
    !isPdfArtifactLine(normalized) &&
    !isKnownCvSectionHeading(normalized) &&
    !isResponsibilityBulletLine(normalized) &&
    !YEAR_RANGE_PATTERN.test(normalized) &&
    !DEGREE_LINE_PATTERN.test(normalized)
  );
}

function splitCompanyDateLine(value) {
  const normalized = normalizeTextBlock(value);
  const match = normalized.match(YEAR_RANGE_PATTERN);

  if (!match || typeof match.index !== 'number') {
    return null;
  }

  const companyPrefix = normalized
    .slice(0, match.index)
    .replace(/[|,]\s*$/, '')
    .trim();
  const { startDate, endDate } = extractDateRange(normalized);

  return {
    companyName: companyPrefix && !looksLikeLocationLine(companyPrefix) ? companyPrefix : '',
    startDate,
    endDate
  };
}

function splitLeadingDateLine(value) {
  const normalized = normalizeTextBlock(value);
  const match = normalized.match(YEAR_RANGE_PATTERN);

  if (!match || typeof match.index !== 'number' || match.index !== 0) {
    return null;
  }

  const matchedRange = match[0].trim();
  const remainder = normalized
    .slice(match[0].length)
    .replace(/^[|,/-]\s*/, '')
    .trim();
  const { startDate, endDate } = extractDateRange(matchedRange);

  return {
    startDate,
    endDate,
    remainder
  };
}

function resolveExperienceHeading(primaryLine, secondaryLine = '') {
  let { jobTitle, companyName } = splitRoleCompanyLine(primaryLine);
  const normalizedSecondaryLine = normalizeTextBlock(secondaryLine);

  if (
    looksLikeCompanyLine(primaryLine) &&
    normalizedSecondaryLine &&
    looksLikeRoleTitleLine(normalizedSecondaryLine)
  ) {
    jobTitle = normalizedSecondaryLine;
    companyName = primaryLine;
    return {
      jobTitle,
      companyName
    };
  }

  if (!normalizedSecondaryLine) {
    return {
      jobTitle,
      companyName
    };
  }

  if (!companyName && looksLikeLocationLine(normalizedSecondaryLine)) {
    companyName = '';
  } else if (!companyName && looksLikeCompanyLine(normalizedSecondaryLine)) {
    companyName = normalizedSecondaryLine;
  } else if (looksLikeLocationLine(companyName)) {
    companyName = looksLikeCompanyLine(normalizedSecondaryLine) ? normalizedSecondaryLine : '';
  }

  return {
    jobTitle,
    companyName
  };
}

function detectExperienceEntry(lines, index) {
  const line = lines[index];
  const nextLine = lines[index + 1] || '';
  const nextNextLine = lines[index + 2] || '';
  const datedInlineEntry = detectDatedInlineExperienceEntry(line);

  if (datedInlineEntry) {
    return {
      ...datedInlineEntry,
      cursor: index + 1
    };
  }

  if (!looksLikeExperienceEntryLine(line) || !looksLikeRoleTitleLine(line)) {
    return null;
  }

  if (looksLikeLocationLine(nextLine)) {
    const companyDateLine = splitCompanyDateLine(nextNextLine);

    if (companyDateLine) {
      const resolvedHeading = resolveExperienceHeading(line, nextLine);

      return {
        jobTitle: resolvedHeading.jobTitle,
        companyName: companyDateLine.companyName,
        startDate: companyDateLine.startDate,
        endDate: companyDateLine.endDate,
        cursor: index + 3
      };
    }
  }

  const companyDateLine = splitCompanyDateLine(nextLine);

  if (companyDateLine) {
    const resolvedHeading = resolveExperienceHeading(line);

    return {
      jobTitle: resolvedHeading.jobTitle,
      companyName: companyDateLine.companyName,
      startDate: companyDateLine.startDate,
      endDate: companyDateLine.endDate,
      cursor: index + 2
    };
  }

  if (YEAR_RANGE_PATTERN.test(nextLine)) {
    const resolvedHeading = resolveExperienceHeading(line);
    const { startDate, endDate } = extractDateRange(nextLine);

    return {
      jobTitle: resolvedHeading.jobTitle,
      companyName: resolvedHeading.companyName,
      startDate,
      endDate,
      cursor: index + 2
    };
  }

  if (looksLikeExperienceEntryLine(nextLine) && YEAR_RANGE_PATTERN.test(nextNextLine)) {
    const resolvedHeading = resolveExperienceHeading(line, nextLine);
    const { startDate, endDate } = extractDateRange(nextNextLine);

    return {
      jobTitle: resolvedHeading.jobTitle,
      companyName: resolvedHeading.companyName,
      startDate,
      endDate,
      cursor: index + 3
    };
  }

  return null;
}

function detectDatedRoleLine(value) {
  const datedLine = splitLeadingDateLine(value);

  if (!datedLine || !datedLine.remainder || !looksLikeRoleTitleLine(datedLine.remainder)) {
    return null;
  }

  return datedLine;
}

function detectDatedInlineExperienceEntry(value) {
  const datedLine = splitLeadingDateLine(value);

  if (!datedLine || !datedLine.remainder) {
    return null;
  }

  const splitHeading = splitInlineCompanyRoleRemainder(datedLine.remainder);

  if (!splitHeading.jobTitle || !looksLikeRoleTitleLine(splitHeading.jobTitle)) {
    return null;
  }

  return {
    jobTitle: splitHeading.jobTitle,
    companyName: splitHeading.companyName,
    startDate: datedLine.startDate,
    endDate: datedLine.endDate
  };
}

function detectDatedCompanyRoleGroupStart(lines, index) {
  const companyLine = splitLeadingDateLine(lines[index]);
  const nextRoleLine = detectDatedRoleLine(lines[index + 1] || '');

  if (!companyLine || !companyLine.remainder || !looksLikeCompanyLine(companyLine.remainder) || !nextRoleLine) {
    return null;
  }

  return companyLine;
}

function collectExperienceResponsibilities(lines, startIndex) {
  const responsibilities = [];
  let cursor = startIndex;
  let activeResponsibilityIndex = -1;

  while (cursor < lines.length) {
    const currentLine = lines[cursor];

    if (isPdfArtifactLine(currentLine)) {
      cursor += 1;
      continue;
    }

    if (isKnownCvSectionHeading(currentLine)) {
      break;
    }

    if (
      detectDatedCompanyRoleGroupStart(lines, cursor) ||
      detectExperienceEntry(lines, cursor) ||
      detectDatedRoleLine(lines[cursor])
    ) {
      break;
    }

    if (splitCompanyDateLine(currentLine) && activeResponsibilityIndex >= 0) {
      break;
    }

    if (isLikelySectionSubheading(currentLine)) {
      cursor += 1;
      continue;
    }

    if (isResponsibilityBulletLine(currentLine)) {
      const cleanedResponsibility = cleanBulletPrefix(currentLine);

      if (!isPdfArtifactLine(cleanedResponsibility)) {
        responsibilities.push(cleanedResponsibility);
        activeResponsibilityIndex = responsibilities.length - 1;
      }

      cursor += 1;
      continue;
    }

    if (
      activeResponsibilityIndex >= 0 &&
      !looksLikeLocationLine(currentLine) &&
      !isKnownCvSectionHeading(currentLine)
    ) {
      responsibilities[activeResponsibilityIndex] = `${responsibilities[activeResponsibilityIndex]} ${currentLine}`.trim();
      cursor += 1;
      continue;
    }

    if (!looksLikeLocationLine(currentLine) && !isKnownCvSectionHeading(currentLine)) {
      responsibilities.push(currentLine);
      activeResponsibilityIndex = responsibilities.length - 1;
    }

    cursor += 1;
  }

  return {
    responsibilities,
    cursor
  };
}

function detectDatedCompanyRoleGroup(lines, index) {
  const companyLine = detectDatedCompanyRoleGroupStart(lines, index);

  if (!companyLine) {
    return null;
  }

  const entries = [];
  let cursor = index + 1;

  while (cursor < lines.length) {
    const roleLine = detectDatedRoleLine(lines[cursor]);

    if (!roleLine) {
      break;
    }

    entries.push({
      jobTitle: roleLine.remainder,
      companyName: companyLine.remainder,
      startDate: roleLine.startDate,
      endDate: roleLine.endDate,
      responsibilities: []
    });
    cursor += 1;
  }

  if (entries.length === 0) {
    return null;
  }

  const collectedResponsibilities = collectExperienceResponsibilities(lines, cursor);
  entries[0].responsibilities = collectedResponsibilities.responsibilities;

  return {
    entries,
    cursor: collectedResponsibilities.cursor
  };
}

function extractExperienceHistory(sectionLines = []) {
  const lines = sectionLines.map(normalizeTextBlock).filter(Boolean);
  const entries = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line || isResponsibilityBulletLine(line) || isPdfArtifactLine(line)) {
      index += 1;
      continue;
    }

    const groupedDateEntries = detectDatedCompanyRoleGroup(lines, index);

    if (groupedDateEntries) {
      entries.push(...groupedDateEntries.entries);
      index = groupedDateEntries.cursor;
      continue;
    }

    const detectedEntry = detectExperienceEntry(lines, index);

    if (!detectedEntry) {
      index += 1;
      continue;
    }

    const {
      jobTitle,
      companyName,
      startDate,
      endDate
    } = detectedEntry;
    const collectedResponsibilities = collectExperienceResponsibilities(lines, detectedEntry.cursor);

    entries.push({
      jobTitle,
      companyName,
      startDate,
      endDate,
      responsibilities: collectedResponsibilities.responsibilities
    });
    index = collectedResponsibilities.cursor;
  }

  if (entries.length > 0) {
    return entries;
  }

  const fallback = extractExperienceDetails(sectionLines);

  if (!fallback.jobTitle && !fallback.companyName && !fallback.startDate && !fallback.endDate) {
    return [];
  }

  return [{
    jobTitle: fallback.jobTitle,
    companyName: fallback.companyName,
    startDate: fallback.startDate,
    endDate: fallback.endDate,
    responsibilities: [fallback.responsibility1, fallback.responsibility2].filter(Boolean)
  }];
}

function scoreExperienceHistory(entries = []) {
  return entries.reduce((score, entry) => {
    const responsibilityCount = Array.isArray(entry.responsibilities) ? entry.responsibilities.length : 0;

    return score +
      (entry.jobTitle ? 20 : 0) +
      (entry.companyName ? 8 : 0) +
      (entry.startDate || entry.endDate ? 5 : 0) +
      (responsibilityCount * 4);
  }, 0);
}

function selectPreferredExperienceHistory(candidateHistories = []) {
  const normalizedCandidateHistories = candidateHistories
    .map((history) => Array.isArray(history) ? history.filter(Boolean) : [])
    .filter((history) => history.length > 0);

  if (normalizedCandidateHistories.length === 0) {
    return [];
  }

  return normalizedCandidateHistories
    .slice()
    .sort((left, right) => {
      if (right.length !== left.length) {
        return right.length - left.length;
      }

      return scoreExperienceHistory(right) - scoreExperienceHistory(left);
    })[0];
}

function formatEmploymentExperience(entries = []) {
  return entries
    .map((entry) => {
      const lines = [];
      const titleLine = [entry.jobTitle, entry.companyName].filter(Boolean).join(' | ');
      const dateLine = [entry.startDate, entry.endDate].filter(Boolean).join(' - ');

      if (titleLine) {
        lines.push(titleLine);
      }

      if (dateLine) {
        lines.push(dateLine);
      }

      for (const responsibility of entry.responsibilities || []) {
        if (responsibility) {
          lines.push(`- ${responsibility}`);
        }
      }

      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function extractExperienceDetails(sectionLines = []) {
  const bulletLines = sectionLines
    .filter((line) => isResponsibilityBulletLine(line))
    .map(cleanBulletPrefix);
  const dateLineIndex = sectionLines.findIndex((line) => YEAR_RANGE_PATTERN.test(line));
  let titleLine = '';
  let dateLine = '';

  if (dateLineIndex >= 0) {
    dateLine = sectionLines[dateLineIndex];
    const neighbors = [
      sectionLines[dateLineIndex - 1],
      sectionLines[dateLineIndex + 1]
    ].filter(Boolean);

    titleLine = neighbors.find((line) => !isResponsibilityBulletLine(line) && !YEAR_RANGE_PATTERN.test(line)) || '';
  }

  if (!titleLine) {
    titleLine = sectionLines.find((line) => {
      return line &&
        !isResponsibilityBulletLine(line) &&
        !YEAR_RANGE_PATTERN.test(line) &&
        !DEGREE_LINE_PATTERN.test(line) &&
        !isLikelySectionSubheading(line);
    }) || '';
  }

  const { jobTitle, companyName } = splitRoleCompanyLine(titleLine);
  const { startDate, endDate } = extractDateRange(dateLine);

  return {
    jobTitle,
    companyName,
    startDate,
    endDate,
    responsibility1: bulletLines[0] || '',
    responsibility2: bulletLines[1] || ''
  };
}

function extractHiringManagerTarget(jdText) {
  const lines = splitNonEmptyLines(jdText);
  return extractLabeledValue(lines, ['Hiring Manager', 'Company', 'Organization', 'Client', 'Employer', '招聘经理', '公司', '客户']);
}

function extractRoleTitleFromJd(jdText, fileName) {
  const lines = splitNonEmptyLines(jdText);
  const labels = ['Job title', 'Role', 'Position', 'Title', '职位', '岗位', '职位名称'];
  let labeledTitle = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const label of labels) {
      const inlineMatch = line.match(new RegExp(`^${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`, 'i'));

      if (inlineMatch?.[1]) {
        labeledTitle = inlineMatch[1].trim();
        break;
      }

      if (normalizeHeadingKey(line) === normalizeHeadingKey(label) && lines[index + 1]) {
        labeledTitle = lines[index + 1].trim();
        break;
      }
    }

    if (labeledTitle) {
      break;
    }
  }

  if (
    labeledTitle &&
    !/^(about the job|job description|job summary|overview|responsibilities|requirements|信息|概述|说明)$/i.test(labeledTitle)
  ) {
    return labeledTitle;
  }

  return extractRoleTitle(jdText, fileName);
}

function extractDocumentDerivedProfile({ cvDocument, jdDocument }) {
  const cvText = cvDocument?.text || '';
  const jdText = jdDocument?.text || '';
  const { lines, sections } = parseCvSections(cvText);
  const candidateName = extractCandidateName(cvText, cvDocument?.file?.name || 'candidate');
  const roleTitle = extractRoleTitleFromJd(jdText, jdDocument?.file?.name || 'role');
  const candidateLanguages = extractLanguageList(lines, sections.languages || []);
  const [candidateLanguage1, candidateLanguage2] = candidateLanguages;
  const educationEntries = extractEducationEntries((sections.education && sections.education.length > 0) ? sections.education : lines);
  const education = educationEntries[0] || extractEducationDetails((sections.education && sections.education.length > 0) ? sections.education : lines);
  const sectionExperienceHistory =
    sections.experience && sections.experience.length > 0
      ? extractExperienceHistory(sections.experience)
      : [];
  const fullCvExperienceHistory = extractExperienceHistory(lines);
  const experienceHistory = selectPreferredExperienceHistory([
    sectionExperienceHistory,
    fullCvExperienceHistory
  ]);
  const experience = experienceHistory[0] || extractExperienceDetails((sections.experience && sections.experience.length > 0) ? sections.experience : lines);

  return {
    candidateName,
    roleTitle,
    hiringManager: extractHiringManagerTarget(jdText),
    candidateGender: extractLabeledValue(lines, ['Gender', '性别']),
    candidateNationality: extractLabeledValue(lines, ['Nationality', 'Citizenship', '国籍']),
    candidateLocation:
      extractLabeledValue(lines, ['Current location', 'Location', 'Based in', '当前地点', '所在地', '地点']) ||
      extractEarlyLocation(lines, candidateName),
    candidatePreferredLocation: extractLabeledValue(lines, ['Preferred location', 'Preferred Location', 'Preferred locations', 'Preferred working location', '意向地点', '期望地点']),
    candidateLanguages,
    candidateLanguage1,
    candidateLanguage2,
    noticePeriod: extractLabeledValue(lines, ['Notice period', 'Availability', '到岗时间', '可到岗时间']) || (sections.availability || [])[0] || '',
    educationEntries,
    degreeName: education.degreeName,
    university: education.university,
    startYear: education.startYear,
    endYear: education.endYear,
    jobTitle: experience.jobTitle,
    companyName: experience.companyName,
    startDate: experience.startDate,
    endDate: experience.endDate,
    jobResponsibility1: experience.responsibilities?.[0] || experience.responsibility1 || '',
    jobResponsibility2: experience.responsibilities?.[1] || experience.responsibility2 || '',
    employmentHistory: experienceHistory
  };
}

function parseStructuredSummary(summary) {
  const sections = {};
  const lines = normalizeTextBlock(summary).split('\n');
  let currentKey = null;
  let currentBuffer = [];

  function flushSection() {
    if (!currentKey) {
      currentBuffer = [];
      return;
    }

    sections[currentKey] = normalizeTextBlock(currentBuffer.join('\n'));
    currentBuffer = [];
  }

  for (const line of lines) {
    const labelMatch = line.match(/^([^:：]+)[:：]\s*(.+)$/);

    if (labelMatch) {
      const fieldKey = SUMMARY_FIELD_KEY_BY_LABEL[normalizeHeadingKey(labelMatch[1])];

      if (fieldKey) {
        flushSection();
        sections[fieldKey] = normalizeTextBlock(labelMatch[2]);
        currentKey = null;
        continue;
      }
    }

    const normalizedHeading = normalizeHeadingKey(line);
    const headingMatch = line.match(/^##+\s+(.+)$/);
    const headingSource = headingMatch ? headingMatch[1] : normalizedHeading;
    const sectionKey = SECTION_KEY_BY_HEADING[headingSource] || SECTION_KEY_BY_HEADING[line.replace(/^##+\s+/, '').trim()];

    if (headingMatch || (sectionKey && !/^[-*•]\s*/.test(line))) {
      flushSection();
      currentKey = sectionKey || null;
      continue;
    }

    if (currentKey) {
      currentBuffer.push(line);
    }
  }

  flushSection();
  return sections;
}

function buildTemplateData({ summary, cvDocument, jdDocument }) {
  const sections = parseStructuredSummary(summary);
  const profile = extractDocumentDerivedProfile({ cvDocument, jdDocument });
  const generationDate = new Date();
  const fitSummary = sections.fit_summary || normalizeTextBlock(summary);
  const educationEntries = (profile.educationEntries || []).map((entry) => ({
    degree_name: entry.degreeName,
    university: entry.university,
    start_year: entry.startYear,
    end_year: entry.endYear
  }));

  const baseData = {
    candidate_name: sections.candidate_name || profile.candidateName,
    hiring_manager: profile.hiringManager,
    role_title: sections.role_title || profile.roleTitle,
    employment_history: profile.employmentHistory.map((entry) => ({
      job_title: entry.jobTitle,
      company_name: entry.companyName,
      start_date: entry.startDate,
      end_date: entry.endDate,
      responsibilities: (entry.responsibilities || []).map((responsibility) => ({
        responsibility
      }))
    })),
    fit_summary: fitSummary,
    employment_experience: formatEmploymentExperience(profile.employmentHistory),
    relevant_experience: sections.relevant_experience || '',
    match_requirements: sections.match_requirements || '',
    potential_concerns: sections.potential_concerns || '',
    recommended_next_step: sections.recommended_next_step || '',
    candidate_summary: sections.candidate_summary || fitSummary,
    candidate_gender: profile.candidateGender,
    candidate_nationality: profile.candidateNationality,
    candidate_location: profile.candidateLocation,
    candidate_preferred_location: profile.candidatePreferredLocation,
    candidate_languages: (profile.candidateLanguages || []).join(', '),
    candidate_language_1: profile.candidateLanguage1,
    candidate_language_2: profile.candidateLanguage2,
    notice_period: profile.noticePeriod,
    education_entries: educationEntries,
    education_summary: educationEntries
      .map((entry) => {
        const lines = [];
        if (entry.degree_name) {
          lines.push(entry.degree_name);
        }
        const organizationLine = [entry.university, [entry.start_year, entry.end_year].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
        if (organizationLine) {
          lines.push(organizationLine);
        }
        return lines.join('\n');
      })
      .filter(Boolean)
      .join('\n\n'),
    degree_name: profile.degreeName,
    university: profile.university,
    start_year: profile.startYear,
    end_year: profile.endYear,
    job_title: profile.jobTitle,
    company_name: profile.companyName,
    start_date: profile.startDate,
    end_date: profile.endDate,
    job_responsibility_1: profile.employmentHistory[0]?.responsibilities?.[0] || profile.jobResponsibility1,
    job_responsibility_2: profile.employmentHistory[0]?.responsibilities?.[1] || profile.jobResponsibility2,
    generation_date: generationDate.toISOString().slice(0, 10),
    generation_timestamp: generationDate.toISOString()
  };

  return {
    ...baseData,
    Candidate_Name: baseData.candidate_name,
    'Hiring Manager': baseData.hiring_manager,
    Candidate_Summary: baseData.fit_summary,
    Canddidate_Gender: baseData.candidate_gender,
    Candidate_nationality: baseData.candidate_nationality,
    Candidate_Location: baseData.candidate_location,
    Candidate_Preferred_Location: baseData.candidate_preferred_location,
    Candidate_Languages: baseData.candidate_languages,
    'Candidate_Language 1': baseData.candidate_language_1,
    'Candidate_Language 2': baseData.candidate_language_2,
    Notice_Period: baseData.notice_period,
    Education_Summary: baseData.education_summary,
    Degree_Name: baseData.degree_name,
    University: baseData.university,
    'Start Year': baseData.start_year,
    End_Year: baseData.end_year,
    'Job Title': baseData.job_title,
    'Company Name': baseData.company_name,
    Start_date: baseData.start_date,
    End_Date: baseData.end_date,
    Job_responsibility_1: baseData.job_responsibility_1,
    Job_responsibility_2: baseData.job_responsibility_2
  };
}

function describeEmploymentExtraction(cvDocument) {
  const cvText = cvDocument?.text || '';
  const { lines, sections } = parseCvSections(cvText);
  const experienceSectionLines = sections.experience || [];
  const dateWindows = [];

  lines.forEach((line, index) => {
    if (!YEAR_RANGE_PATTERN.test(line) || dateWindows.length >= 8) {
      return;
    }

    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length, index + 4);
    dateWindows.push(lines.slice(start, end).join(' || '));
  });

  return {
    cvFileName: cvDocument?.file?.name || '',
    cvLineCount: lines.length,
    experienceSectionLineCount: experienceSectionLines.length,
    experienceSectionPreview: experienceSectionLines.slice(0, 24),
    dateWindows
  };
}

function slugifyFilePart(value, fallback) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function buildSuggestedOutputFilename(templateData) {
  const candidatePart = slugifyFilePart(templateData.candidate_name, 'candidate');
  const rolePart = slugifyFilePart(templateData.role_title, 'role');
  return `${candidatePart}-${rolePart}-hiring-manager-summary.docx`;
}

function extractTextRunsFromXml(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"));
}

function extractTemplateTagsFromXml(xml) {
  const text = extractTextRunsFromXml(xml).join('');

  return [...new Set(
    [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
      .map((match) => match[1].trim())
      .filter(Boolean)
  )];
}

function getRelevantXmlFiles(zip) {
  return zip.file(/^(word\/document\.xml|word\/header\d+\.xml|word\/footer\d+\.xml)$/);
}

function inspectWordTemplate(zip) {
  const relevantFiles = getRelevantXmlFiles(zip);
  const detectedTags = [];

  for (const file of relevantFiles) {
    detectedTags.push(...extractTemplateTagsFromXml(file.asText()));
  }

  const uniqueDetectedTags = [...new Set(detectedTags)];
  const supportedDetectedTags = uniqueDetectedTags.filter((tag) => {
    const normalizedTag = tag.replace(/^[/#]/, '').trim();

    return SUPPORTED_WORD_TEMPLATE_TAGS.includes(normalizedTag) ||
      Object.prototype.hasOwnProperty.call(TEMPLATE_TAG_ALIASES, normalizedTag);
  });

  return {
    detectedTags: uniqueDetectedTags,
    supportedDetectedTags
  };
}

function describeTemplatePopulation(templateInspection, templateData) {
  const supportedTemplateTags = [...new Set(templateInspection.supportedDetectedTags)];
  const blankTemplateTags = [];
  const populatedTemplateTags = [];

  for (const tag of supportedTemplateTags) {
    const normalizedTag = tag.replace(/^[/#]/, '').trim();
    const resolvedKey = TEMPLATE_TAG_ALIASES[normalizedTag] || normalizedTag;

    if (normalizedTag === 'employment_history') {
      if (Array.isArray(templateData.employment_history) && templateData.employment_history.length > 0) {
        populatedTemplateTags.push(tag);
      } else {
        blankTemplateTags.push(tag);
      }
      continue;
    }

    if (normalizedTag === 'responsibilities') {
      const hasResponsibilities = Array.isArray(templateData.employment_history) &&
        templateData.employment_history.some((entry) => Array.isArray(entry.responsibilities) && entry.responsibilities.length > 0);

      if (hasResponsibilities) {
        populatedTemplateTags.push(tag);
      } else {
        blankTemplateTags.push(tag);
      }
      continue;
    }

    if (normalizedTag === 'responsibility') {
      const hasResponsibilityValue = Array.isArray(templateData.employment_history) &&
        templateData.employment_history.some((entry) =>
          Array.isArray(entry.responsibilities) &&
          entry.responsibilities.some((item) => normalizeTextBlock(item.responsibility))
        );

      if (hasResponsibilityValue) {
        populatedTemplateTags.push(tag);
      } else {
        blankTemplateTags.push(tag);
      }
      continue;
    }

    const value = normalizeTextBlock(templateData[resolvedKey]);

    if (value) {
      populatedTemplateTags.push(tag);
    } else {
      blankTemplateTags.push(tag);
    }
  }

  return {
    populatedTemplateTags,
    blankTemplateTags
  };
}

function assertTemplateSupportsOutput(templateInspection) {
  if (templateInspection.supportedDetectedTags.length > 0) {
    return;
  }

  if (templateInspection.detectedTags.length === 0) {
    throw new Error(
      `The configured Word template does not contain any supported placeholders. Add tags such as ${SUPPORTED_WORD_TEMPLATE_TAGS.map((tag) => `{{${tag}}}`).join(', ')}.`
    );
  }

  throw new Error(
    `The configured Word template contains placeholders, but none are supported by this app. Supported placeholders are ${SUPPORTED_WORD_TEMPLATE_TAGS.map((tag) => `{{${tag}}}`).join(', ')}. Detected placeholders: ${templateInspection.detectedTags.map((tag) => `{{${tag}}}`).join(', ')}.`
  );
}

function normalizeWordPackageForOutput(zip, sourceExtension) {
  const contentTypesFile = zip.file('[Content_Types].xml');

  if (!contentTypesFile) {
    throw new Error('The Word template package is missing [Content_Types].xml.');
  }

  const wordXmlFileNames = Object.keys(zip.files).filter((fileName) => {
    return fileName.startsWith('word/') && fileName.endsWith('.xml');
  });

  for (const fileName of wordXmlFileNames) {
    const xmlFile = zip.file(fileName);

    if (!xmlFile) {
      continue;
    }

    const normalizedXml = normalizeWordXmlForOutput(xmlFile.asText());

    zip.file(fileName, normalizedXml);
  }

  if (sourceExtension !== '.dotx') {
    return;
  }

  const rootRelationshipsFile = zip.file('_rels/.rels');
  const appPropertiesFile = zip.file('docProps/app.xml');
  const contentTypesXml = contentTypesFile.asText();
  const normalizedContentTypesXml = contentTypesXml
    .replace(DOTX_MAIN_CONTENT_TYPE, DOCX_MAIN_CONTENT_TYPE)
    .replace(
      /<Override PartName="\/docProps\/custom\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.custom-properties\+xml"\s*\/>/g,
      ''
    );

  zip.file('[Content_Types].xml', normalizedContentTypesXml);

  if (rootRelationshipsFile) {
    const normalizedRelationshipsXml = rootRelationshipsFile
      .asText()
      .replace(
        /<Relationship[^>]+Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/custom-properties"[^>]*\/>/g,
        ''
      );

    zip.file('_rels/.rels', normalizedRelationshipsXml);
  }

  if (appPropertiesFile) {
    const normalizedAppPropertiesXml = appPropertiesFile
      .asText()
      .replace(/<Template>[\s\S]*?<\/Template>/, '<Template>Normal.dotm</Template>');

    zip.file('docProps/app.xml', normalizedAppPropertiesXml);
  }

  if (zip.file('docProps/custom.xml')) {
    zip.remove('docProps/custom.xml');
  }
}

function normalizeWordXmlForOutput(xml) {
  return String(xml || '')
    .replace(/<w:proofErr\b[^/>]*\/>/g, '')
    .replace(/<(w:[A-Za-z]+)\b([^>]*)>/, (_match, tagName, attributes) => {
      const ignorableMatch = attributes.match(/\smc:Ignorable="([^"]+)"/);

      if (!ignorableMatch) {
        return `<${tagName}${attributes}>`;
      }

      const declaredPrefixes = new Set(
        [...attributes.matchAll(/\sxmlns:([A-Za-z0-9]+)=/g)].map((match) => match[1])
      );
      const filteredPrefixes = ignorableMatch[1]
        .split(/\s+/)
        .filter(Boolean)
        .filter((prefix) => declaredPrefixes.has(prefix));
      const nextIgnorableAttribute = filteredPrefixes.length > 0
        ? ` mc:Ignorable="${filteredPrefixes.join(' ')}"`
        : '';
      const normalizedAttributes = attributes.replace(/\smc:Ignorable="([^"]+)"/, nextIgnorableAttribute);

      return `<${tagName}${normalizedAttributes}>`;
    });
}

function validateGeneratedWordDocument(buffer) {
  const zip = new PizZip(buffer);
  const contentTypesFile = zip.file('[Content_Types].xml');

  if (!contentTypesFile) {
    throw new Error('Generated Word package is missing [Content_Types].xml.');
  }

  const contentTypesXml = contentTypesFile.asText();

  if (!contentTypesXml.includes(DOCX_MAIN_CONTENT_TYPE)) {
    throw new Error('Generated Word package is missing the standard .docx main document content type.');
  }

  if (!zip.file('word/document.xml')) {
    throw new Error('Generated Word package is missing word/document.xml.');
  }
}

async function renderHiringManagerWordDocument({ templatePath, outputPath, templateData }) {
  const extension = path.extname(templatePath).toLowerCase();

  if (!['.docx', '.dotx'].includes(extension)) {
    throw new Error('Only .docx and .dotx hiring-manager templates are supported for automated output.');
  }

  const templateContent = await fs.readFile(templatePath);

  let document;
  let zip;

  try {
    zip = new PizZip(templateContent);
  } catch (error) {
    throw new Error(
      `The configured Word template could not be opened. Use a valid .docx or .dotx template. ${error.message}`
    );
  }

  const templateInspection = inspectWordTemplate(zip);
  assertTemplateSupportsOutput(templateInspection);
  const templatePopulation = describeTemplatePopulation(templateInspection, templateData);

  try {
    document = new Docxtemplater(zip, {
      delimiters: {
        start: '{{',
        end: '}}'
      },
      paragraphLoop: true,
      linebreaks: true
    });
  } catch (error) {
    throw new Error(
      `The configured Word template could not be initialized for output rendering. ${error.message}`
    );
  }

  try {
    document.render(templateData);
  } catch (error) {
    const nestedErrors = error?.properties?.errors || [];
    const nestedMessages = nestedErrors
      .map((entry) => entry.properties?.explanation || entry.message)
      .filter(Boolean);

    throw new Error(
      [
        'The Word template could not be rendered.',
        nestedMessages[0] || error.message,
        'Supported placeholders: ' + SUPPORTED_WORD_TEMPLATE_TAGS.map((tag) => `{{${tag}}}`).join(', ')
      ].join(' ')
    );
  }

  normalizeWordPackageForOutput(document.getZip(), extension);

  const renderedBuffer = document.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });

  validateGeneratedWordDocument(renderedBuffer);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderedBuffer);

  return {
    outputPath,
    templateData,
    templateInspection,
    populatedTemplateTags: templatePopulation.populatedTemplateTags,
    blankTemplateTags: templatePopulation.blankTemplateTags
  };
}

module.exports = {
  SUPPORTED_WORD_TEMPLATE_TAGS,
  buildSuggestedOutputFilename,
  buildTemplateData,
  describeEmploymentExtraction,
  extractDocumentDerivedProfile,
  parseStructuredSummary,
  renderHiringManagerWordDocument
};

const FILE_EXTENSION_PATTERN = /\.(pdf|docx|txt)$/i;

const GENERIC_CANDIDATE_LABELS = new Set([
  'candidate',
  'candidate cv',
  'candidate profile',
  'candidate resume',
  'cv',
  'employment experience',
  'experience',
  'key projects',
  'professional experience',
  'profile',
  'projects',
  'resume',
  'skills',
  'summary',
  'technical skills',
  'work experience',
  '技能',
  '技能/优势及其他'
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

const COMPANY_HINT_PATTERN =
  /\b(bank|blockchain|capital|college|company|corp|corporation|finance|financial|group|holdings|inc|institute|limited|ltd|llc|school|technologies|technology|university)\b/i;
const ROLE_HINT_PATTERN =
  /\b(analyst|architect|consultant|coordinator|designer|developer|director|engineer|head|lead|manager|officer|owner|partner|president|principal|product|program|project|recruiter|researcher|scientist|specialist|vice president|vp)\b|(?:工程师|开发|架构师|经理|总监|负责人|顾问|分析师|研究员|产品经理|技术负责人)/i;
const EDUCATION_HINT_PATTERN =
  /\b(bachelor|b\.?a\.?|b\.?eng|b\.?s\.?c?|college|degree|diploma|doctor|institute|master|m\.?a\.?|m\.?eng|m\.?s\.?c?|mba|phd|school|university)\b|(?:本科|硕士|博士|学士|大学|学院|学校)/i;
const PROJECT_SECTION_PATTERN =
  /^(?:employment experience|experience|key projects?|professional experience|project experience|projects?|skills?|summary|technical skills|work experience|技能\/优势及其他|技能|项目经验|项目经历|教育背景)$/i;
const SUSPICIOUS_PROJECT_PREFIX_PATTERN = /^(?:and|for|from|in|of|on|or|to|with)\b/i;
const SUSPICIOUS_PROJECT_LABEL_PATTERN = /^(?:english|language|languages|skills?)[:：]/i;
const SKILL_HEADING_PATTERN = /^(?:tech stack|technical skills?|skills?|key skills?|技术栈|技能)[:：]?/i;
const ALL_CAPS_ORGANIZATION_PATTERN = /^[A-Z0-9& .,'()/-]{4,}$/;

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTemplateData(templateData = {}) {
  return templateData && typeof templateData === 'object' ? templateData : {};
}

function uniqueMessages(values) {
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

function looksLikeGenericCandidateLabel(value) {
  const normalized = cleanLine(value).toLowerCase();
  return Boolean(normalized) && (FILE_EXTENSION_PATTERN.test(normalized) || GENERIC_CANDIDATE_LABELS.has(normalized));
}

function looksLikeGenericRoleLabel(value) {
  const normalized = cleanLine(value).toLowerCase();
  return Boolean(normalized) && (FILE_EXTENSION_PATTERN.test(normalized) || GENERIC_ROLE_LABELS.has(normalized));
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

  if (PROJECT_SECTION_PATTERN.test(normalized)) {
    return true;
  }

  if (SUSPICIOUS_PROJECT_PREFIX_PATTERN.test(normalized)) {
    return true;
  }

  if (SUSPICIOUS_PROJECT_LABEL_PATTERN.test(normalized)) {
    return true;
  }

  if (/^[a-z]/.test(normalized)) {
    return true;
  }

  if (normalized.length > 90) {
    return true;
  }

  if ((/[，,;；]/.test(normalized) || /[:：]/.test(normalized)) && normalized.split(/\s+/).length > 8) {
    return true;
  }

  return false;
}

function looksLikeCompanyInsteadOfRoleTitle(title, companyName) {
  const normalizedTitle = cleanLine(title);
  const normalizedCompany = cleanLine(companyName);

  if (!normalizedTitle || normalizedCompany) {
    return false;
  }

  if (SKILL_HEADING_PATTERN.test(normalizedTitle)) {
    return true;
  }

  return Boolean(
    !ROLE_HINT_PATTERN.test(normalizedTitle) &&
    (COMPANY_HINT_PATTERN.test(normalizedTitle) || ALL_CAPS_ORGANIZATION_PATTERN.test(normalizedTitle))
  );
}

function validateEducationEntries(templateData, blockers) {
  const educationEntries = Array.isArray(templateData.education_entries) ? templateData.education_entries : [];

  if (educationEntries.length > 6) {
    blockers.push(`Education history extraction looks malformed: ${educationEntries.length} education rows were produced.`);
  }

  educationEntries.forEach((entry, index) => {
    const degreeName = cleanLine(entry.degree_name);
    const institutionName = cleanLine(entry.institution_name || entry.university);
    const label = `Education entry ${index + 1}`;

    if (!degreeName && !institutionName) {
      blockers.push(`${label} is empty or missing both degree and institution details.`);
      return;
    }

    if ((!degreeName || !institutionName) && /\|/.test(`${degreeName} ${institutionName}`)) {
      blockers.push(`${label} contains merged separator text instead of clean degree and institution fields.`);
    }

    if (!institutionName && looksLikeEmploymentOrProjectPollution(degreeName) && !EDUCATION_HINT_PATTERN.test(degreeName)) {
      blockers.push(`${label} looks like employment or project content rather than education.`);
    }
  });
}

function validateEmploymentEntries(templateData, blockers) {
  const employmentEntries = Array.isArray(templateData.employment_experience_entries)
    ? templateData.employment_experience_entries
    : [];

  if (employmentEntries.length === 0) {
    blockers.push('Employment history extraction is missing. The report would not reflect the candidate CV.');
    return;
  }

  employmentEntries.forEach((entry, index) => {
    const jobTitle = cleanLine(entry.job_title);
    const companyName = cleanLine(entry.company_name);
    const label = `Employment entry ${index + 1}`;

    if (!jobTitle && !companyName) {
      blockers.push(`${label} is empty.`);
      return;
    }

    if (SKILL_HEADING_PATTERN.test(jobTitle)) {
      blockers.push(`${label} uses a skills or tech-stack heading as the role title.`);
    }

    if (looksLikeCompanyInsteadOfRoleTitle(jobTitle, companyName)) {
      blockers.push(`${label} looks like a company name was captured as the role title.`);
    }
  });
}

function validateProjectEntries(templateData, blockers) {
  const projectEntries = Array.isArray(templateData.project_experience_entries)
    ? templateData.project_experience_entries
    : [];

  const suspiciousProjectNames = projectEntries
    .map((entry) => cleanLine(entry.project_name))
    .filter((projectName) => looksLikeSuspiciousProjectName(projectName));

  if (
    projectEntries.length > 12 &&
    suspiciousProjectNames.length >= Math.max(2, Math.ceil(projectEntries.length * 0.2))
  ) {
    blockers.push(`Project experience extraction looks over-expanded: ${projectEntries.length} project rows were produced.`);
  }

  if (
    suspiciousProjectNames.length >= 3 &&
    suspiciousProjectNames.length >= Math.ceil(projectEntries.length * 0.4)
  ) {
    blockers.push('Project experience extraction looks unreliable: several project names appear to be sentence fragments or section spillover.');
  }
}

function validateWordReportQuality(templateData = {}) {
  const normalized = normalizeTemplateData(templateData);
  const blockers = [];

  if (looksLikeGenericCandidateLabel(normalized.candidate_name)) {
    blockers.push('Candidate name looks generic, file-derived, or section-derived.');
  }

  if (looksLikeGenericRoleLabel(normalized.role_title)) {
    blockers.push('Role title looks generic or source-derived.');
  }

  validateEducationEntries(normalized, blockers);
  validateEmploymentEntries(normalized, blockers);
  validateProjectEntries(normalized, blockers);

  return {
    isValid: blockers.length === 0,
    blockers: uniqueMessages(blockers)
  };
}

function formatWordReportQualityError(validationResult) {
  const blockers = Array.isArray(validationResult?.blockers) ? validationResult.blockers : [];

  if (blockers.length === 0) {
    return '';
  }

  return [
    'Word export was blocked because the factual report sections look unreliable.',
    blockers.join(' '),
    'Review the CV/JD extraction or correct the candidate data before exporting again.'
  ].join(' ');
}

module.exports = {
  formatWordReportQualityError,
  validateWordReportQuality
};

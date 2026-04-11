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

function createEvidenceRef({ fieldPath = '', value = '', entryIndex = null } = {}) {
  return {
    fieldPath: cleanLine(fieldPath),
    value: cleanLine(value),
    entryIndex: Number.isFinite(entryIndex) ? Number(entryIndex) : null
  };
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

function pushIssue(blockers, issues, issue) {
  if (!issue || typeof issue !== 'object') {
    return;
  }

  blockers.push(cleanLine(issue.message));
  issues.push({
    code: cleanLine(issue.code),
    severity: 'red',
    section: cleanLine(issue.section),
    entryIndex: Number.isFinite(issue.entryIndex) ? Number(issue.entryIndex) : null,
    message: cleanLine(issue.message),
    evidenceRefs: Array.isArray(issue.evidenceRefs)
      ? issue.evidenceRefs
        .filter((evidenceRef) => evidenceRef && typeof evidenceRef === 'object')
        .map((evidenceRef) => createEvidenceRef(evidenceRef))
      : []
  });
}

function validateEducationEntries(templateData, blockers, issues) {
  const educationEntries = Array.isArray(templateData.education_entries) ? templateData.education_entries : [];

  if (educationEntries.length > 6) {
    pushIssue(blockers, issues, {
      code: 'word_report_education_overflow',
      section: 'education',
      message: `Education history extraction looks malformed: ${educationEntries.length} education rows were produced.`,
      evidenceRefs: [
        createEvidenceRef({
          fieldPath: 'education_entries',
          value: `${educationEntries.length} entries`
        })
      ]
    });
  }

  educationEntries.forEach((entry, index) => {
    const degreeName = cleanLine(entry.degree_name);
    const institutionName = cleanLine(entry.institution_name || entry.university);
    const label = `Education entry ${index + 1}`;
    const evidenceRefs = [
      createEvidenceRef({
        fieldPath: `education_entries[${index}].degree_name`,
        value: degreeName,
        entryIndex: index
      }),
      createEvidenceRef({
        fieldPath: `education_entries[${index}].institution_name`,
        value: institutionName,
        entryIndex: index
      })
    ];

    if (!degreeName && !institutionName) {
      pushIssue(blockers, issues, {
        code: 'word_report_education_entry_empty',
        section: 'education',
        entryIndex: index,
        message: `${label} is empty or missing both degree and institution details.`,
        evidenceRefs
      });
      return;
    }

    if ((!degreeName || !institutionName) && /\|/.test(`${degreeName} ${institutionName}`)) {
      pushIssue(blockers, issues, {
        code: 'word_report_education_entry_merged_fields',
        section: 'education',
        entryIndex: index,
        message: `${label} contains merged separator text instead of clean degree and institution fields.`,
        evidenceRefs
      });
    }

    if (!institutionName && looksLikeEmploymentOrProjectPollution(degreeName) && !EDUCATION_HINT_PATTERN.test(degreeName)) {
      pushIssue(blockers, issues, {
        code: 'word_report_education_entry_polluted',
        section: 'education',
        entryIndex: index,
        message: `${label} looks like employment or project content rather than education.`,
        evidenceRefs
      });
    }
  });
}

function validateEmploymentEntries(templateData, blockers, issues) {
  const employmentEntries = Array.isArray(templateData.employment_experience_entries)
    ? templateData.employment_experience_entries
    : [];

  if (employmentEntries.length === 0) {
    pushIssue(blockers, issues, {
      code: 'word_report_employment_history_missing',
      section: 'employment',
      message: 'Employment history extraction is missing. The report would not reflect the candidate CV.',
      evidenceRefs: [
        createEvidenceRef({
          fieldPath: 'employment_experience_entries',
          value: '0 entries'
        })
      ]
    });
    return;
  }

  employmentEntries.forEach((entry, index) => {
    const jobTitle = cleanLine(entry.job_title);
    const companyName = cleanLine(entry.company_name);
    const label = `Employment entry ${index + 1}`;
    const evidenceRefs = [
      createEvidenceRef({
        fieldPath: `employment_experience_entries[${index}].job_title`,
        value: jobTitle,
        entryIndex: index
      }),
      createEvidenceRef({
        fieldPath: `employment_experience_entries[${index}].company_name`,
        value: companyName,
        entryIndex: index
      })
    ];

    if (!jobTitle && !companyName) {
      pushIssue(blockers, issues, {
        code: 'word_report_employment_entry_empty',
        section: 'employment',
        entryIndex: index,
        message: `${label} is empty.`,
        evidenceRefs
      });
      return;
    }

    if (SKILL_HEADING_PATTERN.test(jobTitle)) {
      pushIssue(blockers, issues, {
        code: 'word_report_employment_role_skill_heading',
        section: 'employment',
        entryIndex: index,
        message: `${label} uses a skills or tech-stack heading as the role title.`,
        evidenceRefs
      });
    }

    if (looksLikeCompanyInsteadOfRoleTitle(jobTitle, companyName)) {
      pushIssue(blockers, issues, {
        code: 'word_report_employment_role_looks_like_company',
        section: 'employment',
        entryIndex: index,
        message: `${label} looks like a company name was captured as the role title.`,
        evidenceRefs
      });
    }
  });
}

function validateProjectEntries(templateData, blockers, issues) {
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
    pushIssue(blockers, issues, {
      code: 'word_report_project_experience_over_expanded',
      section: 'projects',
      message: `Project experience extraction looks over-expanded: ${projectEntries.length} project rows were produced.`,
      evidenceRefs: [
        createEvidenceRef({
          fieldPath: 'project_experience_entries',
          value: `${projectEntries.length} entries`
        })
      ]
    });
  }

  if (
    suspiciousProjectNames.length >= 3 &&
    suspiciousProjectNames.length >= Math.ceil(projectEntries.length * 0.4)
  ) {
    pushIssue(blockers, issues, {
      code: 'word_report_project_experience_unreliable',
      section: 'projects',
      message: 'Project experience extraction looks unreliable: several project names appear to be sentence fragments or section spillover.',
      evidenceRefs: suspiciousProjectNames.map((projectName) => createEvidenceRef({
        fieldPath: 'project_experience_entries[].project_name',
        value: projectName
      }))
    });
  }
}

function validateWordReportQuality(templateData = {}) {
  const normalized = normalizeTemplateData(templateData);
  const blockers = [];
  const issues = [];

  if (looksLikeGenericCandidateLabel(normalized.candidate_name)) {
    pushIssue(blockers, issues, {
      code: 'word_report_candidate_name_generic',
      section: 'identity',
      message: 'Candidate name looks generic, file-derived, or section-derived.',
      evidenceRefs: [
        createEvidenceRef({
          fieldPath: 'candidate_name',
          value: normalized.candidate_name
        })
      ]
    });
  }

  if (looksLikeGenericRoleLabel(normalized.role_title)) {
    pushIssue(blockers, issues, {
      code: 'word_report_role_title_generic',
      section: 'role',
      message: 'Role title looks generic or source-derived.',
      evidenceRefs: [
        createEvidenceRef({
          fieldPath: 'role_title',
          value: normalized.role_title
        })
      ]
    });
  }

  validateEducationEntries(normalized, blockers, issues);
  validateEmploymentEntries(normalized, blockers, issues);
  validateProjectEntries(normalized, blockers, issues);

  return {
    isValid: blockers.length === 0,
    blockers: uniqueMessages(blockers),
    issues
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

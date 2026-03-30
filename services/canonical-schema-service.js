const { extractRequirements } = require('./summary-service');
const { extractDocumentDerivedProfile } = require('./hiring-manager-template-service');
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

const COMPANY_HINT_PATTERN =
  /\b(bank|blockchain|capital|college|company|corp|corporation|finance|financial|group|holdings|inc|institute|limited|ltd|llc|school|technologies|technology|university)\b|(?:公司|科技|信息|银行|集团|大学|学院)/i;
const ROLE_HINT_PATTERN =
  /\b(analyst|architect|consultant|coordinator|designer|developer|director|engineer|head|lead|manager|officer|owner|partner|president|principal|product|program|project|recruiter|researcher|scientist|specialist|vice president|vp)\b|(?:工程师|开发|架构师|经理|总监|负责人|顾问|分析师|研究员|产品经理|技术负责人)/i;
const EDUCATION_HINT_PATTERN =
  /\b(bachelor|b\.?a\.?|b\.?eng|b\.?s\.?c?|college|degree|diploma|doctor|institute|master|m\.?a\.?|m\.?eng|m\.?s\.?c?|mba|phd|school|university)\b|(?:本科|硕士|博士|学士|大学|学院|学校)/i;
const SUSPICIOUS_PROJECT_PREFIX_PATTERN = /^(?:and|for|from|in|of|on|or|to|with)\b/i;
const SUSPICIOUS_PROJECT_LABEL_PATTERN = /^(?:english|language|languages|skills?)[:：]/i;

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

  return deduped
    .map((entry) => {
      const parsedDegree = parseDegreeAndField(entry.degreeName);
      const validationFlags = [];

      if (
        (!parsedDegree.degreeName || !entry.university) &&
        looksLikeEmploymentOrProjectPollution(parsedDegree.degreeName || entry.university) &&
        !EDUCATION_HINT_PATTERN.test(parsedDegree.degreeName || entry.university)
      ) {
        validationFlags.push('education_entry_malformed');
      }

      return {
        degreeName: parsedDegree.degreeName,
        fieldOfStudy: parsedDegree.fieldOfStudy,
        institutionName: cleanLine(entry.university),
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

  return deduped
    .map((entry) => {
      const validationFlags = [];

      if (!cleanLine(entry.companyName) || !cleanLine(entry.jobTitle)) {
        validationFlags.push('employment_entry_missing_core_fields');
      }

      const startYear = extractYear(entry.startDate);
      const endYear = extractYear(entry.endDate);

      if (startYear && endYear && Number.parseInt(startYear, 10) > Number.parseInt(endYear, 10)) {
        validationFlags.push('employment_chronology_invalid');
      }

      return {
        companyName: cleanLine(entry.companyName),
        jobTitle: cleanLine(entry.jobTitle),
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

function findEmploymentLinkIndex(project, employmentHistory) {
  const projectStartYear = extractYear(project.startDate);
  const projectEndYear = extractYear(project.endDate) || projectStartYear;

  if (!projectStartYear) {
    return {
      linkedEmploymentIndex: null,
      ambiguous: false
    };
  }

  const matches = employmentHistory
    .map((employmentEntry, index) => ({ employmentEntry, index }))
    .filter(({ employmentEntry }) => {
      const employmentStartYear = extractYear(employmentEntry.startDate);
      const employmentEndYear = extractYear(employmentEntry.endDate) || employmentStartYear;

      if (!employmentStartYear || !employmentEndYear) {
        return false;
      }

      return (
        Number.parseInt(projectStartYear, 10) >= Number.parseInt(employmentStartYear, 10) &&
        Number.parseInt(projectEndYear, 10) <= Number.parseInt(employmentEndYear, 10)
      );
    });

  if (matches.length === 1) {
    return {
      linkedEmploymentIndex: matches[0].index,
      ambiguous: false
    };
  }

  return {
    linkedEmploymentIndex: null,
    ambiguous: matches.length > 1
  };
}

function normalizeProjectEntries(entries = [], cvBlocks = [], employmentHistory = []) {
  const deduped = dedupeBy(entries, (entry) => normalizeKey([
    entry.project_name,
    entry.project_start_date,
    entry.project_end_date
  ].join('|')));

  return deduped
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

  if (!cleanLine(candidateSchema.identity.name) || looksLikeGenericCandidateLabel(candidateSchema.identity.name)) {
    issues.push({
      code: 'candidate_name_missing_or_generic',
      severity: 'red',
      section: 'identity',
      message: 'Candidate name is missing or generic.',
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

function buildCanonicalSchemas({ cvDocument, jdDocument, sourceModel = null } = {}) {
  const resolvedSourceModel = sourceModel || buildWorkspaceSourceModel({ cvDocument, jdDocument });
  const cvSourceDocument = resolvedSourceModel.documents.find((document) => document.documentType === 'cv');
  const jdSourceDocument = resolvedSourceModel.documents.find((document) => document.documentType === 'jd');

  const profile = extractDocumentDerivedProfile({
    cvDocument,
    jdDocument
  });

  const candidateSchema = {
    identity: {
      name: cleanLine(profile.candidateName),
      location: cleanLine(profile.candidateLocation),
      confidence: cleanLine(profile.candidateName) ? 'high' : 'low',
      validationFlags: [],
      sourceRefs: selectSourceRefs(cvSourceDocument?.blocks || [], {
        preferredSectionKeys: ['overview', 'experience', 'unknown'],
        terms: [profile.candidateName, profile.candidateLocation]
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

  const jdSchema = {
    role: {
      title: cleanLine(profile.roleTitle),
      company: '',
      confidence: cleanLine(profile.roleTitle) ? 'high' : 'low',
      validationFlags: [],
      sourceRefs: selectSourceRefs(jdSourceDocument?.blocks || [], {
        preferredSectionKeys: ['overview'],
        terms: [profile.roleTitle]
      })
    },
    requirements: normalizeRequirementEntries(
      extractRequirements(jdDocument?.text || ''),
      jdSourceDocument?.blocks || [],
      profile.roleTitle
    )
  };

  return {
    schemaVersion: 1,
    candidateSchema,
    jdSchema,
    validationSummary: buildCanonicalValidationSummary({
      candidateSchema,
      jdSchema
    })
  };
}

module.exports = {
  buildCanonicalSchemas
};

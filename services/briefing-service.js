const {
  buildSummaryPrompt,
  resolveTemplateGuidance,
  extractCandidateName,
  extractRequirements,
  extractRoleTitle,
  generateSummaryDraft,
  getDefaultTemplateForLanguage,
  getDefaultTemplateLabel,
  normalizeGeneratedSummary
} = require('./summary-service');
const {
  ANONYMOUS_CANDIDATE_LABEL
} = require('./anonymization-service');
const {
  isChineseOutputLanguage,
  normalizeOutputLanguage
} = require('./output-language-service');
const { summaryNeedsLanguageNormalization } = require('./briefing-language-service');
const {
  buildWorkspaceRetrievalQuery,
  buildWorkspaceSourceModel,
  renderSourceBlocksContext,
  selectWorkspaceSourceBlocks
} = require('./workspace-source-service');
const {
  extractDocumentDerivedProfile,
  parseStructuredSummary
} = require('./hiring-manager-template-service');

const BRIEFING_SCHEMA_VERSION = 1;
const MIN_BRIEFING_MAX_TOKENS = 3200;

function cleanLine(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function softenSummaryConfidenceLanguage(summary) {
  return String(summary || '')
    .replace(/\bideal candidate\b/gi, 'strong candidate')
    .replace(/\bperfect (candidate|fit|match)\b/gi, 'strong $1')
    .replace(/\b100%\s+(fit|match)\b/gi, 'strong $1')
    .replace(/\b(?:fully meets all requirements|meets every requirement)\b/gi, 'addresses the core requirements well');
}

function splitNonEmptyLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripBulletPrefix(value) {
  return cleanLine(value).replace(/^[-*•–—]\s*/, '');
}

function getLocalizedBriefingCopy(outputLanguage = 'en') {
  if (isChineseOutputLanguage(outputLanguage)) {
    return {
      candidateLabel: '候选人',
      targetRoleLabel: '目标职位',
      hiringCompanyLabel: '招聘公司',
      hiringManagerLabel: '招聘经理',
      briefingSummaryHeading: '## 简报摘要',
      candidateSnapshotHeading: '## 候选人概览',
      educationHeading: '## 教育背景',
      employmentHeading: '## 工作经历',
      relevantExperienceHeading: '## 相关经验',
      matchRequirementsHeading: '## 与关键要求的匹配',
      concernsHeading: '## 潜在顾虑 / 差距',
      nextStepHeading: '## 建议下一步',
      locationLabel: '地点',
      preferredLocationLabel: '意向地点',
      nationalityLabel: '国籍',
      genderLabel: '性别',
      noticePeriodLabel: '到岗时间',
      languagesLabel: '语言',
      noSummary: '暂未生成简报摘要。',
      noSnapshot: '暂无更多候选人概览信息。',
      noEducation: '- 暂未捕获教育信息。',
      noEmployment: '- 暂未捕获工作经历。',
      noEvidence: '- 本节暂无可用信息。',
      noRequirementMatches: '- 暂未捕获岗位要求与证据匹配。',
      noNextStep: '暂无建议下一步。',
      genericCandidate: '候选人',
      genericRole: '职位',
      listJoiner: '、',
      dateSeparator: ' 至 ',
      organizationSeparator: '，',
      labelSeparator: '：'
    };
  }

  return {
    candidateLabel: 'Candidate',
    targetRoleLabel: 'Target Role',
    hiringCompanyLabel: 'Hiring Company',
    hiringManagerLabel: 'Hiring Manager',
    briefingSummaryHeading: '## Briefing Summary',
    candidateSnapshotHeading: '## Candidate Snapshot',
    educationHeading: '## Education',
    employmentHeading: '## Employment Experience',
    relevantExperienceHeading: '## Relevant Experience',
    matchRequirementsHeading: '## Match Against Key Requirements',
    concernsHeading: '## Potential Concerns / Gaps',
    nextStepHeading: '## Recommended Next Step',
    locationLabel: 'Location',
    preferredLocationLabel: 'Preferred Location',
    nationalityLabel: 'Nationality',
    genderLabel: 'Gender',
    noticePeriodLabel: 'Notice Period',
    languagesLabel: 'Languages',
    noSummary: 'No briefing summary available yet.',
    noSnapshot: 'No additional candidate snapshot details were captured.',
    noEducation: '- No education details were captured.',
    noEmployment: '- No employment history was captured.',
    noEvidence: '- No evidence was captured in this section.',
    noRequirementMatches: '- No requirement-to-evidence matches were captured.',
    noNextStep: 'No recommended next step captured.',
    genericCandidate: 'Candidate',
    genericRole: 'Role',
    listJoiner: ', ',
    dateSeparator: ' - ',
    organizationSeparator: ', ',
    labelSeparator: ': '
  };
}

function formatDateRange(startDate, endDate, outputLanguage = 'en') {
  const copy = getLocalizedBriefingCopy(outputLanguage);
  const start = cleanLine(startDate);
  const end = cleanLine(endDate);

  if (!start) {
    return end;
  }

  if (!end) {
    return start;
  }

  if (isChineseOutputLanguage(outputLanguage) && /^至/.test(end)) {
    return `${start} ${end}`;
  }

  return `${start}${copy.dateSeparator}${end}`;
}

function parseLooseDateRange(value) {
  const cleaned = cleanLine(value);

  if (!cleaned) {
    return {
      startDate: '',
      endDate: ''
    };
  }

  const match = cleaned.match(/((?:19|20)\d{2})(?:[./-]\d{1,2})?\s*[–-]\s*((?:19|20)\d{2}|Present|Current|Now)(?:[./-]\d{1,2})?/i);

  if (!match) {
    return {
      startDate: '',
      endDate: ''
    };
  }

  return {
    startDate: cleanLine(match[1]),
    endDate: cleanLine(match[2])
  };
}

function createEmptyBriefing() {
  return {
    schema_version: BRIEFING_SCHEMA_VERSION,
    candidate: {
      name: '',
      date_of_birth: '',
      gender: '',
      nationality: '',
      location: '',
      preferred_location: '',
      languages: [],
      notice_period: '',
      education: [],
      skills: [],
      certifications: []
    },
    role: {
      title: '',
      company: '',
      hiring_manager: ''
    },
    fit_summary: '',
    relevant_experience: [],
    match_requirements: [],
    potential_concerns: [],
    recommended_next_step: '',
    employment_history: [],
    project_experiences: [],
    evidence_refs: []
  };
}

function buildBriefingGenerationSettings(settings = {}) {
  return {
    ...settings,
    maxTokens: Math.max(Number(settings.maxTokens) || 0, MIN_BRIEFING_MAX_TOKENS)
  };
}

function normalizeStringArray(values) {
  if (typeof values === 'string') {
    return splitNonEmptyLines(values)
      .map((value) => stripBulletPrefix(value))
      .filter(Boolean);
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => stripBulletPrefix(value))
    .filter(Boolean);
}

function normalizeLanguageArray(values) {
  if (typeof values === 'string') {
    return values
      .split(/\s*[,/;|]\s*/)
      .map((value) => cleanLine(value))
      .filter(Boolean);
  }

  return normalizeStringArray(values);
}

function normalizeEducationArray(values) {
  if (values && !Array.isArray(values)) {
    values = [values];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => ({
      degree_name: cleanLine(entry?.degree_name || entry?.degreeName || entry?.degree),
      university: cleanLine(entry?.university || entry?.institution),
      start_year: cleanLine(entry?.start_year || entry?.startYear || parseLooseDateRange(entry?.dates).startDate),
      end_year: cleanLine(entry?.end_year || entry?.endYear || parseLooseDateRange(entry?.dates).endDate)
    }))
    .filter((entry) => entry.degree_name || entry.university || entry.start_year || entry.end_year);
}

function deriveEducationDisplayParts(entry = {}) {
  const degreeName = cleanLine(entry.degree_name || entry.degreeName || entry.degree)
    .replace(/\s*[（(]\s*(?:19|20)\d{2}(?:[./-]\d{1,2})?\s*[–-]\s*(?:Present|Current|Now|(?:19|20)\d{2})(?:[./-]\d{1,2})?\s*[)）]\s*$/i, '')
    .trim();
  const explicitField = cleanLine(entry.field_of_study || entry.fieldOfStudy);

  if (explicitField) {
    return {
      degreeName,
      fieldOfStudy: explicitField
    };
  }

  const inPatternMatch = degreeName.match(/^((?:MSc|BSc|MBA|PhD|BA|MA|Bachelor|Master|Doctor)[A-Za-z .()'-]*)\s+in\s+(.+)$/i);

  if (inPatternMatch) {
    return {
      degreeName: cleanLine(inPatternMatch[1]),
      fieldOfStudy: cleanLine(inPatternMatch[2])
    };
  }

  return {
    degreeName,
    fieldOfStudy: ''
  };
}

function normalizeEvidenceRefs(values) {
  if (values && !Array.isArray(values)) {
    values = [values];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => ({
      source: cleanLine(entry?.source),
      section: cleanLine(entry?.section),
      excerpt: cleanLine(entry?.excerpt),
      note: cleanLine(entry?.note)
    }))
    .filter((entry) => entry.source || entry.section || entry.excerpt || entry.note);
}

function normalizeMatchRequirements(values) {
  if (typeof values === 'string') {
    values = splitNonEmptyLines(values);
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => {
      if (typeof entry === 'string') {
        const cleaned = stripBulletPrefix(entry);
        const arrowMatch = cleaned.match(/^(.+?)\s*->\s*(.+)$/);

        if (arrowMatch) {
          return {
            requirement: cleanLine(arrowMatch[1]),
            evidence: cleanLine(arrowMatch[2]),
            evidence_refs: []
          };
        }

        return {
          requirement: cleaned,
          evidence: '',
          evidence_refs: []
        };
      }

      return {
        requirement: cleanLine(entry?.requirement),
        evidence: cleanLine(entry?.evidence),
        evidence_refs: normalizeEvidenceRefs(entry?.evidence_refs || entry?.evidenceRefs)
      };
    })
    .filter((entry) => entry.requirement || entry.evidence);
}

function normalizeEmploymentHistory(values) {
  if (values && !Array.isArray(values)) {
    values = [values];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => {
      const parsedDates = parseLooseDateRange(entry?.dates);

      return {
        job_title: cleanLine(entry?.job_title || entry?.jobTitle || entry?.title),
        company_name: cleanLine(entry?.company_name || entry?.companyName || entry?.employer),
        start_date: cleanLine(entry?.start_date || entry?.startDate || parsedDates.startDate),
        end_date: cleanLine(entry?.end_date || entry?.endDate || parsedDates.endDate),
        responsibilities: normalizeStringArray(entry?.responsibilities || []),
        evidence_refs: normalizeEvidenceRefs(entry?.evidence_refs || entry?.evidenceRefs)
      };
    })
    .filter((entry) => {
      return entry.job_title || entry.company_name || entry.start_date || entry.end_date || entry.responsibilities.length > 0;
    });
}

function normalizeProjectExperiences(values) {
  if (values && !Array.isArray(values)) {
    values = [values];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => {
      const parsedDates = parseLooseDateRange(entry?.dates);

      return {
        project_name: cleanLine(entry?.project_name || entry?.projectName || entry?.name),
        project_summary: cleanLine(entry?.project_summary || entry?.projectSummary || entry?.summary),
        project_start_date: cleanLine(entry?.project_start_date || entry?.projectStartDate || parsedDates.startDate),
        project_end_date: cleanLine(entry?.project_end_date || entry?.projectEndDate || parsedDates.endDate),
        project_timeline_basis: cleanLine(entry?.project_timeline_basis || entry?.projectTimelineBasis || entry?.timeline_basis),
        linked_job_title: cleanLine(entry?.linked_job_title || entry?.linkedJobTitle),
        linked_company_name: cleanLine(entry?.linked_company_name || entry?.linkedCompanyName),
        project_bullets: normalizeStringArray(entry?.project_bullets || entry?.projectBullets || entry?.bullets),
        project_bullet_originals: normalizeStringArray(
          entry?.project_bullet_originals || entry?.projectBulletOriginals || entry?.original_bullets || entry?.project_bullet_original_text
        ),
        evidence_refs: normalizeEvidenceRefs(entry?.evidence_refs || entry?.evidenceRefs)
      };
    })
    .filter((entry) => {
      return entry.project_name ||
        entry.project_summary ||
        entry.project_start_date ||
        entry.project_end_date ||
        entry.linked_job_title ||
        entry.linked_company_name ||
        entry.project_bullets.length > 0;
    });
}

function normalizeBriefing(input = {}) {
  const base = createEmptyBriefing();
  const candidate = input.candidate || {};
  const role = input.role || {};

  return {
    schema_version: BRIEFING_SCHEMA_VERSION,
    candidate: {
      name: cleanLine(candidate.name || input.candidate_name),
      date_of_birth: cleanLine(candidate.date_of_birth || candidate.dateOfBirth || input.candidate_date_of_birth),
      gender: cleanLine(candidate.gender || input.candidate_gender),
      nationality: cleanLine(candidate.nationality || input.candidate_nationality),
      location: cleanLine(candidate.location || input.candidate_location),
      preferred_location: cleanLine(candidate.preferred_location || candidate.preferredLocation || input.candidate_preferred_location),
      languages: normalizeLanguageArray(candidate.languages || input.candidate_languages || []),
      notice_period: cleanLine(candidate.notice_period || candidate.noticePeriod || input.notice_period),
      education: normalizeEducationArray(candidate.education || input.education || []),
      skills: normalizeStringArray(candidate.skills || input.candidate_skills || []),
      certifications: normalizeStringArray(candidate.certifications || input.candidate_certifications || [])
    },
    role: {
      title: cleanLine(role.title || input.role_title),
      company: cleanLine(role.company || input.role_company),
      hiring_manager: cleanLine(role.hiring_manager || role.hiringManager || input.hiring_manager)
    },
    fit_summary: cleanLine(input.fit_summary),
    relevant_experience: normalizeStringArray(input.relevant_experience),
    match_requirements: normalizeMatchRequirements(input.match_requirements),
    potential_concerns: normalizeStringArray(input.potential_concerns),
    recommended_next_step: cleanLine(input.recommended_next_step),
    employment_history: normalizeEmploymentHistory(input.employment_history),
    project_experiences: normalizeProjectExperiences(input.project_experiences),
    evidence_refs: normalizeEvidenceRefs(input.evidence_refs)
  };
}

function mergeTextValue(primary, fallback) {
  return cleanLine(primary) || cleanLine(fallback);
}

function dedupeByKey(values, getKey) {
  const items = [];
  const seen = new Set();

  for (const value of values) {
    const key = getKey(value);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(value);
  }

  return items;
}

function mergeStringArrayValue(primary, fallback) {
  return dedupeByKey(
    [
      ...normalizeStringArray(primary),
      ...normalizeStringArray(fallback)
    ],
    (value) => cleanLine(value).toLowerCase()
  );
}

function mergeEducationValue(primary, fallback) {
  return dedupeByKey(
    [
      ...normalizeEducationArray(primary),
      ...normalizeEducationArray(fallback)
    ],
    (entry) => [
      cleanLine(entry.degree_name).toLowerCase(),
      cleanLine(entry.university).toLowerCase(),
      cleanLine(entry.start_year).toLowerCase(),
      cleanLine(entry.end_year).toLowerCase()
    ].join('|')
  );
}

function mergeEvidenceRefsValue(primary, fallback) {
  return dedupeByKey(
    [
      ...normalizeEvidenceRefs(primary),
      ...normalizeEvidenceRefs(fallback)
    ],
    (entry) => [
      cleanLine(entry.source).toLowerCase(),
      cleanLine(entry.section).toLowerCase(),
      cleanLine(entry.excerpt).toLowerCase(),
      cleanLine(entry.note).toLowerCase()
    ].join('|')
  );
}

function mergeMatchRequirementsValue(primary, fallback) {
  const primaryEntries = normalizeMatchRequirements(primary);
  const fallbackEntries = normalizeMatchRequirements(fallback);
  const merged = [];
  const indexByRequirement = new Map();

  function upsert(entry) {
    const requirementKey = cleanLine(entry.requirement).toLowerCase();

    if (!requirementKey) {
      return;
    }

    if (!indexByRequirement.has(requirementKey)) {
      indexByRequirement.set(requirementKey, merged.length);
      merged.push({
        requirement: cleanLine(entry.requirement),
        evidence: cleanLine(entry.evidence),
        evidence_refs: normalizeEvidenceRefs(entry.evidence_refs)
      });
      return;
    }

    const existing = merged[indexByRequirement.get(requirementKey)];

    merged[indexByRequirement.get(requirementKey)] = {
      requirement: existing.requirement || cleanLine(entry.requirement),
      evidence: existing.evidence || cleanLine(entry.evidence),
      evidence_refs: mergeEvidenceRefsValue(existing.evidence_refs, entry.evidence_refs)
    };
  }

  primaryEntries.forEach(upsert);
  fallbackEntries.forEach(upsert);

  return merged;
}

function detectArrayLanguage(values) {
  const text = normalizeStringArray(values).join(' ');

  if (!text) {
    return 'unknown';
  }

  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;

  if (cjkCount >= 4 && cjkCount > latinCount) {
    return 'cjk';
  }

  if (latinCount >= 4 && cjkCount === 0) {
    return 'latin';
  }

  return 'mixed';
}

function mergeEmploymentResponsibilitiesValue(primary, fallback) {
  const normalizedPrimary = normalizeStringArray(primary);
  const normalizedFallback = normalizeStringArray(fallback);

  if (normalizedPrimary.length === 0) {
    return normalizedFallback;
  }

  if (normalizedFallback.length === 0) {
    return normalizedPrimary;
  }

  const primaryLanguage = detectArrayLanguage(normalizedPrimary);
  const fallbackLanguage = detectArrayLanguage(normalizedFallback);

  if (
    primaryLanguage !== 'unknown' &&
    fallbackLanguage !== 'unknown' &&
    primaryLanguage !== fallbackLanguage
  ) {
    return normalizedPrimary;
  }

  return mergeStringArrayValue(normalizedPrimary, normalizedFallback);
}

function mergeEmploymentHistoryValue(primary, fallback) {
  const primaryEntries = normalizeEmploymentHistory(primary);
  const fallbackEntries = normalizeEmploymentHistory(fallback);
  const merged = [];
  const indexByKey = new Map();
  const indexByLooseKey = new Map();

  function normalizeOrganizationKey(value) {
    return cleanLine(value)
      .replace(/[（(].*?[)）]/g, '')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '')
      .toLowerCase();
  }

  function buildEntryKey(entry) {
    return [
      cleanLine(entry.job_title).toLowerCase(),
      cleanLine(entry.company_name).toLowerCase(),
      cleanLine(entry.start_date).toLowerCase(),
      cleanLine(entry.end_date).toLowerCase()
    ].join('|');
  }

  function buildLooseEntryKey(entry) {
    const companyKey = normalizeOrganizationKey(entry.company_name);
    const startDate = cleanLine(entry.start_date).toLowerCase();
    const endDate = cleanLine(entry.end_date).toLowerCase();

    if (!companyKey || !startDate || !endDate) {
      return '';
    }

    return [companyKey, startDate, endDate].join('|');
  }

  function upsert(entry) {
    const key = buildEntryKey(entry);
    const looseKey = buildLooseEntryKey(entry);
    const existingIndex = indexByKey.has(key)
      ? indexByKey.get(key)
      : (looseKey && indexByLooseKey.has(looseKey) ? indexByLooseKey.get(looseKey) : -1);

    if (!key.replace(/\|/g, '')) {
      return;
    }

    if (existingIndex < 0) {
      const mergedIndex = merged.length;
      indexByKey.set(key, mergedIndex);
      if (looseKey) {
        indexByLooseKey.set(looseKey, mergedIndex);
      }
      merged.push({
        job_title: cleanLine(entry.job_title),
        company_name: cleanLine(entry.company_name),
        start_date: cleanLine(entry.start_date),
        end_date: cleanLine(entry.end_date),
        responsibilities: normalizeStringArray(entry.responsibilities),
        evidence_refs: normalizeEvidenceRefs(entry.evidence_refs)
      });
      return;
    }

    const existing = merged[existingIndex];
    indexByKey.set(key, existingIndex);
    if (looseKey) {
      indexByLooseKey.set(looseKey, existingIndex);
    }

    merged[existingIndex] = {
      job_title: existing.job_title || cleanLine(entry.job_title),
      company_name: existing.company_name || cleanLine(entry.company_name),
      start_date: existing.start_date || cleanLine(entry.start_date),
      end_date: existing.end_date || cleanLine(entry.end_date),
      responsibilities: mergeEmploymentResponsibilitiesValue(existing.responsibilities, entry.responsibilities),
      evidence_refs: mergeEvidenceRefsValue(existing.evidence_refs, entry.evidence_refs)
    };
  }

  primaryEntries.forEach(upsert);
  fallbackEntries.forEach(upsert);

  return merged;
}

function mergeBriefingWithFallback(briefing, fallbackBriefing) {
  const normalizedBriefing = normalizeBriefing(briefing);
  const normalizedFallback = normalizeBriefing(fallbackBriefing);

  return {
    schema_version: BRIEFING_SCHEMA_VERSION,
    candidate: {
      name: mergeTextValue(normalizedBriefing.candidate.name, normalizedFallback.candidate.name),
      date_of_birth: mergeTextValue(normalizedBriefing.candidate.date_of_birth, normalizedFallback.candidate.date_of_birth),
      gender: mergeTextValue(normalizedBriefing.candidate.gender, normalizedFallback.candidate.gender),
      nationality: mergeTextValue(normalizedBriefing.candidate.nationality, normalizedFallback.candidate.nationality),
      location: mergeTextValue(normalizedBriefing.candidate.location, normalizedFallback.candidate.location),
      preferred_location: mergeTextValue(normalizedBriefing.candidate.preferred_location, normalizedFallback.candidate.preferred_location),
      languages: mergeStringArrayValue(normalizedBriefing.candidate.languages, normalizedFallback.candidate.languages),
      notice_period: mergeTextValue(normalizedBriefing.candidate.notice_period, normalizedFallback.candidate.notice_period),
      education: mergeEducationValue(normalizedBriefing.candidate.education, normalizedFallback.candidate.education),
      skills: mergeStringArrayValue(normalizedBriefing.candidate.skills, normalizedFallback.candidate.skills),
      certifications: mergeStringArrayValue(normalizedBriefing.candidate.certifications, normalizedFallback.candidate.certifications)
    },
    role: {
      title: mergeTextValue(normalizedBriefing.role.title, normalizedFallback.role.title),
      company: mergeTextValue(normalizedBriefing.role.company, normalizedFallback.role.company),
      hiring_manager: mergeTextValue(normalizedBriefing.role.hiring_manager, normalizedFallback.role.hiring_manager)
    },
    fit_summary: mergeTextValue(normalizedBriefing.fit_summary, normalizedFallback.fit_summary),
    relevant_experience: mergeStringArrayValue(normalizedBriefing.relevant_experience, normalizedFallback.relevant_experience),
    match_requirements: mergeMatchRequirementsValue(normalizedBriefing.match_requirements, normalizedFallback.match_requirements),
    potential_concerns: mergeStringArrayValue(normalizedBriefing.potential_concerns, normalizedFallback.potential_concerns),
    recommended_next_step: mergeTextValue(normalizedBriefing.recommended_next_step, normalizedFallback.recommended_next_step),
    employment_history: mergeEmploymentHistoryValue(normalizedBriefing.employment_history, normalizedFallback.employment_history),
    project_experiences: normalizeProjectExperiences(
      normalizedBriefing.project_experiences.length > 0
        ? normalizedBriefing.project_experiences
        : normalizedFallback.project_experiences
    ),
    evidence_refs: mergeEvidenceRefsValue(normalizedBriefing.evidence_refs, normalizedFallback.evidence_refs)
  };
}

function composeDeterministicReportBriefing(briefing, fallbackBriefing) {
  const normalizedBriefing = normalizeBriefing(briefing);
  const normalizedFallback = normalizeBriefing(fallbackBriefing);

  return normalizeBriefing({
    schema_version: BRIEFING_SCHEMA_VERSION,
    candidate: {
      name: mergeTextValue(normalizedBriefing.candidate.name, normalizedFallback.candidate.name),
      date_of_birth: mergeTextValue(normalizedBriefing.candidate.date_of_birth, normalizedFallback.candidate.date_of_birth),
      gender: mergeTextValue(normalizedBriefing.candidate.gender, normalizedFallback.candidate.gender),
      nationality: mergeTextValue(normalizedBriefing.candidate.nationality, normalizedFallback.candidate.nationality),
      location: mergeTextValue(normalizedBriefing.candidate.location, normalizedFallback.candidate.location),
      preferred_location: mergeTextValue(normalizedBriefing.candidate.preferred_location, normalizedFallback.candidate.preferred_location),
      languages:
        normalizedBriefing.candidate.languages.length > 0
          ? normalizedBriefing.candidate.languages
          : normalizedFallback.candidate.languages,
      notice_period: mergeTextValue(normalizedBriefing.candidate.notice_period, normalizedFallback.candidate.notice_period),
      education: normalizedFallback.candidate.education,
      skills:
        normalizedFallback.candidate.skills.length > 0
          ? normalizedFallback.candidate.skills
          : normalizedBriefing.candidate.skills,
      certifications:
        normalizedFallback.candidate.certifications.length > 0
          ? normalizedFallback.candidate.certifications
          : normalizedBriefing.candidate.certifications
    },
    role: {
      title: mergeTextValue(normalizedBriefing.role.title, normalizedFallback.role.title),
      company: mergeTextValue(normalizedBriefing.role.company, normalizedFallback.role.company),
      hiring_manager: mergeTextValue(normalizedBriefing.role.hiring_manager, normalizedFallback.role.hiring_manager)
    },
    fit_summary: mergeTextValue(normalizedBriefing.fit_summary, normalizedFallback.fit_summary),
    relevant_experience:
      normalizedBriefing.relevant_experience.length > 0
        ? normalizedBriefing.relevant_experience
        : normalizedFallback.relevant_experience,
    match_requirements:
      normalizedBriefing.match_requirements.length > 0
        ? normalizedBriefing.match_requirements
        : normalizedFallback.match_requirements,
    potential_concerns:
      normalizedBriefing.potential_concerns.length > 0
        ? normalizedBriefing.potential_concerns
        : normalizedFallback.potential_concerns,
    recommended_next_step: mergeTextValue(
      normalizedBriefing.recommended_next_step,
      normalizedFallback.recommended_next_step
    ),
    employment_history: normalizedFallback.employment_history,
    project_experiences: normalizedFallback.project_experiences,
    evidence_refs: mergeEvidenceRefsValue(normalizedBriefing.evidence_refs, normalizedFallback.evidence_refs)
  });
}

function validateBriefing(briefing) {
  const normalized = normalizeBriefing(briefing);
  const errors = [];

  if (!normalized.candidate.name) {
    errors.push('Candidate name is missing from the structured briefing.');
  }

  if (!normalized.role.title) {
    errors.push('Role title is missing from the structured briefing.');
  }

  if (!normalized.fit_summary) {
    errors.push('Fit summary is missing from the structured briefing.');
  }

  if (!normalized.recommended_next_step) {
    errors.push('Recommended next step is missing from the structured briefing.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    briefing: normalized
  };
}

function parseBulletSection(value) {
  return splitNonEmptyLines(value).map(stripBulletPrefix).filter(Boolean);
}

function parseMatchRequirementSection(value) {
  return splitNonEmptyLines(value)
    .map((line) => stripBulletPrefix(line))
    .map((line) => {
      const arrowMatch = line.match(/^(.+?)\s*->\s*(.+)$/);

      if (arrowMatch) {
        return {
          requirement: cleanLine(arrowMatch[1]),
          evidence: cleanLine(arrowMatch[2]),
          evidence_refs: []
        };
      }

      return {
        requirement: cleanLine(line),
        evidence: '',
        evidence_refs: []
      };
    })
    .filter((entry) => entry.requirement || entry.evidence);
}

function buildFallbackBriefing({ cvDocument, jdDocument, outputLanguage = 'en' }) {
  const profile = extractDocumentDerivedProfile({ cvDocument, jdDocument });
  const draft = generateSummaryDraft({ cvDocument, jdDocument, outputLanguage });
  const sections = parseStructuredSummary(draft.summary);

  return normalizeBriefing({
    candidate: {
      name: profile.candidateName,
      date_of_birth: profile.candidateDateOfBirth,
      gender: profile.candidateGender,
      nationality: profile.candidateNationality,
      location: profile.candidateLocation,
      preferred_location: profile.candidatePreferredLocation,
      languages: profile.candidateLanguages || [profile.candidateLanguage1, profile.candidateLanguage2].filter(Boolean),
      notice_period: profile.noticePeriod,
      skills: profile.candidateSkills || [],
      certifications: profile.candidateCertifications || [],
      education: (profile.educationEntries || []).length > 0
        ? profile.educationEntries.map((entry) => ({
          degree_name: entry.degreeName,
          university: entry.university,
          start_year: entry.startYear,
          end_year: entry.endYear
        }))
        : [
          {
            degree_name: profile.degreeName,
            university: profile.university,
            start_year: profile.startYear,
            end_year: profile.endYear
          }
        ]
    },
    role: {
      title: profile.roleTitle,
      company: profile.hiringManager,
      hiring_manager: profile.hiringManager
    },
    fit_summary: sections.fit_summary || '',
    relevant_experience: parseBulletSection(sections.relevant_experience),
    match_requirements: parseMatchRequirementSection(sections.match_requirements),
    potential_concerns: parseBulletSection(sections.potential_concerns),
    recommended_next_step: sections.recommended_next_step || '',
    employment_history: profile.employmentHistory.map((entry) => ({
      job_title: entry.jobTitle,
      company_name: entry.companyName,
      start_date: entry.startDate,
      end_date: entry.endDate,
      responsibilities: entry.responsibilities || [],
      evidence_refs: []
    })),
    project_experiences: (profile.projectExperiences || []).map((entry) => ({
      project_name: entry.project_name,
      project_summary: entry.project_summary,
      project_start_date: entry.project_start_date,
      project_end_date: entry.project_end_date,
      project_timeline_basis: entry.project_timeline_basis,
      linked_job_title: entry.linked_job_title,
      linked_company_name: entry.linked_company_name,
      project_bullets: entry.project_bullets || [],
      project_bullet_originals: entry.project_bullet_originals || [],
      evidence_refs: []
    })),
    evidence_refs: []
  });
}

function fillTemplate(template, replacements) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => replacements[key] ?? '');
}

function formatBulletLines(lines, outputLanguage = 'en') {
  const copy = getLocalizedBriefingCopy(outputLanguage);

  if (!Array.isArray(lines) || lines.length === 0) {
    return copy.noEvidence;
  }

  return lines.map((line) => `- ${stripBulletPrefix(line)}`).join('\n');
}

function formatMatchRequirements(lines, outputLanguage = 'en') {
  const copy = getLocalizedBriefingCopy(outputLanguage);

  if (!Array.isArray(lines) || lines.length === 0) {
    return copy.noRequirementMatches;
  }

  return lines
    .map((entry) => {
      const requirement = cleanLine(entry.requirement);
      const evidence = cleanLine(entry.evidence);

      if (requirement && evidence) {
        return `- ${requirement} -> ${evidence}`;
      }

      return `- ${requirement || evidence}`;
    })
    .join('\n');
}

function formatEducationLines(education, outputLanguage = 'en') {
  const copy = getLocalizedBriefingCopy(outputLanguage);

  if (!Array.isArray(education) || education.length === 0) {
    return copy.noEducation;
  }

  return education
    .map((entry) => {
      const parts = [
        cleanLine(entry.degree_name),
        cleanLine(entry.university),
        formatDateRange(entry.start_year, entry.end_year, outputLanguage)
      ].filter(Boolean);

      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}

function formatEmploymentHistoryForReview(history, outputLanguage = 'en') {
  const copy = getLocalizedBriefingCopy(outputLanguage);

  if (!Array.isArray(history) || history.length === 0) {
    return copy.noEmployment;
  }

  return history
    .map((entry) => {
      const lines = [];
      const titleLine = [entry.job_title, entry.company_name].filter(Boolean).join(' | ');
      const dateLine = formatDateRange(entry.start_date, entry.end_date, outputLanguage);

      if (titleLine) {
        lines.push(titleLine);
      }

      if (dateLine) {
        lines.push(dateLine);
      }

      const responsibilities = normalizeStringArray(entry.responsibilities);

      if (responsibilities.length > 0) {
        responsibilities.forEach((item) => {
          lines.push(`- ${item}`);
        });
      }

      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function renderSummaryFromBriefing(briefing, outputLanguage = 'en') {
  const normalized = normalizeBriefing(briefing);
  const copy = getLocalizedBriefingCopy(outputLanguage);

  return normalizeGeneratedSummary(fillTemplate(getDefaultTemplateForLanguage(outputLanguage), {
    candidate_name: normalized.candidate.name || copy.genericCandidate,
    role_title: normalized.role.title || copy.genericRole,
    fit_summary: normalized.fit_summary,
    relevant_experience: formatBulletLines(normalized.relevant_experience, outputLanguage),
    match_requirements: formatMatchRequirements(normalized.match_requirements, outputLanguage),
    potential_concerns: formatBulletLines(normalized.potential_concerns, outputLanguage),
    recommended_next_step: normalized.recommended_next_step
  }));
}

function repairRecruiterSummary(summary, briefing, outputLanguage = 'en') {
  const normalizedSummary = normalizeGeneratedSummary(summary);

  if (!cleanLine(normalizedSummary)) {
    return softenSummaryConfidenceLanguage(renderSummaryFromBriefing(briefing, outputLanguage));
  }

  const sections = parseStructuredSummary(normalizedSummary);
  const missingRequiredSection = [
    sections.fit_summary,
    sections.relevant_experience,
    sections.match_requirements,
    sections.recommended_next_step
  ].some((value) => !cleanLine(value));
  const needsLanguageNormalization = summaryNeedsLanguageNormalization(normalizedSummary, outputLanguage);

  const mergedBriefing = applySummaryOverridesToBriefing(briefing, normalizedSummary);
  const repairedSummary = (missingRequiredSection || needsLanguageNormalization)
    ? renderSummaryFromBriefing(mergedBriefing, outputLanguage)
    : normalizedSummary;

  return softenSummaryConfidenceLanguage(repairedSummary);
}

function renderHiringManagerBriefingReviewFromBriefing(briefing, outputLanguage = 'en') {
  const normalized = normalizeBriefing(briefing);
  const copy = getLocalizedBriefingCopy(outputLanguage);
  const candidateSnapshotLines = [
    normalized.candidate.location ? `${copy.locationLabel}${copy.labelSeparator}${normalized.candidate.location}` : '',
    normalized.candidate.preferred_location ? `${copy.preferredLocationLabel}${copy.labelSeparator}${normalized.candidate.preferred_location}` : '',
    normalized.candidate.nationality ? `${copy.nationalityLabel}${copy.labelSeparator}${normalized.candidate.nationality}` : '',
    normalized.candidate.gender ? `${copy.genderLabel}${copy.labelSeparator}${normalized.candidate.gender}` : '',
    normalized.candidate.notice_period ? `${copy.noticePeriodLabel}${copy.labelSeparator}${normalized.candidate.notice_period}` : '',
    normalized.candidate.languages.length > 0 ? `${copy.languagesLabel}${copy.labelSeparator}${normalized.candidate.languages.join(copy.listJoiner)}` : ''
  ].filter(Boolean);

  return normalizeGeneratedSummary([
    `${copy.candidateLabel}${copy.labelSeparator}${normalized.candidate.name || copy.genericCandidate}`,
    `${copy.targetRoleLabel}${copy.labelSeparator}${normalized.role.title || copy.genericRole}`,
    normalized.role.company ? `${copy.hiringCompanyLabel}${copy.labelSeparator}${normalized.role.company}` : '',
    normalized.role.hiring_manager ? `${copy.hiringManagerLabel}${copy.labelSeparator}${normalized.role.hiring_manager}` : '',
    '',
    copy.briefingSummaryHeading,
    normalized.fit_summary || copy.noSummary,
    '',
    copy.candidateSnapshotHeading,
    candidateSnapshotLines.length > 0 ? candidateSnapshotLines.join('\n') : copy.noSnapshot,
    '',
    copy.educationHeading,
    formatEducationLines(normalized.candidate.education, outputLanguage),
    '',
    copy.employmentHeading,
    formatEmploymentHistoryForReview(normalized.employment_history, outputLanguage),
    '',
    copy.relevantExperienceHeading,
    formatBulletLines(normalized.relevant_experience, outputLanguage),
    '',
    copy.matchRequirementsHeading,
    formatMatchRequirements(normalized.match_requirements, outputLanguage),
    '',
    copy.concernsHeading,
    formatBulletLines(normalized.potential_concerns, outputLanguage),
    '',
    copy.nextStepHeading,
    normalized.recommended_next_step || copy.noNextStep
  ].filter((line, index, array) => {
    if (line !== '') {
      return true;
    }

    return array[index - 1] !== '';
  }).join('\n'));
}

function composeHiringManagerBriefing({ briefing, recruiterSummary = '', outputLanguage = 'en' }) {
  const normalizedBriefing = normalizeBriefing(briefing);
  const reviewBriefing = recruiterSummary && recruiterSummary.trim()
    ? applySummaryOverridesToBriefing(normalizedBriefing, recruiterSummary)
    : normalizedBriefing;
  const validation = validateBriefing(reviewBriefing);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  return {
    briefing: validation.briefing,
    review: renderHiringManagerBriefingReviewFromBriefing(validation.briefing, outputLanguage)
  };
}

function prepareHiringManagerBriefingOutput({ briefing, recruiterSummary = '', outputLanguage = 'en' }) {
  const composed = composeHiringManagerBriefing({
    briefing,
    recruiterSummary,
    outputLanguage
  });

  return {
    ...composed,
    templateData: buildTemplateDataFromBriefing(composed.briefing, outputLanguage)
  };
}

function buildTemplateDataFromBriefing(briefing, outputLanguage = 'en') {
  const normalized = normalizeBriefing(briefing);
  const copy = getLocalizedBriefingCopy(outputLanguage);
  const firstEducation = normalized.candidate.education[0] || {};
  const firstEmployment = normalized.employment_history[0] || {};
  const generationDate = new Date();
  const educationEntries = normalized.candidate.education.map((entry) => {
    const displayParts = deriveEducationDisplayParts(entry);

    return {
      degree_name: displayParts.degreeName,
      field_of_study: displayParts.fieldOfStudy,
      university: entry.university,
      institution_name: entry.university,
      start_year: entry.start_year,
      end_year: entry.end_year,
      education_start_year: entry.start_year,
      education_end_year: entry.end_year,
      education_location: ''
    };
  });
  const candidateLanguages = normalized.candidate.languages.filter(Boolean);
  const candidateSkills = normalizeStringArray(normalized.candidate.skills);
  const candidateCertifications = normalizeStringArray(normalized.candidate.certifications);
  const matchRequirementEntries = normalized.match_requirements.map((entry) => {
    const requirement = cleanLine(entry.requirement);
    const evidence = cleanLine(entry.evidence);

    return {
      match_requirement_text: evidence
        ? `${requirement}: ${evidence}`
        : requirement
    };
  });

  const employmentHistory = normalized.employment_history.map((entry) => {
    const responsibilityBullets = entry.responsibilities.map((responsibility) => ({
      responsibility,
      responsibility_text: responsibility,
      responsibility_original_text: responsibility
    }));

    return {
      job_title: entry.job_title,
      company_name: entry.company_name,
      start_date: entry.start_date,
      end_date: entry.end_date,
      employment_start_date: entry.start_date,
      employment_end_date: entry.end_date,
      responsibilities: responsibilityBullets.map((item) => ({
        responsibility: item.responsibility
      })),
      responsibility_bullets: responsibilityBullets
    };
  });
  const legacyEmploymentHistory = employmentHistory.map((entry) => ({
    job_title: entry.job_title,
    company_name: entry.company_name,
    start_date: entry.start_date,
    end_date: entry.end_date,
    responsibilities: entry.responsibilities
  }));
  const projectExperiences = normalized.project_experiences.map((entry) => ({
    project_name: entry.project_name,
    project_summary: entry.project_summary,
    project_start_date: entry.project_start_date,
    project_end_date: entry.project_end_date,
    project_timeline_basis: entry.project_timeline_basis,
    linked_job_title: entry.linked_job_title,
    linked_company_name: entry.linked_company_name,
    project_bullets: normalizeStringArray(entry.project_bullets).map((bullet, index) => ({
      project_bullet_text: bullet,
      project_bullet_original_text: entry.project_bullet_originals?.[index] || bullet
    }))
  }));

  const fitSummary = normalized.fit_summary;

  const baseData = {
    candidate_name: normalized.candidate.name,
    hiring_manager: normalized.role.hiring_manager || normalized.role.company,
    hiring_manager_name: normalized.role.hiring_manager || normalized.role.company,
    role_title: normalized.role.title,
    employment_history: legacyEmploymentHistory,
    employment_experience_entries: employmentHistory,
    fit_summary: fitSummary,
    employment_experience: employmentHistory
      .map((entry) => {
        const lines = [];
        const titleLine = [entry.job_title, entry.company_name].filter(Boolean).join(' | ');
        const dateLine = formatDateRange(entry.start_date, entry.end_date, outputLanguage);

        if (titleLine) {
          lines.push(titleLine);
        }

        if (dateLine) {
          lines.push(dateLine);
        }

        entry.responsibilities.forEach((item) => {
          if (item.responsibility) {
            lines.push(`- ${item.responsibility}`);
          }
        });

        return lines.join('\n');
      })
      .filter(Boolean)
      .join('\n\n'),
    relevant_experience: formatBulletLines(normalized.relevant_experience, outputLanguage),
    match_requirements: formatMatchRequirements(normalized.match_requirements, outputLanguage),
    potential_concerns: formatBulletLines(normalized.potential_concerns, outputLanguage),
    recommended_next_step: normalized.recommended_next_step,
    candidate_summary: fitSummary,
    key_summary: fitSummary,
    candidate_english_name: normalized.candidate.name,
    candidate_original_name: normalized.candidate.name,
    candidate_gender: normalized.candidate.gender,
    candidate_date_of_birth: normalized.candidate.date_of_birth,
    candidate_nationality: normalized.candidate.nationality,
    candidate_location: normalized.candidate.location,
    candidate_current_location: normalized.candidate.location,
    candidate_preferred_location: normalized.candidate.preferred_location,
    candidate_languages: candidateLanguages.join(copy.listJoiner),
    candidate_skills: candidateSkills.join(copy.listJoiner),
    candidate_certifications: candidateCertifications.join(copy.listJoiner),
    candidate_language_1: normalized.candidate.languages[0] || '',
    candidate_language_2: normalized.candidate.languages[1] || '',
    notice_period: normalized.candidate.notice_period,
    education_entries: educationEntries,
    education_summary: educationEntries
      .map((entry) => {
        const lines = [];
        if (entry.degree_name) {
          lines.push(entry.degree_name);
        }
        const organizationLine = [entry.university, formatDateRange(entry.start_year, entry.end_year, outputLanguage)].filter(Boolean).join(copy.organizationSeparator);
        if (organizationLine) {
          lines.push(organizationLine);
        }
        return lines.join('\n');
      })
      .filter(Boolean)
      .join('\n\n'),
    degree_name: deriveEducationDisplayParts(firstEducation).degreeName || '',
    field_of_study: deriveEducationDisplayParts(firstEducation).fieldOfStudy || '',
    university: firstEducation.university || '',
    institution_name: firstEducation.university || '',
    start_year: firstEducation.start_year || '',
    end_year: firstEducation.end_year || '',
    education_start_year: firstEducation.start_year || '',
    education_end_year: firstEducation.end_year || '',
    education_location: '',
    job_title: firstEmployment.job_title || '',
    company_name: firstEmployment.company_name || '',
    start_date: firstEmployment.start_date || '',
    end_date: firstEmployment.end_date || '',
    employment_start_date: firstEmployment.start_date || '',
    employment_end_date: firstEmployment.end_date || '',
    responsibility_bullets: firstEmployment.responsibility_bullets || [],
    responsibility_text: firstEmployment.responsibility_bullets?.[0]?.responsibility_text || '',
    responsibility_original_text: firstEmployment.responsibility_bullets?.[0]?.responsibility_original_text || '',
    job_responsibility_1: firstEmployment.responsibilities?.[0] || '',
    job_responsibility_2: firstEmployment.responsibilities?.[1] || '',
    match_requirement_entries: matchRequirementEntries,
    match_requirement_text: matchRequirementEntries[0]?.match_requirement_text || '',
    project_experience_entries: projectExperiences,
    project_name: projectExperiences[0]?.project_name || '',
    linked_job_title: projectExperiences[0]?.linked_job_title || '',
    linked_company_name: projectExperiences[0]?.linked_company_name || '',
    project_start_date: projectExperiences[0]?.project_start_date || '',
    project_end_date: projectExperiences[0]?.project_end_date || '',
    project_timeline_basis: projectExperiences[0]?.project_timeline_basis || '',
    project_bullets: projectExperiences[0]?.project_bullets || [],
    project_bullet_text: projectExperiences[0]?.project_bullets?.[0]?.project_bullet_text || '',
    project_bullet_original_text: projectExperiences[0]?.project_bullets?.[0]?.project_bullet_original_text || '',
    original_authoritative_appendix: [
      {
        employment_experience_entries: employmentHistory.map((entry) => ({
          ...entry,
          responsibility_bullets: entry.responsibility_bullets.map((item) => ({
            responsibility_original_text: item.responsibility_original_text || item.responsibility_text || ''
          }))
        })),
        project_experience_entries: projectExperiences.map((entry) => ({
          ...entry,
          project_bullets: entry.project_bullets.map((item) => ({
            project_bullet_original_text: item.project_bullet_original_text || item.project_bullet_text || ''
          }))
        }))
      }
    ],
    generation_date: generationDate.toISOString().slice(0, 10),
    generation_timestamp: generationDate.toISOString()
  };

  return {
    ...baseData,
    Candidate_Name: baseData.candidate_name,
    'Hiring Manager': baseData.hiring_manager,
    Candidate_Summary: baseData.fit_summary,
    hiring_manager_name: baseData.hiring_manager_name,
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

function parseBriefingResponse(responseText) {
  const jsonPayload = extractJsonPayload(responseText);

  if (!jsonPayload) {
    throw new Error('The LLM did not return a structured briefing payload.');
  }

  let parsed;

  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(`The LLM did not return valid JSON for the structured briefing. ${error.message}`);
  }

  return normalizeBriefing(parsed);
}

function buildBriefingRepairRequest({ malformedResponse, expectedBriefing = createEmptyBriefing() }) {
  const prompt = [
    'Repair the following malformed structured briefing JSON.',
    'Do not change wording, meaning, or structure beyond what is required to make it valid JSON.',
    'Return only valid JSON.',
    'Expected JSON shape:',
    JSON.stringify(normalizeBriefing(expectedBriefing), null, 2),
    '',
    'Malformed JSON response:',
    String(malformedResponse || '')
  ].join('\n');

  return {
    prompt,
    messages: [
      {
        role: 'system',
        content: 'You repair malformed structured briefing JSON. Return only valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
}

function buildBriefingRequest({
  cvDocument,
  jdDocument,
  systemPrompt,
  templateGuidance = null,
  sourceModel = null,
  outputMode = 'named',
  outputLanguage = 'en'
}) {
  const candidateName = extractCandidateName(cvDocument.text, cvDocument.file.name);
  const roleTitle = extractRoleTitle(jdDocument.text, jdDocument.file.name);
  const normalizedOutputLanguage = normalizeOutputLanguage(outputLanguage);
  const resolvedTemplateGuidance = resolveTemplateGuidance(templateGuidance, normalizedOutputLanguage);
  const requirements = extractRequirements(jdDocument.text);
  const workspaceSourceModel = sourceModel || buildWorkspaceSourceModel({
    cvDocument,
    jdDocument,
    templateGuidance: resolvedTemplateGuidance
  });
  const sourceSelection = selectWorkspaceSourceBlocks(workspaceSourceModel, {
    queryText: buildWorkspaceRetrievalQuery({
      candidateName,
      roleTitle,
      requirements,
      summaryHeadingHints: ['briefing summary', 'candidate snapshot', 'employment experience', 'match against key requirements']
    }),
    limits: {
      cv: 10,
      jd: 7,
      guidance: 1
    },
    preferredSectionKeysByDocumentType: {
      cv: ['overview', 'experience', 'projects', 'skills', 'education', 'languages'],
      jd: ['overview', 'requirements', 'responsibilities'],
      guidance: ['overview', 'fit', 'experience', 'requirements']
    }
  });
  const cvSourceContext = renderSourceBlocksContext(sourceSelection.selectionByDocumentType.cv);
  const jdSourceContext = renderSourceBlocksContext(sourceSelection.selectionByDocumentType.jd);
  const normalizedOutputMode = outputMode === 'anonymous' ? 'anonymous' : 'named';
  const modeDescriptor = normalizedOutputMode === 'anonymous' ? 'an anonymous' : 'a named';
  const candidateLabel = normalizedOutputMode === 'anonymous'
    ? ANONYMOUS_CANDIDATE_LABEL
    : candidateName;
  const summaryPrompt = buildSummaryPrompt({
    candidateName: candidateLabel,
    roleTitle,
    cvText: cvSourceContext,
    jdText: jdSourceContext,
    outputMode: normalizedOutputMode,
    outputLanguage: normalizedOutputLanguage
  });

  const prompt = [
    `Create ${modeDescriptor} grounded structured candidate briefing object from the CV and JD.`,
    `Candidate: ${candidateLabel}`,
    `Target role: ${roleTitle}`,
    '',
    'Return only valid JSON. Do not wrap the answer in markdown or prose.',
    'Do not invent candidate facts, employers, dates, or role-fit claims.',
    'If a field is not supported by the CV or JD, return an empty string or empty array.',
    'Use grounded, sufficiently detailed hiring-manager-ready language for narrative fields. Do not be overly terse.',
    isChineseOutputLanguage(normalizedOutputLanguage)
      ? 'Write narrative and human-readable text fields in Simplified Chinese.'
      : 'Write narrative and human-readable text fields in English.',
    isChineseOutputLanguage(normalizedOutputLanguage)
      ? 'For human-readable fields such as candidate snapshot values, education entries, employment-history titles, and employment-history responsibilities, translate source-language prose into Simplified Chinese while preserving proper nouns, employer names, and technical identifiers where appropriate.'
      : 'For human-readable fields such as candidate snapshot values, education entries, employment-history titles, and employment-history responsibilities, translate source-language prose into English while preserving proper nouns, employer names, and technical identifiers where appropriate.',
    isChineseOutputLanguage(normalizedOutputLanguage)
      ? 'Do not leave whole narrative fields in English when the requested output language is Simplified Chinese.'
      : 'Do not leave whole narrative fields in Chinese when the requested output language is English.',
    'Preserve exact names, employers, qualifications, and other source facts in their original form when appropriate.',
    'The recruiter summary is generated separately. This structured object should preserve exact candidate facts and grounded hiring-manager briefing content.',
    'The `fit_summary` field should align with the recruiter summary key points and be suitable for the hiring-manager briefing summary section.',
    ...(normalizedOutputMode === 'anonymous'
      ? [
        `Set \`candidate.name\` to \`${ANONYMOUS_CANDIDATE_LABEL}\`.`,
        isChineseOutputLanguage(normalizedOutputLanguage)
          ? 'In narrative fields such as `fit_summary`, `relevant_experience`, and `recommended_next_step`, refer to the person as “该候选人” or “候选人” instead of repeating the anonymous label.'
          : 'In narrative fields such as `fit_summary`, `relevant_experience`, and `recommended_next_step`, refer to the person as "the candidate" or "this candidate" instead of repeating the anonymous label.',
        'Do not include the candidate’s real name, email, phone number, LinkedIn URL, or exact street address in any structured field.'
      ]
      : []),
    '',
    'JSON schema:',
    JSON.stringify(createEmptyBriefing(), null, 2),
    '',
    'Important field rules:',
    '- `candidate.languages` should be an array of strings.',
    '- `candidate.education` should be an array of objects.',
    '- `candidate.skills` and `candidate.certifications` should be arrays of strings when supported by the CV.',
    '- `match_requirements` should be an array of objects with `requirement` and `evidence`.',
    '- `employment_history` should be reverse chronological, using CV-supported roles only.',
    '- `employment_history[].responsibilities` should be arrays of concise bullet-ready strings.',
    '- `project_experiences` should contain standalone or source-supported project entries when they are present in the CV.',
    '- `evidence_refs` fields are optional, but include them when they help ground material facts.',
    '',
    resolvedTemplateGuidance.usesDefaultTemplate
      ? 'Recruiter summary template guidance:'
      : `Selected reference template guidance (${resolvedTemplateGuidance.label}):`,
    resolvedTemplateGuidance.content,
    ...(resolvedTemplateGuidance.usesDefaultTemplate ? [] : [
      '',
      'Required recruiter summary structure for the in-app review surface:',
      getDefaultTemplateForLanguage(normalizedOutputLanguage)
    ]),
    '',
    'Current recruiter summary drafting prompt for tone and structure guidance:',
    summaryPrompt,
    '',
    'Candidate CV source blocks:',
    cvSourceContext,
    '',
    'Job Description source blocks:',
    jdSourceContext
  ].join('\n');

  return {
    templateLabel: resolvedTemplateGuidance.label || getDefaultTemplateLabel(normalizedOutputLanguage),
    prompt,
    retrievalManifest: sourceSelection.retrievalManifest,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
}

function applySummaryOverridesToBriefing(briefing, summary) {
  const normalized = normalizeBriefing(briefing);
  const sections = parseStructuredSummary(summary);

  return normalizeBriefing({
    ...normalized,
    candidate: {
      ...normalized.candidate,
      name: sections.candidate_name || normalized.candidate.name
    },
    role: {
      ...normalized.role,
      title: sections.role_title || normalized.role.title
    },
    fit_summary: sections.fit_summary || normalized.fit_summary,
    relevant_experience:
      parseBulletSection(sections.relevant_experience).length > 0
        ? parseBulletSection(sections.relevant_experience)
        : normalized.relevant_experience,
    match_requirements:
      parseMatchRequirementSection(sections.match_requirements).length > 0
        ? parseMatchRequirementSection(sections.match_requirements)
        : normalized.match_requirements,
    potential_concerns:
      parseBulletSection(sections.potential_concerns).length > 0
        ? parseBulletSection(sections.potential_concerns)
        : normalized.potential_concerns,
    recommended_next_step: sections.recommended_next_step || normalized.recommended_next_step
  });
}

module.exports = {
  BRIEFING_SCHEMA_VERSION,
  applySummaryOverridesToBriefing,
  buildBriefingGenerationSettings,
  buildBriefingRequest,
  buildBriefingRepairRequest,
  buildFallbackBriefing,
  buildTemplateDataFromBriefing,
  composeDeterministicReportBriefing,
  composeHiringManagerBriefing,
  createEmptyBriefing,
  mergeBriefingWithFallback,
  normalizeBriefing,
  parseBriefingResponse,
  prepareHiringManagerBriefingOutput,
  repairRecruiterSummary,
  renderHiringManagerBriefingReviewFromBriefing,
  renderSummaryFromBriefing,
  validateBriefing
};

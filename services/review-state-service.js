function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSourceRefs(sourceRefs) {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .filter((sourceRef) => sourceRef && typeof sourceRef === 'object')
    .map((sourceRef) => ({
      documentType: cleanLine(sourceRef.documentType),
      blockId: cleanLine(sourceRef.blockId),
      sectionKey: cleanLine(sourceRef.sectionKey),
      sectionLabel: cleanLine(sourceRef.sectionLabel),
      sourceName: cleanLine(sourceRef.sourceName),
      sourcePath: cleanLine(sourceRef.sourcePath),
      excerpt: cleanLine(sourceRef.excerpt)
    }));
}

function normalizeEvidenceRefs(evidenceRefs) {
  if (!Array.isArray(evidenceRefs)) {
    return [];
  }

  return evidenceRefs
    .filter((evidenceRef) => evidenceRef && typeof evidenceRef === 'object')
    .map((evidenceRef) => ({
      fieldPath: cleanLine(evidenceRef.fieldPath),
      value: cleanLine(evidenceRef.value),
      entryIndex: Number.isFinite(evidenceRef.entryIndex) ? Number(evidenceRef.entryIndex) : null
    }));
}

function normalizeAmbiguousEmploymentCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .filter((candidate) => candidate && typeof candidate === 'object')
    .map((candidate) => ({
      employmentIndex: Number.isFinite(candidate.employmentIndex) ? Number(candidate.employmentIndex) : null,
      companyName: cleanLine(candidate.companyName),
      jobTitle: cleanLine(candidate.jobTitle),
      startDate: cleanLine(candidate.startDate),
      endDate: cleanLine(candidate.endDate)
    }));
}

function getSectionLabel(section) {
  switch (cleanLine(section)) {
    case 'identity':
      return 'Candidate Identity';
    case 'role':
      return 'Role';
    case 'education':
      return 'Education';
    case 'employment':
      return 'Employment History';
    case 'projects':
      return 'Project Experiences';
    case 'requirements':
      return 'JD Requirements';
    default:
      return 'General';
  }
}

function getIssuePresentation(source, code) {
  const key = `${source}:${cleanLine(code)}`;

  switch (key) {
    case 'canonical-validation:candidate_name_missing_or_generic':
      return {
        title: 'Candidate name needs review',
        recommendedAction: 'Verify the candidate name in the loaded CV before approval or export.'
      };
    case 'canonical-validation:role_title_missing_or_generic':
      return {
        title: 'Role title needs review',
        recommendedAction: 'Verify the target role title in the loaded JD before approval or export.'
      };
    case 'canonical-validation:education_entry_malformed':
      return {
        title: 'Education entry is incomplete',
        recommendedAction: 'Review the flagged education row and confirm the degree and institution details.'
      };
    case 'canonical-validation:employment_entry_missing_core_fields':
      return {
        title: 'Employment row is incomplete',
        recommendedAction: 'Review the flagged employment row and restore the missing role or company details.'
      };
    case 'canonical-validation:employment_chronology_invalid':
      return {
        title: 'Employment chronology is invalid',
        recommendedAction: 'Review the flagged employment dates and correct the chronology before sharing.'
      };
    case 'canonical-validation:project_name_suspicious':
      return {
        title: 'Project title looks unreliable',
        recommendedAction: 'Review the flagged project title and remove section spillover or sentence fragments.'
      };
    case 'canonical-validation:project_role_ambiguous':
      return {
        title: 'Project-role linkage is ambiguous',
        recommendedAction: 'Review the flagged project against the competing employment rows and confirm the correct linkage.'
      };
    case 'canonical-validation:jd_requirements_missing':
      return {
        title: 'JD requirements are missing',
        recommendedAction: 'Review the loaded JD and confirm the key requirements were extracted correctly.'
      };
    case 'word-report-quality:word_report_candidate_name_generic':
      return {
        title: 'Word candidate name looks generic',
        recommendedAction: 'Review the candidate identity fields before export. The current Word payload does not look reliable.'
      };
    case 'word-report-quality:word_report_role_title_generic':
      return {
        title: 'Word role title looks generic',
        recommendedAction: 'Review the role title fields before export. The current Word payload does not look reliable.'
      };
    case 'word-report-quality:word_report_education_overflow':
      return {
        title: 'Word education section looks over-expanded',
        recommendedAction: 'Review the education extraction before export. Too many education rows were produced.'
      };
    case 'word-report-quality:word_report_education_entry_empty':
    case 'word-report-quality:word_report_education_entry_merged_fields':
    case 'word-report-quality:word_report_education_entry_polluted':
      return {
        title: 'Word education entry needs review',
        recommendedAction: 'Review the flagged education row in the report payload before export.'
      };
    case 'word-report-quality:word_report_employment_history_missing':
      return {
        title: 'Word employment history is missing',
        recommendedAction: 'Review the employment extraction before export. The current Word payload is missing employment history.'
      };
    case 'word-report-quality:word_report_employment_entry_empty':
    case 'word-report-quality:word_report_employment_role_skill_heading':
    case 'word-report-quality:word_report_employment_role_looks_like_company':
      return {
        title: 'Word employment entry needs review',
        recommendedAction: 'Review the flagged employment row in the report payload before export.'
      };
    case 'word-report-quality:word_report_project_experience_over_expanded':
    case 'word-report-quality:word_report_project_experience_unreliable':
      return {
        title: 'Word project section needs review',
        recommendedAction: 'Review the project extraction before export. The current Word payload is not reliable yet.'
      };
    default:
      return {
        title: 'Review required',
        recommendedAction: 'Review the flagged section before approval or export.'
      };
  }
}

function buildReviewIssue({
  source,
  code,
  severity,
  section,
  entryIndex = null,
  message,
  sourceRefs = [],
  evidenceRefs = [],
  ambiguousEmploymentCandidates = [],
  projectName = '',
  projectStartDate = '',
  projectEndDate = ''
}) {
  const presentation = getIssuePresentation(source, code);
  const normalizedSeverity = cleanLine(severity) === 'amber' ? 'amber' : 'red';

  return {
    source,
    code: cleanLine(code),
    severity: normalizedSeverity,
    section: cleanLine(section),
    sectionLabel: getSectionLabel(section),
    entryIndex: Number.isFinite(entryIndex) ? Number(entryIndex) : null,
    title: presentation.title,
    message: cleanLine(message),
    recommendedAction: presentation.recommendedAction,
    exportPosture: normalizedSeverity === 'red' ? 'blocked' : 'review-required',
    sourceRefs: normalizeSourceRefs(sourceRefs),
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    ambiguousEmploymentCandidates: normalizeAmbiguousEmploymentCandidates(ambiguousEmploymentCandidates),
    projectName: cleanLine(projectName),
    projectStartDate: cleanLine(projectStartDate),
    projectEndDate: cleanLine(projectEndDate)
  };
}

function buildCanonicalReviewIssues(summary) {
  if (!summary || typeof summary !== 'object' || !Array.isArray(summary.issues)) {
    return [];
  }

  return summary.issues
    .filter((issue) => issue && typeof issue === 'object' && cleanLine(issue.code))
    .map((issue) => buildReviewIssue({
      source: 'canonical-validation',
      code: issue.code,
      severity: cleanLine(issue.severity) === 'amber' ? 'amber' : 'red',
      section: issue.section,
      entryIndex: issue.entryIndex,
      message: issue.message,
      sourceRefs: issue.sourceRefs,
      ambiguousEmploymentCandidates: issue.ambiguousEmploymentCandidates,
      projectName: issue.projectName,
      projectStartDate: issue.projectStartDate,
      projectEndDate: issue.projectEndDate
    }));
}

function buildReportQualityReviewIssues(validation) {
  if (!validation || typeof validation !== 'object' || !Array.isArray(validation.issues)) {
    return [];
  }

  return validation.issues
    .filter((issue) => issue && typeof issue === 'object' && cleanLine(issue.code))
    .map((issue) => buildReviewIssue({
      source: 'word-report-quality',
      code: issue.code,
      severity: 'red',
      section: issue.section,
      entryIndex: issue.entryIndex,
      message: issue.message,
      evidenceRefs: issue.evidenceRefs
    }));
}

function uniqueSections(issues) {
  const seen = new Set();
  const sections = [];

  for (const issue of issues) {
    const section = cleanLine(issue.section);

    if (!section || seen.has(section)) {
      continue;
    }

    seen.add(section);
    sections.push(section);
  }

  return sections;
}

function buildReviewState({
  canonicalValidationSummary = null,
  reportQualityValidation = null
} = {}) {
  const canonicalIssues = buildCanonicalReviewIssues(canonicalValidationSummary);
  const reportIssues = buildReportQualityReviewIssues(reportQualityValidation);
  const issues = [...canonicalIssues, ...reportIssues];
  const state = issues.some((issue) => issue.severity === 'red')
    ? 'red'
    : issues.some((issue) => issue.severity === 'amber')
      ? 'amber'
      : 'green';
  const exportPosture = state === 'red'
    ? 'blocked'
    : state === 'amber'
      ? 'review-required'
      : 'allowed';

  return {
    state,
    exportPosture,
    affectedSections: uniqueSections(issues),
    issueCount: issues.length,
    blockedIssueCount: issues.filter((issue) => issue.exportPosture === 'blocked').length,
    reviewRequiredIssueCount: issues.filter((issue) => issue.exportPosture === 'review-required').length,
    issues
  };
}

module.exports = {
  buildReviewState
};

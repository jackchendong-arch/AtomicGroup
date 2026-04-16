function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstObject(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  return values.find((value) => value && typeof value === 'object') || null;
}

function buildReviewIssueKey(issue) {
  if (!issue || typeof issue !== 'object') {
    return '';
  }

  const firstSourceRef = firstObject(issue.sourceRefs);
  const firstEvidenceRef = firstObject(issue.evidenceRefs);
  const parts = [
    cleanLine(issue.source),
    cleanLine(issue.code),
    cleanLine(issue.section),
    Number.isFinite(issue.entryIndex) ? String(issue.entryIndex) : '',
    cleanLine(issue.projectName),
    cleanLine(issue.projectStartDate),
    cleanLine(issue.projectEndDate),
    cleanLine(firstSourceRef?.sourcePath),
    cleanLine(firstSourceRef?.blockId),
    cleanLine(firstEvidenceRef?.fieldPath),
    cleanLine(firstEvidenceRef?.value)
  ];

  return parts.join('::');
}

function normalizeDecisionType(value) {
  const normalized = cleanLine(value);

  if (normalized === 'keep-project-unlinked') {
    return 'keep-project-unlinked';
  }

  return normalized === 'mark-reviewed' ? 'mark-reviewed' : '';
}

function normalizeReviewDecisions(reviewDecisions) {
  if (!Array.isArray(reviewDecisions)) {
    return [];
  }

  const seenKeys = new Set();
  const normalized = [];

  for (const decision of reviewDecisions) {
    if (!decision || typeof decision !== 'object') {
      continue;
    }

    const issueKey = cleanLine(decision.issueKey);
    const decisionType = normalizeDecisionType(decision.decisionType);

    if (!issueKey || !decisionType || seenKeys.has(issueKey)) {
      continue;
    }

    seenKeys.add(issueKey);
    normalized.push({
      issueKey,
      decisionType,
      decidedAt: cleanLine(decision.decidedAt),
      source: cleanLine(decision.source),
      code: cleanLine(decision.code),
      section: cleanLine(decision.section),
      entryIndex: Number.isFinite(decision.entryIndex) ? Number(decision.entryIndex) : null,
      projectName: cleanLine(decision.projectName),
      projectStartDate: cleanLine(decision.projectStartDate),
      projectEndDate: cleanLine(decision.projectEndDate)
    });
  }

  return normalized;
}

function buildAvailableReviewActions(issue) {
  if (!issue || typeof issue !== 'object' || cleanLine(issue.severity) !== 'amber') {
    return [];
  }

  if (cleanLine(issue.code) === 'project_role_ambiguous') {
    return [
      {
        decisionType: 'mark-reviewed',
        label: 'Mark Reviewed',
        description: 'Record that the ambiguity was reviewed and allow export to proceed.'
      },
      {
        decisionType: 'keep-project-unlinked',
        label: 'Keep Project Unlinked',
        description: 'Keep the project intentionally unlinked to a role and allow export to proceed.'
      }
    ];
  }

  return [
    {
      decisionType: 'mark-reviewed',
      label: 'Mark Reviewed',
      description: 'Record the amber issue as reviewed and allow export to proceed.'
    }
  ];
}

function isDecisionAllowedForIssue(issue, decisionType) {
  return buildAvailableReviewActions(issue).some((action) => action.decisionType === normalizeDecisionType(decisionType));
}

function getAppliedReviewDecision(issue, reviewDecisions) {
  const issueKey = buildReviewIssueKey(issue);

  if (!issueKey) {
    return null;
  }

  const decision = normalizeReviewDecisions(reviewDecisions).find((candidate) => candidate.issueKey === issueKey);

  if (!decision || !isDecisionAllowedForIssue(issue, decision.decisionType)) {
    return null;
  }

  return decision;
}

function filterReviewDecisionsForIssues(reviewDecisions, issues) {
  const normalizedDecisions = normalizeReviewDecisions(reviewDecisions);

  if (!Array.isArray(issues) || issues.length === 0 || normalizedDecisions.length === 0) {
    return [];
  }

  const issueMap = new Map(
    issues
      .filter((issue) => issue && typeof issue === 'object')
      .map((issue) => [buildReviewIssueKey(issue), issue])
      .filter(([issueKey]) => issueKey)
  );

  return normalizedDecisions.filter((decision) => {
    const issue = issueMap.get(decision.issueKey);
    return issue ? isDecisionAllowedForIssue(issue, decision.decisionType) : false;
  });
}

module.exports = {
  buildAvailableReviewActions,
  buildReviewIssueKey,
  filterReviewDecisionsForIssues,
  getAppliedReviewDecision,
  normalizeReviewDecisions
};

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReviewState } = require('../../services/review-state-service');

test('buildReviewState returns green and allowed when no issues are present', () => {
  const reviewState = buildReviewState({
    canonicalValidationSummary: {
      state: 'green',
      issues: []
    },
    reportQualityValidation: {
      isValid: true,
      blockers: [],
      issues: []
    }
  });

  assert.equal(reviewState.state, 'green');
  assert.equal(reviewState.exportPosture, 'allowed');
  assert.equal(reviewState.issueCount, 0);
  assert.deepEqual(reviewState.affectedSections, []);
  assert.deepEqual(reviewState.issues, []);
});

test('buildReviewState maps canonical amber ambiguity into a review-required issue', () => {
  const reviewState = buildReviewState({
    canonicalValidationSummary: {
      state: 'amber',
      issues: [
        {
          code: 'project_role_ambiguous',
          severity: 'amber',
          section: 'projects',
          entryIndex: 0,
          message: 'Project entry 1 could not be linked to one role unambiguously.',
          projectName: '721Land – OpenSea-like NFT Marketplace',
          projectStartDate: '2021',
          projectEndDate: '2021',
          ambiguousEmploymentCandidates: [
            {
              employmentIndex: 0,
              companyName: 'Wanxiang Blockchain Inc., Shanghai',
              jobTitle: 'Blockchain Engineer',
              startDate: '2021',
              endDate: '2021'
            },
            {
              employmentIndex: 1,
              companyName: 'Shanghai Tancheng Data Technology Co., Ltd.',
              jobTitle: 'Full-Stack Engineer',
              startDate: '2020',
              endDate: '2021'
            }
          ],
          sourceRefs: [
            {
              documentType: 'cv',
              blockId: 'cv-projects-2',
              sectionKey: 'projects',
              sectionLabel: 'Projects',
              sourceName: 'CV4-2.pdf',
              sourcePath: '/Users/jack/Dev/Test/AtomicGroup/Role4/CV4-2.pdf',
              excerpt: '721Land – OpenSea-like NFT Marketplace (2021)'
            }
          ]
        }
      ]
    }
  });

  assert.equal(reviewState.state, 'amber');
  assert.equal(reviewState.exportPosture, 'review-required');
  assert.equal(reviewState.reviewRequiredIssueCount, 1);
  assert.equal(reviewState.issues[0].title, 'Project-role linkage is ambiguous');
  assert.equal(reviewState.issues[0].sectionLabel, 'Project Experiences');
  assert.equal(reviewState.issues[0].recommendedAction, 'Review the flagged project against the competing employment rows and confirm the correct linkage.');
  assert.equal(reviewState.issues[0].ambiguousEmploymentCandidates.length, 2);
  assert.equal(reviewState.issues[0].projectName, '721Land – OpenSea-like NFT Marketplace');
});

test('buildReviewState blocks export when a red Word-report issue is present', () => {
  const reviewState = buildReviewState({
    canonicalValidationSummary: {
      state: 'amber',
      issues: [
        {
          code: 'project_role_ambiguous',
          severity: 'amber',
          section: 'projects',
          entryIndex: 0,
          message: 'Project entry 1 could not be linked to one role unambiguously.',
          sourceRefs: []
        }
      ]
    },
    reportQualityValidation: {
      isValid: false,
      blockers: ['Candidate name looks generic, file-derived, or section-derived.'],
      issues: [
        {
          code: 'word_report_candidate_name_generic',
          section: 'identity',
          message: 'Candidate name looks generic, file-derived, or section-derived.',
          evidenceRefs: [
            {
              fieldPath: 'candidate_name',
              value: 'Technical Skills'
            }
          ]
        }
      ]
    }
  });

  assert.equal(reviewState.state, 'red');
  assert.equal(reviewState.exportPosture, 'blocked');
  assert.equal(reviewState.blockedIssueCount, 1);
  assert.equal(reviewState.reviewRequiredIssueCount, 1);
  assert.equal(reviewState.affectedSections.join(','), 'projects,identity');
  assert.equal(reviewState.issues[1].code, 'word_report_candidate_name_generic');
  assert.equal(reviewState.issues[1].title, 'Word candidate name looks generic');
  assert.equal(reviewState.issues[1].evidenceRefs[0].value, 'Technical Skills');
});

test('buildReviewState presents candidate identity contamination with targeted reviewer guidance', () => {
  const reviewState = buildReviewState({
    canonicalValidationSummary: {
      state: 'red',
      issues: [
        {
          code: 'candidate_name_embedded_metadata',
          severity: 'red',
          section: 'identity',
          message: 'Candidate name contains inline metadata or profile details.',
          sourceRefs: [
            {
              documentType: 'cv',
              blockId: 'cv-overview-1',
              sectionKey: 'overview',
              sectionLabel: 'Overview',
              sourceName: 'candidate.pdf',
              sourcePath: '/tmp/candidate.pdf',
              excerpt: '赵先生 Android开发工程师 | 男 | 英语六级'
            }
          ]
        }
      ]
    }
  });

  assert.equal(reviewState.state, 'red');
  assert.equal(reviewState.exportPosture, 'blocked');
  assert.equal(reviewState.issues[0].title, 'Candidate name contains profile metadata');
  assert.match(reviewState.issues[0].recommendedAction, /remove demographic, contact, or profile details/i);
});

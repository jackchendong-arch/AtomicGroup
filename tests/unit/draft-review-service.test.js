const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDraftReviewWarnings } = require('../../services/draft-review-service');

function createBriefing(overrides = {}) {
  return {
    candidate: {
      name: 'Alex Wong',
      location: 'Hong Kong',
      languages: ['English'],
      ...overrides.candidate
    },
    role: {
      title: 'Engineering Director',
      company: 'Atomic Group',
      ...overrides.role
    },
    fit_summary: 'Strong alignment with the role.',
    relevant_experience: ['Led regional engineering delivery.'],
    match_requirements: [
      {
        requirement: 'Leadership',
        evidence: 'Led a regional platform team.',
        evidence_refs: ['cv-1']
      }
    ],
    potential_concerns: ['Limited insurance exposure.'],
    recommended_next_step: 'Proceed to hiring-manager review.',
    employment_history: [
      {
        job_title: 'Engineering Director',
        company_name: 'Atomic Group',
        start_date: '2021',
        end_date: 'Present',
        responsibilities: ['Led platform delivery.'],
        evidence_refs: ['cv-1']
      }
    ],
    evidence_refs: ['cv-1'],
    ...overrides
  };
}

test('buildDraftReviewWarnings flags missing recruiter-summary sections and incomplete evidence', () => {
  const warnings = buildDraftReviewWarnings({
    recruiterSummary: 'Candidate: Alex Wong\nTarget Role: Engineering Director',
    briefing: createBriefing({
      match_requirements: [
        {
          requirement: 'Leadership',
          evidence: '',
          evidence_refs: []
        }
      ],
      employment_history: []
    }),
    summaryRetrievalManifest: [],
    briefingRetrievalManifest: []
  });

  assert(warnings.includes('Recruiter summary is missing the fit summary section.'));
  assert(warnings.includes('Recruiter summary is missing the relevant experience section.'));
  assert(warnings.includes('Recruiter summary is missing the match against key requirements section.'));
  assert(warnings.includes('Recruiter summary is missing the recommended next step section.'));
  assert(warnings.includes('Hiring-manager briefing is missing employment history details.'));
  assert(warnings.includes('Several requirement matches do not include clear supporting evidence. Recheck the draft before approval.'));
  assert(warnings.includes('Source evidence is incomplete for this draft. Verify key claims manually before approval.'));
});

test('buildDraftReviewWarnings flags generic labels and overconfident language', () => {
  const warnings = buildDraftReviewWarnings({
    recruiterSummary: [
      '## Fit Summary',
      'This is a perfect match for the role with no gaps.',
      '## Relevant Experience',
      '- Led engineering delivery',
      '## Match Against Key Requirements',
      '- Leadership -> Led platform teams',
      '## Recommended Next Step',
      'Proceed immediately'
    ].join('\n'),
    briefing: createBriefing({
      candidate: {
        name: 'CV2.pdf'
      },
      role: {
        title: '岗位信息'
      },
      fit_summary: 'Perfect fit with no gaps.'
    }),
    summaryRetrievalManifest: [{ blockId: 'cv-1' }],
    briefingRetrievalManifest: [{ blockId: 'jd-1' }]
  });

  assert(warnings.includes('Candidate name looks generic or file-derived. Recheck the loaded CV before sharing.'));
  assert(warnings.includes('Role title looks generic or source-derived. Recheck the loaded JD before sharing.'));
  assert(warnings.includes('The draft uses strong certainty language. Verify that the evidence supports those claims before approval.'));
});

test('buildDraftReviewWarnings preserves existing privacy warnings and suppresses anonymous placeholder false positives', () => {
  const warnings = buildDraftReviewWarnings({
    recruiterSummary: [
      '## Fit Summary',
      'Strong alignment with the role.',
      '## Relevant Experience',
      '- Led engineering delivery',
      '## Match Against Key Requirements',
      '- Leadership -> Led platform teams',
      '## Recommended Next Step',
      'Proceed to hiring-manager review.'
    ].join('\n'),
    briefing: createBriefing({
      candidate: {
        name: 'Anonymous Candidate'
      }
    }),
    outputMode: 'anonymous',
    existingWarnings: ['Phone number content may still appear in the anonymized draft.'],
    summaryRetrievalManifest: [{ blockId: 'cv-1' }],
    briefingRetrievalManifest: [{ blockId: 'jd-1' }]
  });

  assert(warnings.includes('Phone number content may still appear in the anonymized draft.'));
  assert.equal(
    warnings.includes('Candidate name looks generic or file-derived. Recheck the loaded CV before sharing.'),
    false
  );
});

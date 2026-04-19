const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  prepareHiringManagerBriefingOutput,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const {
  formatWordReportQualityError,
  validateWordReportQuality
} = require('../../services/word-report-quality-service');

function buildTemplateDataFromBriefing(briefing) {
  const recruiterSummary = renderSummaryFromBriefing(briefing, 'en');
  return prepareHiringManagerBriefingOutput({
    briefing,
    recruiterSummary,
    outputLanguage: 'en'
  }).templateData;
}

test('validateWordReportQuality accepts a clean report view model', () => {
  const validation = validateWordReportQuality({
    candidate_name: 'Eugene Liu',
    role_title: 'Blockchain Developer',
    education_entries: [
      {
        degree_name: 'Bachelor of Engineering',
        institution_name: 'South China University of Technology'
      }
    ],
    employment_experience_entries: [
      {
        job_title: 'Backend Engineer',
        company_name: 'Delulu'
      }
    ],
    project_experience_entries: [
      {
        project_name: 'Low-Latency Solana Transaction Engine'
      },
      {
        project_name: 'Real-Time Leaderboard System'
      }
    ]
  });

  assert.equal(validation.isValid, true);
  assert.deepEqual(validation.blockers, []);
  assert.deepEqual(validation.issues, []);
});

test('validateWordReportQuality reports malformed factual sections clearly', () => {
  const validation = validateWordReportQuality({
    candidate_name: 'Technical Skills',
    role_title: 'Blockchain Developer',
    education_entries: [
      {
        degree_name: '',
        institution_name: 'Johns Hopkins University | 2022 - 2024'
      },
      {
        degree_name: 'Shanghai Xiaohan Technology Co., Ltd. — Blockchain Engineer',
        institution_name: ''
      }
    ],
    employment_experience_entries: [
      {
        job_title: 'PUFFER FINANCE',
        company_name: ''
      }
    ],
    project_experience_entries: [
      { project_name: 'dancing' },
      { project_name: 'of $5M' },
      { project_name: 'breed, and trade assets' }
    ]
  });

  assert.equal(validation.isValid, false);
  assert.match(formatWordReportQualityError(validation), /factual report sections look unreliable/i);
  assert(validation.blockers.some((message) => /Candidate name looks generic/i.test(message)));
  assert(validation.blockers.some((message) => /merged separator text/i.test(message)));
  assert(validation.blockers.some((message) => /company name was captured as the role title/i.test(message)));
  assert(validation.blockers.some((message) => /project names appear to be sentence fragments/i.test(message)));
  assert(validation.issues.some((issue) => issue.code === 'word_report_candidate_name_generic'));
  assert(validation.issues.some((issue) => issue.code === 'word_report_education_entry_merged_fields'));
  assert(validation.issues.some((issue) => issue.code === 'word_report_employment_role_looks_like_company'));
  assert(validation.issues.some((issue) => issue.code === 'word_report_project_experience_unreliable'));
  assert.equal(
    validation.issues.find((issue) => issue.code === 'word_report_candidate_name_generic')?.evidenceRefs?.[0]?.value,
    'Technical Skills'
  );
});

const ROLE4_ROOT = '/Users/jack/Dev/Test/AtomicGroup/Role4';
const JD4_PATH = path.join(ROLE4_ROOT, 'JD4.docx');

async function loadRole4TemplateData(cvFileName) {
  const cvDocument = await importDocument(path.join(ROLE4_ROOT, cvFileName));
  const jdDocument = await importDocument(JD4_PATH);
  const briefing = buildFallbackBriefing({
    cvDocument,
    jdDocument,
    outputLanguage: 'en'
  });

  return buildTemplateDataFromBriefing(briefing);
}

test(
  'Role4 CV4-3 passes the Word report quality gate',
  { skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-3.pdf')) && fs.existsSync(JD4_PATH) ? false : 'Role4 fixture files are not available on this machine.' },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-3.pdf');
    const validation = validateWordReportQuality(templateData);

    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.blockers, []);
  }
);

test(
  'Role4 CV4-1 now passes the Word report quality gate after compact Chinese education and project parsing fixes',
  { skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-1.pdf')) && fs.existsSync(JD4_PATH) ? false : 'Role4 fixture files are not available on this machine.' },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-1.pdf');
    const validation = validateWordReportQuality(templateData);

    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.blockers, []);
  }
);

test(
  'Role4 CV4-2 now passes the Word report quality gate after delayed-heading and project-continuation parsing fixes',
  { skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-2.pdf')) && fs.existsSync(JD4_PATH) ? false : 'Role4 fixture files are not available on this machine.' },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-2.pdf');
    const validation = validateWordReportQuality(templateData);

    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.blockers, []);
  }
);

test(
  'Role4 CV4-4 fails the Word report quality gate for the remaining generic candidate identity blocker',
  { skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-4.pdf')) && fs.existsSync(JD4_PATH) ? false : 'Role4 fixture files are not available on this machine.' },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-4.pdf');
    const validation = validateWordReportQuality(templateData);

    assert.equal(validation.isValid, false);
    assert(validation.blockers.some((message) => /candidate name looks generic/i.test(message)));
  }
);

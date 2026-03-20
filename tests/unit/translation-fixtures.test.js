const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  renderHiringManagerBriefingReviewFromBriefing,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const {
  extractDocumentDerivedProfile
} = require('../../services/hiring-manager-template-service');
const {
  applyTranslatedDraftPayload,
  createTranslatableDraftPayload
} = require('../../services/draft-translation-service');

const FIXTURE_ROOT = '/Users/jack/Dev/Test/AtomicGroup';

function fixtureExists(relativePath) {
  return fs.existsSync(path.join(FIXTURE_ROOT, relativePath));
}

test(
  'Test4 Chinese CV/JD fixture keeps employment-history content in the translatable payload and can render an English translated review',
  {
    skip: fixtureExists('Test4/CV4-1.pdf') && fixtureExists('Test4/JD4.docx')
      ? false
      : 'Test4 fixture documents are not available on this machine.'
  },
  async () => {
    const fixtureRoot = path.join(FIXTURE_ROOT, 'Test4');
    const cvDocument = await importDocument(path.join(fixtureRoot, 'CV4-1.pdf'));
    const jdDocument = await importDocument(path.join(fixtureRoot, 'JD4.docx'));

    assert.equal(cvDocument.error, null);
    assert.equal(jdDocument.error, null);

    const chineseBriefing = buildFallbackBriefing({
      cvDocument,
      jdDocument,
      outputLanguage: 'zh'
    });
    const chineseSummary = renderSummaryFromBriefing(chineseBriefing, 'zh');
    const payload = createTranslatableDraftPayload({
      summary: chineseSummary,
      briefing: chineseBriefing
    });

    assert.ok(payload.employment_history.length > 0, 'Test4 should expose employment history for translation');
    assert.equal(payload.employment_history[0].job_title, '软件工程师');
    assert.match(
      payload.employment_history[0].responsibilities[0],
      /使用 Go 语言|Go 语言/,
      'Test4 employment history should keep the original Chinese responsibility text before translation'
    );

    const translated = applyTranslatedDraftPayload({
      briefing: chineseBriefing,
      translatedPayload: {
        ...payload,
        summary: [
          'Candidate: Noah Zhang',
          'Target Role: Blockchain Developer',
          '',
          '## Fit Summary',
          'The candidate shows relevant blockchain and backend engineering experience for the role.'
        ].join('\n'),
        role: {
          ...payload.role,
          title: 'Blockchain Developer'
        },
        fit_summary: 'The candidate shows relevant blockchain and backend engineering experience for the role.',
        relevant_experience: [
          'Strong Web3 and blockchain fundamentals, including Solana transaction parsing and SPL Token familiarity.'
        ],
        match_requirements: payload.match_requirements.map((entry) => ({
          requirement: 'Hands-on Web3 wallet and blockchain integration experience',
          evidence: 'Worked on blockchain-related engineering tasks and backend service delivery.'
        })),
        potential_concerns: [
          'Some target-platform responsibilities are not explicitly evidenced in the current CV.'
        ],
        recommended_next_step: 'Proceed to recruiter review with follow-up questions on wallet-based identity and smart-contract integration.',
        employment_history: payload.employment_history.map((entry) => ({
          ...entry,
          job_title: 'Used Go to help build the company core order-processing service and develop the RESTful API and background task modules.',
          responsibilities: [
            'Delivered supporting backend modules for the order-processing service using the Go standard library.'
          ]
        }))
      }
    });

    const englishReview = renderHiringManagerBriefingReviewFromBriefing(translated.briefing, 'en');

    assert.match(englishReview, /## Employment Experience/);
    assert.match(englishReview, /Used Go to help build the company core order-processing service/i);
    assert.match(englishReview, /Delivered supporting backend modules for the order-processing service/i);
    assert.doesNotMatch(
      englishReview,
      /使用 Go 语言参与构建公司核心订单处理服务/,
      'The translated English review should not keep the original Chinese work-experience line'
    );
  }
);

test(
  'Test4 Chinese CV/JD fixture builds a clean fallback profile without leaking education into location or project text into work history',
  {
    skip: fixtureExists('Test4/CV4-1.pdf') && fixtureExists('Test4/JD4.docx')
      ? false
      : 'Test4 fixture documents are not available on this machine.'
  },
  async () => {
    const fixtureRoot = path.join(FIXTURE_ROOT, 'Test4');
    const cvDocument = await importDocument(path.join(fixtureRoot, 'CV4-1.pdf'));
    const jdDocument = await importDocument(path.join(fixtureRoot, 'JD4.docx'));

    const profile = extractDocumentDerivedProfile({ cvDocument, jdDocument });
    const englishBriefing = buildFallbackBriefing({
      cvDocument,
      jdDocument,
      outputLanguage: 'en'
    });
    const englishReview = renderHiringManagerBriefingReviewFromBriefing(englishBriefing, 'en');

    assert.equal(profile.candidateLocation, '');
    assert.equal(profile.employmentHistory.length, 1);
    assert.equal(profile.employmentHistory[0].jobTitle, '软件工程师');
    assert.equal(profile.employmentHistory[0].companyName, 'Sparksoft（ 技 术 研 发 部 ）');
    assert.equal(profile.employmentHistory[0].responsibilities.length, 3);
    assert.doesNotMatch(englishReview, /Location:\s*2017\.09/u);
    assert.doesNotMatch(englishReview, /基 于 Solana/u);
    assert.doesNotMatch(englishReview, /技能\/优势及其他/u);
  }
);

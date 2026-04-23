const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const PizZip = require('pizzip');

const { importDocument } = require('../../services/document-service');
const { buildCanonicalExtractionReview } = require('../../services/canonical-schema-service');
const {
  buildFallbackBriefing,
  prepareHiringManagerBriefingOutput,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const { anonymizeDraftOutput } = require('../../services/anonymization-service');
const {
  resolveWordReportAdapter,
  buildWordReportAdapterPayload
} = require('../../services/word-report-adapter-service');
const {
  renderHiringManagerWordDocument
} = require('../../services/hiring-manager-template-service');
const {
  EXTERNAL_FIXTURE_CASES,
  fixtureCaseHasValidContract,
  fixtureCaseIsPresent,
  getFixtureCvPath,
  getFixtureJdPath
} = require('./external-fixture-registry');

const ROLE4_ROOT = '/Users/jack/Dev/Test/AtomicGroup/Role4';
const JD4_PATH = path.join(ROLE4_ROOT, 'JD4.docx');
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/AtomicGroupCV_Template.dotx');
const OUTPUT_DIR = path.join('/tmp', 'atomicgroup-word-fidelity-fixtures');

const CURATED_FIDELITY_CASES = [
  {
    name: 'CV4-1',
    cvFileName: 'CV4-1.pdf',
    expectedCanonicalState: 'green',
    expectedCandidateName: 'Noah Zhang',
    expectedEducationCount: 2,
    expectedEmploymentCount: 1,
    minProjectCount: 2,
    requiredRenderedSnippets: ['Noah Zhang', '区块链开发工程师 (Blockchain Developer)', 'Johns Hopkins University'],
    forbiddenRenderedPatterns: [/\|\s*Johns Hopkins University/i]
  },
  {
    name: 'CV4-2',
    cvFileName: 'CV4-2.pdf',
    expectedCanonicalState: 'amber',
    expectedCandidateName: 'Chenhao Li',
    expectedIssueCodes: ['project_role_ambiguous'],
    expectedEducationCount: 2,
    expectedEmploymentCount: 5,
    minProjectCount: 13,
    requiredRenderedSnippets: ['Chenhao Li', '区块链开发工程师 (Blockchain Developer)', 'Cardiff University'],
    forbiddenRenderedPatterns: [/\|\s*Cardiff University/i]
  },
  {
    name: 'CV4-3',
    cvFileName: 'CV4-3.pdf',
    expectedCanonicalState: 'green',
    expectedCandidateName: 'Eugene Liu',
    expectedEducationCount: 1,
    expectedEmploymentCount: 6,
    minProjectCount: 3,
    requiredRenderedSnippets: ['Eugene Liu', '区块链开发工程师 (Blockchain Developer)', 'South China University of Technology'],
    forbiddenRenderedPatterns: []
  }
];

const EXTERNAL_FIDELITY_CASES = [
  {
    name: 'Test1',
    expectedCanonicalState: 'green',
    expectedCandidateName: 'JACK XIN DONG CHEN',
    expectedRoleTitle: 'Head of IT Transformation',
    expectedEducationCount: 1,
    expectedEmploymentCount: 6,
    expectedProjectCount: 0,
    requiredRenderedSnippets: ['JACK XIN DONG CHEN', 'Head of IT Transformation', 'University of Western Australia'],
    forbiddenRenderedPatterns: []
  },
  {
    name: 'Test2',
    expectedCanonicalState: 'green',
    expectedCandidateName: 'Xiaoshen CONG (Shawn)',
    expectedRoleTitle: 'Leadership Talent Acquisition Partner (VP), Technology Center',
    expectedEducationCount: 2,
    expectedEmploymentCount: 5,
    expectedProjectCount: 0,
    requiredRenderedSnippets: ['Xiaoshen CONG (Shawn)', 'Leadership Talent Acquisition Partner (VP), Technology Center', 'Coventry University'],
    forbiddenRenderedPatterns: [/\|\s*Coventry University/i]
  },
  {
    name: 'Test7',
    expectedCanonicalState: 'amber',
    expectedCandidateName: 'Chenhao Li',
    expectedRoleTitle: '区块链开发工程师 (Blockchain Developer)',
    expectedIssueCodes: ['project_role_ambiguous'],
    expectedEducationCount: 2,
    expectedEmploymentCount: 5,
    minProjectCount: 13,
    requiredRenderedSnippets: ['Chenhao Li', '区块链开发工程师 (Blockchain Developer)', 'Cardiff University'],
    forbiddenRenderedPatterns: [/\|\s*Cardiff University/i]
  }
];

function extractPlainTextFromDocx(buffer) {
  const zip = new PizZip(buffer);
  const documentXml = zip.file('word/document.xml');

  if (!documentXml) {
    return '';
  }

  return [...documentXml.asText().matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fixtureAvailable(cvFileName) {
  return fs.existsSync(path.join(ROLE4_ROOT, cvFileName)) &&
    fs.existsSync(JD4_PATH) &&
    fs.existsSync(TEMPLATE_PATH);
}

function externalFixtureAvailable(fixtureName) {
  const fixtureCase = EXTERNAL_FIXTURE_CASES.find((candidate) => candidate.name === fixtureName);

  return Boolean(
    fixtureCase &&
    fixtureCaseIsPresent(fixtureCase) &&
    fixtureCaseHasValidContract(fixtureCase) &&
    fs.existsSync(TEMPLATE_PATH)
  );
}

function getUniqueIssueCodes(validationSummary) {
  return [...new Set((validationSummary?.issues || []).map((issue) => issue.code))].sort();
}

async function buildFidelityFixture(cvFileName, { anonymous = false } = {}) {
  return buildFidelityFixtureFromPaths({
    cvPath: path.join(ROLE4_ROOT, cvFileName),
    jdPath: JD4_PATH,
    anonymous
  });
}

async function buildExternalFidelityFixture(fixtureName, { anonymous = false } = {}) {
  const fixtureCase = EXTERNAL_FIXTURE_CASES.find((candidate) => candidate.name === fixtureName);

  if (!fixtureCase || !fixtureCaseHasValidContract(fixtureCase)) {
    throw new Error(`External fixture ${fixtureName} is not available as a valid contract pair.`);
  }

  return buildFidelityFixtureFromPaths({
    cvPath: getFixtureCvPath(fixtureCase),
    jdPath: getFixtureJdPath(fixtureCase),
    anonymous
  });
}

async function buildFidelityFixtureFromPaths({ cvPath, jdPath, anonymous = false }) {
  const cvDocument = await importDocument(cvPath);
  const jdDocument = await importDocument(jdPath);
  const canonicalReview = buildCanonicalExtractionReview({ cvDocument, jdDocument });
  const baseBriefing = buildFallbackBriefing({
    cvDocument,
    jdDocument,
    outputLanguage: 'en'
  });
  const baseRecruiterSummary = renderSummaryFromBriefing(baseBriefing, 'en');
  const draftOutput = anonymous
    ? anonymizeDraftOutput({
      recruiterSummary: baseRecruiterSummary,
      briefing: baseBriefing,
      cvDocument,
      jdDocument
    })
    : {
      summary: baseRecruiterSummary,
      briefing: baseBriefing,
      warnings: []
    };
  const reportViewModel = prepareHiringManagerBriefingOutput({
    briefing: draftOutput.briefing,
    recruiterSummary: draftOutput.summary,
    outputLanguage: 'en'
  });
  const adapter = resolveWordReportAdapter({
    templatePath: TEMPLATE_PATH,
    templateName: path.basename(TEMPLATE_PATH)
  });
  const adapterPayload = buildWordReportAdapterPayload({
    adapter,
    briefing: draftOutput.briefing,
    recruiterSummary: draftOutput.summary,
    outputLanguage: 'en'
  });
  const outputPath = path.join(
    OUTPUT_DIR,
    `${path.basename(cvPath, path.extname(cvPath))}${anonymous ? '-anonymous' : ''}.docx`
  );
  const renderResult = await renderHiringManagerWordDocument({
    templatePath: TEMPLATE_PATH,
    outputPath,
    templateData: adapterPayload.templateData,
    validationOptions: adapterPayload.validationOptions
  });
  const renderedBuffer = await fsPromises.readFile(outputPath);

  return {
    canonicalReview,
    reportViewModel,
    adapterPayload,
    renderResult,
    renderedText: extractPlainTextFromDocx(renderedBuffer),
    anonymizationWarnings: draftOutput.warnings
  };
}

for (const fixtureCase of CURATED_FIDELITY_CASES) {
  test(
    `7E.1 curated Word fidelity stays stable for ${fixtureCase.name}`,
    {
      skip: fixtureAvailable(fixtureCase.cvFileName)
        ? false
        : 'Role4 fidelity fixture documents or tracked template are not available on this machine.'
    },
    async () => {
      const result = await buildFidelityFixture(fixtureCase.cvFileName);
      const issueCodes = getUniqueIssueCodes(result.canonicalReview.validationSummary);
      const reportTemplateData = result.reportViewModel.templateData;
      const payloadTemplateData = result.adapterPayload.templateData;

      assert.equal(result.canonicalReview.validationSummary.state, fixtureCase.expectedCanonicalState);
      assert.equal(result.canonicalReview.candidateSchema.identity.name, fixtureCase.expectedCandidateName);

      if (fixtureCase.expectedIssueCodes) {
        assert.deepEqual(issueCodes, fixtureCase.expectedIssueCodes);
      } else {
        assert.deepEqual(issueCodes, []);
      }

      assert.equal(reportTemplateData.education_entries.length, fixtureCase.expectedEducationCount);
      assert.equal(reportTemplateData.employment_experience_entries.length, fixtureCase.expectedEmploymentCount);
      assert.ok(reportTemplateData.project_experience_entries.length >= fixtureCase.minProjectCount);
      assert.doesNotMatch(reportTemplateData.education_field_institution_line || '', /^\s*\|/);
      assert.equal(
        reportTemplateData.project_experience_entries.some((entry) => /^\s*\|/.test(entry.project_role_company_line || '')),
        false
      );

      assert.equal(result.adapterPayload.templateIdentity, 'atomicgroupcv_template');
      assert.equal(payloadTemplateData.candidate_name, reportTemplateData.candidate_name);
      assert.equal(payloadTemplateData.role_title, reportTemplateData.role_title);
      assert.equal(payloadTemplateData.education_entries.length, reportTemplateData.education_entries.length);
      assert.equal(payloadTemplateData.employment_experience_entries.length, reportTemplateData.employment_experience_entries.length);
      assert.equal(payloadTemplateData.project_experience_entries.length, reportTemplateData.project_experience_entries.length);
      assert.doesNotMatch(payloadTemplateData.education_field_institution_line || '', /^\s*\|/);
      assert.equal(
        payloadTemplateData.project_experience_entries.some((entry) => /^\s*\|/.test(entry.project_role_company_line || '')),
        false
      );

      for (const snippet of fixtureCase.requiredRenderedSnippets) {
        assert.match(
          result.renderedText,
          new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
          `${fixtureCase.name} should render "${snippet}" in the final docx`
        );
      }

      for (const pattern of fixtureCase.forbiddenRenderedPatterns) {
        assert.doesNotMatch(result.renderedText, pattern);
      }

      assert.deepEqual(result.renderResult.postRenderValidation.unexpandedTags, []);
      assert.deepEqual(result.renderResult.postRenderValidation.renderedForbiddenSnippets, []);
      assert.deepEqual(result.renderResult.postRenderValidation.suspiciousSeparatorArtifacts, []);
    }
  );
}

test(
  '7E.1 curated anonymous export keeps the final Word document anonymous for CV4-1',
  {
    skip: fixtureAvailable('CV4-1.pdf')
      ? false
      : 'Role4 fidelity fixture documents or tracked template are not available on this machine.'
  },
  async () => {
    const result = await buildFidelityFixture('CV4-1.pdf', { anonymous: true });
    const reportTemplateData = result.reportViewModel.templateData;
    const payloadTemplateData = result.adapterPayload.templateData;

    assert.equal(result.canonicalReview.validationSummary.state, 'green');
    assert.equal(result.canonicalReview.candidateSchema.identity.name, 'Noah Zhang');
    assert.equal(reportTemplateData.candidate_name, 'Anonymous Candidate');
    assert.equal(payloadTemplateData.candidate_name, 'Anonymous Candidate');
    assert.equal(payloadTemplateData.education_entries.length, 2);
    assert.equal(payloadTemplateData.employment_experience_entries.length, 1);
    assert.ok(payloadTemplateData.project_experience_entries.length >= 2);
    assert.doesNotMatch(payloadTemplateData.education_field_institution_line || '', /^\s*\|/);
    assert.equal(JSON.stringify(payloadTemplateData).includes('Noah Zhang'), false);
    assert.equal(result.anonymizationWarnings.length, 0);
    assert.match(result.renderedText, /Anonymous Candidate/i);
    assert.doesNotMatch(result.renderedText, /Noah Zhang/i);
    assert.doesNotMatch(result.renderedText, /\|\s*Johns Hopkins University/i);
    assert.match(result.renderedText, /Johns Hopkins University/i);
    assert.deepEqual(result.renderResult.postRenderValidation.renderedForbiddenSnippets, []);
    assert.deepEqual(result.renderResult.postRenderValidation.suspiciousSeparatorArtifacts, []);
  }
);

for (const fixtureCase of EXTERNAL_FIDELITY_CASES) {
  test(
    `7E.2 expanded Word fidelity stays stable for ${fixtureCase.name}`,
    {
      skip: externalFixtureAvailable(fixtureCase.name)
        ? false
        : 'External fidelity fixture documents or tracked template are not available on this machine.'
    },
    async () => {
      const result = await buildExternalFidelityFixture(fixtureCase.name);
      const issueCodes = getUniqueIssueCodes(result.canonicalReview.validationSummary);
      const reportTemplateData = result.reportViewModel.templateData;
      const payloadTemplateData = result.adapterPayload.templateData;

      assert.equal(result.canonicalReview.validationSummary.state, fixtureCase.expectedCanonicalState);
      assert.equal(result.canonicalReview.candidateSchema.identity.name, fixtureCase.expectedCandidateName);
      assert.equal(result.canonicalReview.jdSchema.role.title, fixtureCase.expectedRoleTitle);

      if (fixtureCase.expectedIssueCodes) {
        assert.deepEqual(issueCodes, fixtureCase.expectedIssueCodes);
      } else {
        assert.deepEqual(issueCodes, []);
      }

      assert.equal(reportTemplateData.education_entries.length, fixtureCase.expectedEducationCount);
      assert.equal(reportTemplateData.employment_experience_entries.length, fixtureCase.expectedEmploymentCount);
      if (typeof fixtureCase.expectedProjectCount === 'number') {
        assert.equal(reportTemplateData.project_experience_entries.length, fixtureCase.expectedProjectCount);
      }
      if (typeof fixtureCase.minProjectCount === 'number') {
        assert.ok(reportTemplateData.project_experience_entries.length >= fixtureCase.minProjectCount);
      }
      assert.doesNotMatch(reportTemplateData.education_field_institution_line || '', /^\s*\|/);
      assert.equal(
        reportTemplateData.project_experience_entries.some((entry) => /^\s*\|/.test(entry.project_role_company_line || '')),
        false
      );

      assert.equal(result.adapterPayload.templateIdentity, 'atomicgroupcv_template');
      assert.equal(payloadTemplateData.candidate_name, reportTemplateData.candidate_name);
      assert.equal(payloadTemplateData.role_title, reportTemplateData.role_title);
      assert.equal(payloadTemplateData.education_entries.length, reportTemplateData.education_entries.length);
      assert.equal(payloadTemplateData.employment_experience_entries.length, reportTemplateData.employment_experience_entries.length);
      assert.equal(payloadTemplateData.project_experience_entries.length, reportTemplateData.project_experience_entries.length);
      assert.doesNotMatch(payloadTemplateData.education_field_institution_line || '', /^\s*\|/);
      assert.equal(
        payloadTemplateData.project_experience_entries.some((entry) => /^\s*\|/.test(entry.project_role_company_line || '')),
        false
      );

      for (const snippet of fixtureCase.requiredRenderedSnippets) {
        assert.match(
          result.renderedText,
          new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
          `${fixtureCase.name} should render "${snippet}" in the final docx`
        );
      }

      for (const pattern of fixtureCase.forbiddenRenderedPatterns) {
        assert.doesNotMatch(result.renderedText, pattern);
      }

      assert.deepEqual(result.renderResult.postRenderValidation.unexpandedTags, []);
      assert.deepEqual(result.renderResult.postRenderValidation.renderedForbiddenSnippets, []);
      assert.deepEqual(result.renderResult.postRenderValidation.suspiciousSeparatorArtifacts, []);
    }
  );
}

test(
  '7E.2 expanded anonymous export keeps the final Word document anonymous for Test2',
  {
    skip: externalFixtureAvailable('Test2')
      ? false
      : 'External fidelity fixture documents or tracked template are not available on this machine.'
  },
  async () => {
    const result = await buildExternalFidelityFixture('Test2', { anonymous: true });
    const payloadTemplateData = result.adapterPayload.templateData;

    assert.equal(result.canonicalReview.validationSummary.state, 'green');
    assert.equal(result.canonicalReview.candidateSchema.identity.name, 'Xiaoshen CONG (Shawn)');
    assert.equal(payloadTemplateData.candidate_name, 'Anonymous Candidate');
    assert.equal(payloadTemplateData.education_entries.length, 2);
    assert.equal(payloadTemplateData.employment_experience_entries.length, 5);
    assert.equal(payloadTemplateData.project_experience_entries.length, 0);
    assert.doesNotMatch(payloadTemplateData.education_field_institution_line || '', /^\s*\|/);
    assert.equal(JSON.stringify(payloadTemplateData).includes('Xiaoshen CONG (Shawn)'), false);
    assert.equal(result.anonymizationWarnings.length, 0);
    assert.match(result.renderedText, /Anonymous Candidate/i);
    assert.doesNotMatch(result.renderedText, /Xiaoshen CONG \(Shawn\)/i);
    assert.doesNotMatch(result.renderedText, /\|\s*Coventry University/i);
    assert.match(result.renderedText, /Coventry University/i);
    assert.deepEqual(result.renderResult.postRenderValidation.renderedForbiddenSnippets, []);
    assert.deepEqual(result.renderResult.postRenderValidation.suspiciousSeparatorArtifacts, []);
  }
);

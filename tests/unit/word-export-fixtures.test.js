const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const PizZip = require('pizzip');

const { importDocument } = require('../../services/document-service');
const {
  renderHiringManagerWordDocument
} = require('../../services/hiring-manager-template-service');
const {
  buildFallbackBriefing,
  prepareHiringManagerBriefingOutput,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');

const FIXTURE_ROOT = '/Users/jack/Dev/Test/AtomicGroup';
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/AtomicGroupCV_Template.dotx');
const DEBUG_OUTPUT_DIR = path.resolve(__dirname, '../../debug');

function fixtureExists(relativePath) {
  return fs.existsSync(path.join(FIXTURE_ROOT, relativePath));
}

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

function buildSummary() {
  return [
    '## Fit Summary',
    'Strong fit for the role based on the submitted CV and JD.',
    '',
    '## Relevant Experience',
    'Relevant experience is reflected in the employment history.',
    '',
    '## Match Against Key Requirements',
    'Core responsibilities and hiring scope are aligned.',
    '',
    '## Potential Concerns / Gaps',
    'None noted for this regression test.',
    '',
    '## Recommended Next Step',
    'Review with the hiring manager.'
  ].join('\n');
}

const fixtureCases = [
  {
    name: 'Test1',
    cvRelativePath: 'Test1/CV.pdf',
    jdRelativePath: 'Test1/JD.pdf',
    outputFileName: 'test1-word-export.docx',
    minEmploymentHistory: 5,
    expectedTextFragments: [
      'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
      'HSBC',
      'Defined and executed modernisation strategy'
    ]
  },
  {
    name: 'Test2',
    cvRelativePath: 'Test2/CV_Shawn CONG_2026 .pdf',
    jdRelativePath: 'Test2/HSBC TA Lead.pdf',
    outputFileName: 'test2-word-export.docx',
    minEmploymentHistory: 5,
    expectedTextFragments: [
      'Team Manager, Corporate & Digital IT & Cyber Security',
      'Hays Specialist Recruitment',
      'Conducted 360-degree recruitment for front and middle office roles'
    ]
  }
];

for (const fixtureCase of fixtureCases) {
  const fixturesPresent =
    fixtureExists(fixtureCase.cvRelativePath) &&
    fixtureExists(fixtureCase.jdRelativePath) &&
    fs.existsSync(TEMPLATE_PATH);

  test(
    `word export renders ${fixtureCase.name} fixture documents into a populated docx`,
    { skip: fixturesPresent ? false : 'Fixture documents are not available on this machine.' },
    async () => {
      const cvDocument = await importDocument(path.join(FIXTURE_ROOT, fixtureCase.cvRelativePath));
      const jdDocument = await importDocument(path.join(FIXTURE_ROOT, fixtureCase.jdRelativePath));

      assert.equal(cvDocument.error, null);
      assert.equal(jdDocument.error, null);

      const fallbackBriefing = buildFallbackBriefing({
        cvDocument,
        jdDocument
      });
      const recruiterSummary = buildSummary();
      const output = prepareHiringManagerBriefingOutput({
        briefing: fallbackBriefing,
        recruiterSummary
      });
      const templateData = output.templateData;
      const renderedSummary = renderSummaryFromBriefing(output.briefing);

      assert.ok(
        templateData.employment_history.length >= fixtureCase.minEmploymentHistory,
        `${fixtureCase.name} should produce at least ${fixtureCase.minEmploymentHistory} employment entries`
      );
      assert.match(renderedSummary, /## Fit Summary/);

      const outputPath = path.join(DEBUG_OUTPUT_DIR, fixtureCase.outputFileName);
      await renderHiringManagerWordDocument({
        templatePath: TEMPLATE_PATH,
        outputPath,
        templateData
      });

      const renderedBuffer = await fsPromises.readFile(outputPath);
      const renderedText = extractPlainTextFromDocx(renderedBuffer);

      assert.ok(renderedText.length > 0, 'Rendered document should contain readable text');

      for (const expectedFragment of fixtureCase.expectedTextFragments) {
        assert.match(
          renderedText,
          new RegExp(expectedFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          `Rendered document for ${fixtureCase.name} should include: ${expectedFragment}`
        );
      }
    }
  );
}

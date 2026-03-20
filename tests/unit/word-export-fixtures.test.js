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
const {
  EXTERNAL_FIXTURE_CASES,
  fixtureCaseIsPresent,
  getFixtureCvPath,
  getFixtureJdPath
} = require('./external-fixture-registry');
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/AtomicGroupCV_Template.dotx');
const DEBUG_OUTPUT_DIR = path.resolve(__dirname, '../../debug');

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

function extractXmlFromDocx(buffer, filePath) {
  const zip = new PizZip(buffer);
  const entry = zip.file(filePath);
  return entry ? entry.asText() : '';
}

function getMissingIgnorablePrefixes(xml) {
  const rootTagMatch = String(xml || '').match(/<(w:[A-Za-z]+)\b([^>]*)>/);

  if (!rootTagMatch) {
    return [];
  }

  const attributes = rootTagMatch[2];
  const ignorableMatch = attributes.match(/\smc:Ignorable="([^"]+)"/);

  if (!ignorableMatch) {
    return [];
  }

  const declaredPrefixes = new Set(
    [...attributes.matchAll(/\sxmlns:([A-Za-z0-9]+)=/g)].map((match) => match[1])
  );

  return ignorableMatch[1]
    .split(/\s+/)
    .filter(Boolean)
    .filter((prefix) => !declaredPrefixes.has(prefix));
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

for (const fixtureCase of EXTERNAL_FIXTURE_CASES) {
  const fixturesPresent =
    fixtureCaseIsPresent(fixtureCase) &&
    fs.existsSync(TEMPLATE_PATH);

  test(
    `word export renders ${fixtureCase.name} fixture documents into a populated docx`,
    { skip: fixturesPresent ? false : 'Fixture documents are not available on this machine.' },
    async () => {
      const cvDocument = await importDocument(getFixtureCvPath(fixtureCase));
      const jdDocument = await importDocument(getFixtureJdPath(fixtureCase));

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
      const contentTypesXml = extractXmlFromDocx(renderedBuffer, '[Content_Types].xml');
      const documentXml = extractXmlFromDocx(renderedBuffer, 'word/document.xml');
      const appPropertiesXml = extractXmlFromDocx(renderedBuffer, 'docProps/app.xml');
      const zip = new PizZip(renderedBuffer);

      assert.ok(renderedText.length > 0, 'Rendered document should contain readable text');
      assert.match(
        contentTypesXml,
        /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml/
      );
      assert.doesNotMatch(
        contentTypesXml,
        /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.template\.main\+xml/
      );
      assert.doesNotMatch(documentXml, /<w:proofErr\b/);
      assert.match(appPropertiesXml, /<Template>Normal\.dotm<\/Template>/);
      assert.equal(Boolean(zip.file('docProps/custom.xml')), false);
      assert.deepEqual(getMissingIgnorablePrefixes(documentXml), []);

      assert.ok(
        renderedText.length > 100,
        `Rendered document for ${fixtureCase.name} should contain more than trivial text`
      );
      assert.ok(
        renderedText.includes(templateData.fit_summary.slice(0, Math.min(templateData.fit_summary.length, 20)).trim()) ||
          renderedText.includes(templateData.candidate_name) ||
          renderedText.includes(templateData.role_title),
        `Rendered document for ${fixtureCase.name} should contain core generated briefing content`
      );
    }
  );
}

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const PizZip = require('pizzip');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const {
  resolveWordReportAdapter,
  buildWordReportAdapterPayload
} = require('../../services/word-report-adapter-service');
const {
  renderHiringManagerWordDocument
} = require('../../services/hiring-manager-template-service');

const ROLE4_ROOT = '/Users/jack/Dev/Test/AtomicGroup/Role4';
const CV4_PATH = path.join(ROLE4_ROOT, 'CV4-1.pdf');
const JD4_PATH = path.join(ROLE4_ROOT, 'JD4.docx');
const ACTIVE_TEMPLATE_PATH = '/Users/jack/Library/Application Support/atomicgroup-electron-hello-world/templates/candidate-summary-template-d614b7d8-7c66-4fab-8eab-4d3610f7de97.dotx';
const OUTPUT_PATH = path.join('/tmp', 'atomicgroup-word-cleanup-test.docx');

function extractPlainTextFromDocx(buffer) {
  const zip = new PizZip(buffer);
  const documentXml = zip.file('word/document.xml');

  if (!documentXml) {
    return '';
  }

  return [...documentXml.asText().matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test(
  'live runtime template does not render orphan education separators when field of study is empty',
  {
    skip: fs.existsSync(CV4_PATH) && fs.existsSync(JD4_PATH) && fs.existsSync(ACTIVE_TEMPLATE_PATH)
      ? false
      : 'Role4 fixture or active runtime template is not available on this machine.'
  },
  async () => {
    const cvDocument = await importDocument(CV4_PATH);
    const jdDocument = await importDocument(JD4_PATH);
    const briefing = buildFallbackBriefing({
      cvDocument,
      jdDocument,
      outputLanguage: 'en'
    });
    const recruiterSummary = renderSummaryFromBriefing(briefing, 'en');
    const adapter = resolveWordReportAdapter({
      templateName: 'Atomic_Revised_Candidate_Report.dotx'
    });
    const payload = buildWordReportAdapterPayload({
      adapter,
      briefing,
      recruiterSummary,
      outputLanguage: 'en'
    });

    await renderHiringManagerWordDocument({
      templatePath: ACTIVE_TEMPLATE_PATH,
      outputPath: OUTPUT_PATH,
      templateData: payload.templateData,
      validationOptions: payload.validationOptions
    });

    const renderedBuffer = await fsPromises.readFile(OUTPUT_PATH);
    const renderedText = extractPlainTextFromDocx(renderedBuffer);

    assert.doesNotMatch(renderedText, /\|\s*Johns Hopkins University/i);
    assert.match(renderedText, /Johns Hopkins University/i);
  }
);

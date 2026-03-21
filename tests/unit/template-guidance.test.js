const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_TEMPLATE,
  DEFAULT_TEMPLATE_LABEL,
  buildSummaryRequest
} = require('../../services/summary-service');
const {
  buildBriefingRequest
} = require('../../services/briefing-service');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createFixtureDocuments() {
  return {
    cvDocument: {
      file: { name: 'alex-wong-cv.pdf' },
      text: [
        'Alex Wong',
        'Hong Kong',
        '',
        'Experience',
        'Technology Director | HSBC',
        '2020 - Present',
        '- Led platform modernization and delivery',
        '- Managed regional engineering teams'
      ].join('\n')
    },
    jdDocument: {
      file: { name: 'head-of-technology.pdf' },
      text: [
        'Job Title: Head of Technology',
        '',
        'Requirements',
        '- Technology leadership',
        '- Stakeholder management',
        '- Platform modernization'
      ].join('\n')
    }
  };
}

test('buildSummaryRequest uses the built-in default template guidance when no local reference template is selected', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildSummaryRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt'
  });

  assert.equal(request.templateLabel, DEFAULT_TEMPLATE_LABEL);
  assert.match(request.prompt, /Template:/);
  assert.match(request.prompt, /Return only the completed template/);
  assert.match(request.prompt, /Candidate CV source blocks:/);
  assert.match(request.prompt, new RegExp(escapeRegExp(DEFAULT_TEMPLATE.slice(0, 24))));
  assert.doesNotMatch(request.prompt, /Reference template guidance \(/);
  assert.ok(Array.isArray(request.retrievalManifest));
  assert.ok(request.retrievalManifest.length > 0);
});

test('buildSummaryRequest includes selected local reference template guidance while preserving the required recruiter summary structure', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildSummaryRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt',
    templateGuidance: {
      label: 'Atomic Reference Template',
      content: 'Candidate profile example\nSection emphasis: delivery impact and leadership evidence.'
    }
  });

  assert.equal(request.templateLabel, 'Atomic Reference Template');
  assert.match(request.prompt, /Reference template guidance \(Atomic Reference Template\):/);
  assert.match(request.prompt, /delivery impact and leadership evidence/i);
  assert.match(request.prompt, /Required recruiter summary structure:/);
  assert.match(request.prompt, new RegExp(escapeRegExp(DEFAULT_TEMPLATE.slice(0, 24))));
});

test('buildBriefingRequest includes selected local reference template guidance for the structured briefing model', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildBriefingRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt',
    templateGuidance: {
      label: 'Atomic Reference Template',
      content: 'Hiring manager briefing example\nEmphasize candidate snapshot and chronology.'
    }
  });

  assert.equal(request.templateLabel, 'Atomic Reference Template');
  assert.match(request.prompt, /Selected reference template guidance \(Atomic Reference Template\):/);
  assert.match(request.prompt, /Required recruiter summary structure for the in-app review surface:/);
  assert.match(request.prompt, /Current recruiter summary drafting prompt for tone and structure guidance:/);
  assert.match(request.prompt, /Emphasize candidate snapshot and chronology/i);
  assert.match(request.prompt, /Candidate CV source blocks:/);
});

test('buildSummaryRequest switches to anonymous drafting instructions when anonymous mode is requested', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildSummaryRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt',
    outputMode: 'anonymous'
  });

  assert.match(request.prompt, /Create an anonymous recruiter-ready candidate summary/i);
  assert.match(request.prompt, /Candidate: Anonymous Candidate/);
  assert.match(request.prompt, /Do not include the candidate’s real name, email, phone number, LinkedIn URL, or exact street address/i);
  assert.match(request.prompt, /refer to the person as "the candidate" or "this candidate"/i);
  assert.doesNotMatch(request.prompt, /Do not anonymize the candidate in this release/i);
});

test('buildBriefingRequest switches to anonymous structured-briefing instructions when anonymous mode is requested', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildBriefingRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt',
    outputMode: 'anonymous'
  });

  assert.match(request.prompt, /Create an anonymous grounded structured candidate briefing object/i);
  assert.match(request.prompt, /Candidate: Anonymous Candidate/);
  assert.match(request.prompt, /Set `candidate\.name` to `Anonymous Candidate`\./);
  assert.match(request.prompt, /refer to the person as "the candidate" or "this candidate"/i);
  assert.match(request.prompt, /Do not include the candidate’s real name, email, phone number, LinkedIn URL, or exact street address/i);
});

test('buildSummaryRequest can target Simplified Chinese output with the localized built-in template', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildSummaryRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt',
    outputLanguage: 'zh'
  });

  assert.match(request.prompt, /Return the completed recruiter summary in Simplified Chinese/i);
  assert.match(request.prompt, /候选人：\{\{candidate_name\}\}/);
  assert.match(request.prompt, /## 匹配概述/);
  assert.match(request.prompt, /Candidate CV source blocks:/);
});

test('buildBriefingRequest can target Simplified Chinese narrative fields', () => {
  const { cvDocument, jdDocument } = createFixtureDocuments();
  const request = buildBriefingRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt',
    outputLanguage: 'zh'
  });

  assert.match(request.prompt, /Write narrative and human-readable text fields in Simplified Chinese/i);
  assert.match(request.prompt, /候选人：\{\{candidate_name\}\}/);
  assert.match(request.prompt, /Job Description source blocks:/);
});

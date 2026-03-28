const test = require('node:test');
const assert = require('node:assert/strict');

const { buildNormalizedSourceDocument } = require('../../services/source-normalization-service');

test('buildNormalizedSourceDocument preserves raw source while stripping safe artifact lines', () => {
  const text = [
    'Candidate Name',
    '',
    '-- 1 of 3 --',
    '',
    'Experience',
    'Built backend systems in Go.',
    '',
    '4f9d19693e1546211HZ43di_EldUwY-6UfyXWOOmlvXRPxln3Q~~',
    '',
    '-----'
  ].join('\n');

  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'cv',
    label: 'Candidate CV',
    text,
    sourcePath: '/tmp/candidate-cv.pdf'
  });

  assert.match(normalizedDocument.rawSource.text, /-- 1 of 3 --/);
  assert.equal(normalizedDocument.normalizedBlocks.some((block) => /1 of 3/i.test(block.textNormalized)), false);
  assert.equal(normalizedDocument.normalizedBlocks.some((block) => /4f9d19693e/i.test(block.textNormalized)), false);
  assert.ok(normalizedDocument.cleaningManifest.some((entry) => entry.ruleId === 'strip_page_marker'));
  assert.ok(normalizedDocument.cleaningManifest.some((entry) => entry.ruleId === 'strip_opaque_pdf_artifact'));
  assert.ok(normalizedDocument.cleaningManifest.some((entry) => entry.ruleId === 'strip_decoration_only_line'));
});

test('buildNormalizedSourceDocument normalizes bullet markers and preserves original text', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'cv',
    label: 'Candidate CV',
    text: [
      'Projects',
      '',
      '• Built Solana transaction parser',
      '— Improved relay latency'
    ].join('\n'),
    sourcePath: '/tmp/candidate-cv.pdf'
  });

  const projectBlock = normalizedDocument.normalizedBlocks.find((block) => block.sectionKey === 'projects');

  assert.ok(projectBlock);
  assert.match(projectBlock.textOriginal, /^• Built Solana transaction parser/m);
  assert.match(projectBlock.textNormalized, /^- Built Solana transaction parser/m);
  assert.ok(projectBlock.cleaningActions.includes('normalize_bullet_marker'));
  assert.ok(normalizedDocument.cleaningManifest.some((entry) => entry.ruleId === 'normalize_bullet_marker'));
});

test('buildNormalizedSourceDocument classifies explicit headings with confidence metadata', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'jd',
    label: 'Job Description',
    text: [
      'Requirements',
      '',
      '- Strong Rust experience'
    ].join('\n'),
    sourcePath: '/tmp/job-description.docx'
  });

  const requirementBlock = normalizedDocument.normalizedBlocks.find((block) => block.sectionKey === 'requirements');

  assert.ok(requirementBlock);
  assert.equal(requirementBlock.classificationReason, 'explicit_heading');
  assert.equal(requirementBlock.classificationConfidence, 'high');
  assert.deepEqual(requirementBlock.sourceRefs, [{ paragraph: 2 }]);
});

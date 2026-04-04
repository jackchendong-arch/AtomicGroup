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
  assert.equal(requirementBlock.classificationReason, 'inherited_context');
  assert.equal(requirementBlock.classificationConfidence, 'medium');
  assert.deepEqual(requirementBlock.sourceRefs, [{ paragraph: 2 }]);
});

test('buildNormalizedSourceDocument infers structural education and employment sections when headings are delayed', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'cv',
    label: 'Candidate CV',
    text: [
      'MSc in Computing',
      'Cardiff University, UK | 2019 - 2020',
      '',
      'Shanghai Xiaohan Technology Co., Ltd. — Blockchain Engineer',
      'Sep 2021 - Sep 2025'
    ].join('\n'),
    sourcePath: '/tmp/candidate-cv.pdf'
  });

  const sectionKeys = normalizedDocument.normalizedBlocks.map((block) => block.sectionKey);
  const educationBlock = normalizedDocument.normalizedBlocks.find((block) => block.sectionKey === 'education');
  const employmentBlock = normalizedDocument.normalizedBlocks.find((block) => block.sectionKey === 'experience');

  assert.deepEqual(sectionKeys, ['education', 'experience']);
  assert.equal(educationBlock.classificationReason, 'structural_pattern');
  assert.equal(educationBlock.classificationConfidence, 'medium');
  assert.equal(employmentBlock.classificationReason, 'structural_pattern');
  assert.equal(employmentBlock.classificationConfidence, 'medium');
});

test('buildNormalizedSourceDocument merges wrapped bullet continuations only after section classification is known', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'jd',
    label: 'Job Description',
    text: [
      'Requirements',
      '',
      '- Strong Rust smart contract experience',
      'across Solana and EVM ecosystems',
      '- Backend API design'
    ].join('\n'),
    sourcePath: '/tmp/job-description.docx'
  });

  const requirementBlock = normalizedDocument.normalizedBlocks.find((block) => block.sectionKey === 'requirements');

  assert.ok(requirementBlock);
  assert.match(requirementBlock.textNormalized, /- Strong Rust smart contract experience across Solana and EVM ecosystems/);
  assert.ok(requirementBlock.cleaningActions.includes('normalize_wrapped_bullet_continuation'));
  assert.ok(normalizedDocument.cleaningManifest.some((entry) => entry.ruleId === 'normalize_wrapped_bullet_continuation'));
});

test('buildNormalizedSourceDocument does not misclassify project sections as education when later bullets mention BSC-based work', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'cv',
    label: 'Candidate CV',
    text: [
      'Cardiff University, UK | 2019 - 2020',
      'Bachelor of Business Administration (BBA)',
      '',
      'Pongolo Tequila RWA Project (2025.01 - 2025.03)',
      '- Built a BSC-based GameFi trading experience',
      '- Minted Solana NFTs for asset ownership'
    ].join('\n'),
    sourcePath: '/tmp/candidate-cv.pdf'
  });

  assert.deepEqual(
    normalizedDocument.normalizedBlocks.map((block) => block.sectionKey),
    ['education', 'projects']
  );
  assert.equal(normalizedDocument.normalizedBlocks[1].classificationReason, 'structural_pattern');
});

test('buildNormalizedSourceDocument merges same-section wrapped blocks only after classification is established', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'cv',
    label: 'Candidate CV',
    text: [
      'Skills',
      '',
      'Programming Languages: Golang, go-',
      '',
      'ethereum, Solidity, PHP, Python',
      '',
      'Operating Systems: Linux, shell scripting,',
      '',
      'production system operations'
    ].join('\n'),
    sourcePath: '/tmp/candidate-cv.pdf'
  });

  assert.equal(normalizedDocument.normalizedBlocks.length, 2);
  assert.equal(normalizedDocument.normalizedBlocks[0].sectionKey, 'skills');
  assert.equal(
    normalizedDocument.normalizedBlocks[0].textNormalized,
    'Programming Languages: Golang, go-ethereum, Solidity, PHP, Python'
  );
  assert.equal(
    normalizedDocument.normalizedBlocks[1].textNormalized,
    'Operating Systems: Linux, shell scripting, production system operations'
  );
  assert.ok(normalizedDocument.normalizedBlocks[0].cleaningActions.includes('normalize_wrapped_block_continuation'));
  assert.ok(normalizedDocument.cleaningManifest.some((entry) => entry.ruleId === 'normalize_wrapped_block_continuation'));
});

test('buildNormalizedSourceDocument keeps original-language blocks authoritative while adding bounded English working text', () => {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType: 'cv',
    label: 'Candidate CV',
    text: [
      '项目经历',
      '',
      '钱包集成平台',
      '- 负责后端 API 设计',
      '- 负责区块链 SDK 集成'
    ].join('\n'),
    sourcePath: '/tmp/candidate-cv.pdf'
  });

  const projectBlock = normalizedDocument.normalizedBlocks.find((block) => block.sectionKey === 'projects');

  assert.ok(projectBlock);
  assert.match(projectBlock.textNormalized, /钱包集成平台/);
  assert.equal(projectBlock.languageHint, 'mixed');
  assert.match(projectBlock.englishWorkingText, /wallet integration platform/i);
  assert.match(projectBlock.englishWorkingText, /backend API design/i);
  assert.match(projectBlock.englishWorkingText, /blockchain SDK integration/i);
  assert.equal(projectBlock.englishWorkingTextSource, 'deterministic_translation');
});

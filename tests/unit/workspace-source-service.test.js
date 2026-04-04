const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWorkspaceRetrievalQuery,
  buildWorkspaceSourceModel,
  renderSourceBlocksContext,
  resolveBlockText,
  selectWorkspaceSourceBlocks
} = require('../../services/workspace-source-service');
const { buildSummaryRequest } = require('../../services/summary-service');

function createWorkspaceFixture() {
  return {
    cvDocument: {
      file: {
        name: 'noah-zhang-cv.pdf',
        path: '/tmp/noah-zhang-cv.pdf'
      },
      text: [
        'Noah Zhang',
        'Hong Kong',
        '',
        'Education',
        'Johns Hopkins University',
        'Electrical and Computer Engineering',
        '',
        'Experience',
        'Software Engineer | Sparksoft',
        'Built high-concurrency order processing services in Go and designed RESTful APIs.',
        '',
        'Project Experience',
        'DEX Aggregator',
        'Built Solana and Ethereum transaction parsing, smart order routing, and protocol integrations.',
        '',
        'Skills',
        'Go, Rust, Solidity, Solana, Ethereum'
      ].join('\n'),
      previewText: ''
    },
    jdDocument: {
      file: {
        name: 'blockchain-developer.docx',
        path: '/tmp/blockchain-developer.docx'
      },
      text: [
        'Job Title: Blockchain Developer',
        '',
        'Requirements',
        '- Strong Rust or Solidity smart contract experience',
        '- Experience integrating wallet and blockchain SDK flows',
        '- Backend API design and distributed systems experience'
      ].join('\n'),
      previewText: ''
    }
  };
}

function createChineseWorkspaceFixture() {
  return {
    cvDocument: {
      file: {
        name: 'li-ming-cv.pdf',
        path: '/tmp/li-ming-cv.pdf'
      },
      text: [
        '项目经历',
        '钱包集成平台',
        '- 负责后端 API 设计',
        '- 负责区块链 SDK 集成'
      ].join('\n'),
      previewText: ''
    },
    jdDocument: {
      file: {
        name: 'wallet-platform-jd.docx',
        path: '/tmp/wallet-platform-jd.docx'
      },
      text: [
        '岗位要求',
        '- 需要钱包集成经验',
        '- 需要后端 API 设计能力'
      ].join('\n'),
      previewText: ''
    }
  };
}

test('buildWorkspaceSourceModel creates section-aware blocks for CV, JD, and guidance', () => {
  const { cvDocument, jdDocument } = createWorkspaceFixture();
  const sourceModel = buildWorkspaceSourceModel({
    cvDocument,
    jdDocument,
    templateGuidance: {
      label: 'Reference Template',
      content: '# Fit Summary\n\nUse recruiter-ready language.'
    }
  });

  assert.equal(sourceModel.documents.length, 3);
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'cv'));
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'jd'));
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'guidance'));
  assert.match(sourceModel.documents.find((document) => document.documentType === 'cv').rawSource.text, /Noah Zhang/);
  assert.ok(Array.isArray(sourceModel.documents.find((document) => document.documentType === 'cv').cleaningManifest));
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'cv').blocks.some((block) => block.sectionKey === 'experience'));
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'jd').blocks.some((block) => block.sectionKey === 'requirements'));
});

test('buildWorkspaceSourceModel strips standalone PDF page-marker paragraphs from source blocks', () => {
  const sourceModel = buildWorkspaceSourceModel({
    cvDocument: {
      file: {
        name: 'artifact-cv.pdf',
        path: '/tmp/artifact-cv.pdf'
      },
      text: [
        'Candidate Name',
        '',
        '-- 1 of 3 --',
        '',
        'Experience',
        'Built backend systems in Go.',
        '',
        '-- 2 of 3 --'
      ].join('\n')
    },
    jdDocument: {
      file: {
        name: 'artifact-jd.docx',
        path: '/tmp/artifact-jd.docx'
      },
      text: 'Job Title: Backend Engineer'
    }
  });

  const cvBlocks = sourceModel.documents.find((document) => document.documentType === 'cv').blocks;
  const cvCleaningManifest = sourceModel.documents.find((document) => document.documentType === 'cv').cleaningManifest;

  assert.equal(cvBlocks.some((block) => /of 3/i.test(block.text)), false);
  assert.ok(cvBlocks.some((block) => /Built backend systems in Go/i.test(block.text)));
  assert.ok(cvCleaningManifest.some((entry) => entry.ruleId === 'strip_page_marker'));
});

test('buildWorkspaceSourceModel keeps original text and exposes English working text for bounded CV/JD blocks', () => {
  const { cvDocument, jdDocument } = createChineseWorkspaceFixture();
  const sourceModel = buildWorkspaceSourceModel({ cvDocument, jdDocument });
  const cvProjectBlock = sourceModel.documents
    .find((document) => document.documentType === 'cv')
    .blocks.find((block) => block.sectionKey === 'projects');
  const jdRequirementBlock = sourceModel.documents
    .find((document) => document.documentType === 'jd')
    .blocks.find((block) => block.sectionKey === 'requirements');

  assert.match(cvProjectBlock.text, /钱包集成平台/);
  assert.match(resolveBlockText(cvProjectBlock, 'english-working'), /wallet integration platform/i);
  assert.match(resolveBlockText(jdRequirementBlock, 'english-working'), /wallet integration experience/i);
});

test('selectWorkspaceSourceBlocks favors relevant experience and requirement blocks for the workspace query', () => {
  const { cvDocument, jdDocument } = createWorkspaceFixture();
  const sourceModel = buildWorkspaceSourceModel({ cvDocument, jdDocument });
  const queryText = buildWorkspaceRetrievalQuery({
    candidateName: 'Noah Zhang',
    roleTitle: 'Blockchain Developer',
    requirements: [
      'Rust smart contract experience',
      'wallet SDK integration',
      'backend API design'
    ]
  });
  const selection = selectWorkspaceSourceBlocks(sourceModel, {
    queryText,
    limits: {
      cv: 4,
      jd: 3
    },
    preferredSectionKeysByDocumentType: {
      cv: ['experience', 'projects', 'skills'],
      jd: ['overview', 'requirements']
    }
  });
  const cvContext = renderSourceBlocksContext(selection.selectionByDocumentType.cv);
  const jdContext = renderSourceBlocksContext(selection.selectionByDocumentType.jd);

  assert.match(cvContext, /Sparksoft/i);
  assert.match(cvContext, /DEX Aggregator/i);
  assert.match(jdContext, /Rust or Solidity smart contract experience/i);
  assert.ok(selection.retrievalManifest.length > 0);
  assert.equal(selection.retrievalManifest[0].sourceName, 'noah-zhang-cv.pdf');
  assert.ok(selection.retrievalManifest[0].preview.length > 0);
});

test('buildSummaryRequest uses retrieved source blocks instead of full document stuffing', () => {
  const { cvDocument, jdDocument } = createWorkspaceFixture();
  const request = buildSummaryRequest({
    cvDocument,
    jdDocument,
    systemPrompt: 'System prompt'
  });

  assert.match(request.prompt, /Candidate CV source blocks:/);
  assert.match(request.prompt, /\[cv-1\]/);
  assert.match(request.prompt, /Sparksoft/);
  assert.doesNotMatch(request.prompt, /Candidate CV:\nNoah Zhang\nHong Kong\n\nEducation/);
  assert.ok(Array.isArray(request.retrievalManifest));
  assert.ok(request.retrievalManifest.length > 0);
});

test('selectWorkspaceSourceBlocks can opt into English working text without changing default source rendering', () => {
  const { cvDocument, jdDocument } = createChineseWorkspaceFixture();
  const sourceModel = buildWorkspaceSourceModel({ cvDocument, jdDocument });
  const queryText = buildWorkspaceRetrievalQuery({
    candidateName: 'Li Ming',
    roleTitle: 'Wallet Platform Engineer',
    requirements: [
      'wallet integration experience',
      'backend API design',
      'blockchain sdk integration'
    ]
  });
  const selection = selectWorkspaceSourceBlocks(sourceModel, {
    queryText,
    limits: {
      cv: 2,
      jd: 2
    },
    preferredSectionKeysByDocumentType: {
      cv: ['projects'],
      jd: ['requirements']
    },
    textVariantByDocumentType: {
      cv: 'english-working',
      jd: 'english-working'
    }
  });
  const cvContextDefault = renderSourceBlocksContext(selection.selectionByDocumentType.cv);
  const cvContextWorking = renderSourceBlocksContext(selection.selectionByDocumentType.cv, {
    textVariant: 'english-working'
  });

  assert.match(cvContextDefault, /钱包集成平台/);
  assert.match(cvContextWorking, /wallet integration platform/i);
  assert.match(cvContextWorking, /backend API design/i);
});

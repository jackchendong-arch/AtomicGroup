const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWorkspaceRetrievalQuery,
  buildWorkspaceSourceModel,
  renderSourceBlocksContext,
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
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'cv').blocks.some((block) => block.sectionKey === 'experience'));
  assert.ok(sourceModel.documents.find((document) => document.documentType === 'jd').blocks.some((block) => block.sectionKey === 'requirements'));
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

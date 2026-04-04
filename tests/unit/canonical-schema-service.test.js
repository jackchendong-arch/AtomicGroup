const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const { buildCanonicalSchemas } = require('../../services/canonical-schema-service');
const { buildWorkspaceSourceModel } = require('../../services/workspace-source-service');

const ROLE4_ROOT = '/Users/jack/Dev/Test/AtomicGroup/Role4';
const JD4_PATH = path.join(ROLE4_ROOT, 'JD4.docx');

async function loadRole4Canonical(cvFileName) {
  const cvDocument = await importDocument(path.join(ROLE4_ROOT, cvFileName));
  const jdDocument = await importDocument(JD4_PATH);

  return buildCanonicalSchemas({
    cvDocument,
    jdDocument
  });
}

test('buildCanonicalSchemas produces canonical candidate and JD schemas with source refs', () => {
  const result = buildCanonicalSchemas({
    cvDocument: {
      text: [
        'Noah Zhang',
        'Shanghai, China',
        '',
        'Education',
        'MSc in Computing',
        'Cardiff University, UK | 2019 – 2020',
        '',
        'Work Experience',
        'Shanghai Xiaohan Technology Co., Ltd. — Blockchain Engineer',
        'Sep 2021 – Sep 2025',
        '- Built backend services',
        '',
        'Projects',
        'Rust Copy-Trading Arbitrage Bot & Jupiter-style Aggregator (2025.04 – 2025.08)',
        '- Tech Stack: Rust, Solana',
        '- Built a Jupiter-style token swap aggregator on Solana'
      ].join('\n'),
      file: {
        name: 'Noah Zhang CV.pdf',
        path: '/tmp/noah-zhang.pdf'
      }
    },
    jdDocument: {
      text: [
        'Role: Blockchain Engineer',
        '',
        'Requirements',
        '- Experience building backend services',
        '- Solana or blockchain delivery experience'
      ].join('\n'),
      file: {
        name: 'JD4.docx',
        path: '/tmp/jd4.docx'
      }
    }
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.candidateSchema.identity.name, 'Noah Zhang');
  assert.equal(result.candidateSchema.education.length, 1);
  assert.equal(result.candidateSchema.education[0].degreeName, 'MSc');
  assert.equal(result.candidateSchema.education[0].fieldOfStudy, 'Computing');
  assert.equal(result.candidateSchema.employmentHistory.length, 1);
  assert.equal(result.candidateSchema.projectExperiences.length, 1);
  assert.equal(result.jdSchema.role.title, 'Blockchain Engineer');
  assert.equal(result.jdSchema.requirements.length, 2);
  assert.equal(result.validationSummary.state, 'green');
  assert(result.candidateSchema.education[0].sourceRefs.length > 0);
  assert(result.jdSchema.requirements[0].sourceRefs.length > 0);
});

test('buildCanonicalSchemas uses normalized source blocks as the extraction boundary when sourceModel is supplied', () => {
  const sourceModel = buildWorkspaceSourceModel({
    cvDocument: {
      text: [
        'Noah Zhang',
        'Shanghai, China',
        '',
        'Education',
        'MSc in Computing',
        'Cardiff University, UK | 2019 – 2020',
        '',
        'Work Experience',
        'Shanghai Xiaohan Technology Co., Ltd. — Blockchain Engineer',
        'Sep 2021 – Sep 2025',
        '- Built backend services',
        '',
        'Projects',
        'Rust Copy-Trading Arbitrage Bot & Jupiter-style Aggregator (2025.04 – 2025.08)',
        '- Tech Stack: Rust, Solana',
        '- Built a Jupiter-style token swap aggregator on Solana'
      ].join('\n'),
      file: {
        name: 'source-cv.pdf',
        path: '/tmp/source-cv.pdf'
      }
    },
    jdDocument: {
      text: [
        'Role: Blockchain Engineer',
        '',
        'Requirements',
        '- Experience building backend services',
        '- Solana or blockchain delivery experience'
      ].join('\n'),
      file: {
        name: 'source-jd.docx',
        path: '/tmp/source-jd.docx'
      }
    }
  });

  const result = buildCanonicalSchemas({
    cvDocument: {
      text: [
        'Candidate',
        'Skills',
        '- JavaScript'
      ].join('\n'),
      file: {
        name: 'candidate.pdf',
        path: '/tmp/raw-candidate.pdf'
      }
    },
    jdDocument: {
      text: [
        'Role',
        '',
        'Responsibilities',
        '- Own roadmap'
      ].join('\n'),
      file: {
        name: 'role.docx',
        path: '/tmp/raw-role.docx'
      }
    },
    sourceModel
  });

  assert.equal(result.candidateSchema.identity.name, 'Noah Zhang');
  assert.equal(result.candidateSchema.education.length, 1);
  assert.equal(result.candidateSchema.employmentHistory.length, 1);
  assert.equal(result.candidateSchema.projectExperiences.length, 1);
  assert.equal(result.jdSchema.role.title, 'Blockchain Engineer');
  assert.equal(result.jdSchema.requirements.length, 2);
  assert.equal(result.validationSummary.state, 'green');
});

test('buildCanonicalSchemas surfaces ambiguous project-role linkage as amber validation', () => {
  const result = buildCanonicalSchemas({
    cvDocument: {
      text: [
        'Noah Zhang',
        'Shanghai, China',
        '',
        'Work Experience',
        'Acme Capital — Blockchain Engineer',
        '2020 – 2023',
        '- Built backend services',
        '',
        'Beta Labs — Lead Engineer',
        '2021 – 2024',
        '- Led protocol delivery',
        '',
        'Projects',
        'Liquidity Router (2022 – 2022)',
        '- Built low-latency routing services'
      ].join('\n'),
      file: {
        name: 'Noah Zhang CV.pdf',
        path: '/tmp/noah-zhang-ambiguous.pdf'
      }
    },
    jdDocument: {
      text: [
        'Role: Blockchain Engineer',
        '',
        'Requirements',
        '- Experience building backend services'
      ].join('\n'),
      file: {
        name: 'JD4.docx',
        path: '/tmp/jd4-ambiguous.docx'
      }
    }
  });

  assert.equal(result.validationSummary.state, 'amber');
  assert(result.validationSummary.issues.some((issue) => issue.code === 'project_role_ambiguous'));
  assert.equal(result.candidateSchema.projectExperiences[0].linkedEmploymentIndex, null);
});

test(
  'Role4 CV4-1 canonical schema keeps compact Chinese education and project sections clean',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-1.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const result = await loadRole4Canonical('CV4-1.pdf');
    const projectNames = result.candidateSchema.projectExperiences.map((entry) => entry.projectName);

    assert.equal(result.validationSummary.state, 'green');
    assert.equal(result.candidateSchema.education.length, 2);
    assert.equal(result.candidateSchema.employmentHistory.length, 1);
    assert.deepEqual(projectNames, [
      '基 于 Solana 生 态 的 DEX 聚 合 器',
      '基 于 Anchor 的 PumpFun 合 约'
    ]);
    assert.equal(
      projectNames.some((value) => /技能\/优势及其他|英语：|语言：/u.test(value)),
      false
    );
  }
);

test(
  'Role4 CV4-2 canonical schema keeps education, employment, and projects separated cleanly',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-2.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const result = await loadRole4Canonical('CV4-2.pdf');
    const projectNames = result.candidateSchema.projectExperiences.map((entry) => entry.projectName);
    const issueCodes = result.validationSummary.issues.map((issue) => issue.code);

    assert.equal(result.validationSummary.state, 'amber');
    assert(issueCodes.includes('project_role_ambiguous'));
    assert.deepEqual(
      result.candidateSchema.education.map((entry) => ({
        degreeName: entry.degreeName,
        fieldOfStudy: entry.fieldOfStudy,
        institutionName: entry.institutionName,
        startDate: entry.startDate,
        endDate: entry.endDate
      })),
      [
        {
          degreeName: 'MSc',
          fieldOfStudy: 'Computing',
          institutionName: 'Cardiff University, UK',
          startDate: '2019',
          endDate: '2020'
        },
        {
          degreeName: 'Bachelor of Business Administration (BBA)',
          fieldOfStudy: '',
          institutionName: 'Jincheng College, Nanjing University of Aeronautics and Astronautics',
          startDate: '2012',
          endDate: '2016'
        }
      ]
    );
    assert.equal(result.candidateSchema.employmentHistory.length, 5);
    assert(projectNames.includes('Rust Copy-Trading Arbitrage Bot & Jupiter-style Aggregator'));
    assert(projectNames.includes('Pongolo Tequila RWA Project'));
    assert(projectNames.includes('Pumpfun Meme Character Livestream & AI Agent'));
    assert(projectNames.includes('Lottery Drawer App (Personal Project)'));
    assert.equal(
      projectNames.some((value) => /^(dancing|of \$5M|money, and sniper traders|downloads\*\*|features|smart contracts)$/i.test(value)),
      false
    );
    assert(result.jdSchema.requirements.length > 0);
  }
);

test(
  'Role4 CV4-3 canonical schema keeps the clean baseline green',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-3.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const result = await loadRole4Canonical('CV4-3.pdf');

    assert.equal(result.validationSummary.state, 'green');
    assert.equal(result.candidateSchema.education.length, 1);
    assert.equal(result.candidateSchema.projectExperiences.length, 3);
    assert.deepEqual(
      result.candidateSchema.projectExperiences.map((entry) => entry.projectName),
      [
        'High Performance Blockchain Relayer and Indexer',
        'Real-Time Leaderboard System',
        'Low-Latency Solana Transaction Engine'
      ]
    );
  }
);

test(
  'Role4 CV4-4 canonical schema emits normalized validation issue codes for a bad extraction case',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-4.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const result = await loadRole4Canonical('CV4-4.pdf');
    const issueCodes = result.validationSummary.issues.map((issue) => issue.code);

    assert.equal(result.validationSummary.state, 'red');
    assert(issueCodes.includes('candidate_name_missing_or_generic'));
    assert(issueCodes.includes('employment_entry_missing_core_fields'));
  }
);

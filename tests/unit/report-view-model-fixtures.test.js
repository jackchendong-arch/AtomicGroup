const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  prepareHiringManagerBriefingOutput,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');

const ROLE4_ROOT = '/Users/jack/Dev/Test/AtomicGroup/Role4';
const JD4_PATH = path.join(ROLE4_ROOT, 'JD4.docx');

async function loadRole4TemplateData(cvFileName) {
  const cvDocument = await importDocument(path.join(ROLE4_ROOT, cvFileName));
  const jdDocument = await importDocument(JD4_PATH);
  const briefing = buildFallbackBriefing({
    cvDocument,
    jdDocument,
    outputLanguage: 'en'
  });
  const recruiterSummary = renderSummaryFromBriefing(briefing, 'en');

  return prepareHiringManagerBriefingOutput({
    briefing,
    recruiterSummary,
    outputLanguage: 'en'
  }).templateData;
}

test(
  'Role4 CV4-1 report view model keeps education rows clean and project section separate from skills content',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-1.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-1.pdf');
    const projectNames = templateData.project_experience_entries.map((entry) => entry.project_name);

    assert.equal(templateData.education_entries.length, 2);
    assert.deepEqual(
      templateData.education_entries.map((entry) => ({
        degree_name: entry.degree_name,
        institution_name: entry.institution_name,
        start_year: entry.start_year,
        end_year: entry.end_year
      })),
      [
        {
          degree_name: '硕士',
          institution_name: 'Johns Hopkins University Electrical and Computer Engineering（GPA:3.7/4）',
          start_year: '2022',
          end_year: '2024'
        },
        {
          degree_name: '本科',
          institution_name: '中国科学院大学 电子信息工程（GPA:3.7/4）',
          start_year: '2017',
          end_year: '2022'
        }
      ]
    );
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
  'Role4 CV4-2 report view model keeps education at two rows and preserves clean project titles',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-2.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-2.pdf');
    const projectNames = templateData.project_experience_entries.map((entry) => entry.project_name);

    assert.equal(templateData.education_entries.length, 2);
    assert.deepEqual(
      templateData.education_entries.map((entry) => ({
        degree_name: entry.degree_name,
        field_of_study: entry.field_of_study,
        institution_name: entry.institution_name,
        start_year: entry.start_year,
        end_year: entry.end_year
      })),
      [
        {
          degree_name: 'MSc',
          field_of_study: 'Computing',
          institution_name: 'Cardiff University, UK',
          start_year: '2019',
          end_year: '2020'
        },
        {
          degree_name: 'Bachelor of Business Administration (BBA)',
          field_of_study: '',
          institution_name: 'Jincheng College, Nanjing University of Aeronautics and Astronautics',
          start_year: '2012',
          end_year: '2016'
        }
      ]
    );
    assert.equal(templateData.employment_experience_entries.length, 5);
    assert.deepEqual(
      templateData.employment_experience_entries.slice(0, 2).map((entry) => ({
        job_title: entry.job_title,
        company_name: entry.company_name,
        employment_start_date: entry.employment_start_date,
        employment_end_date: entry.employment_end_date
      })),
      [
        {
          job_title: 'Blockchain Engineer',
          company_name: 'Shanghai Xiaohan Technology Co., Ltd.',
          employment_start_date: '2021',
          employment_end_date: '2025'
        },
        {
          job_title: 'Blockchain Engineer',
          company_name: 'Wanxiang Blockchain Inc., Shanghai',
          employment_start_date: '2021',
          employment_end_date: '2021'
        }
      ]
    );
    assert(projectNames.includes('Rust Copy-Trading Arbitrage Bot & Jupiter-style Aggregator'));
    assert(projectNames.includes('Pongolo Tequila RWA Project'));
    assert(projectNames.includes('Pumpfun Meme Character Livestream & AI Agent'));
    assert(projectNames.includes('Lottery Drawer App (Personal Project)'));
    assert.equal(
      projectNames.some((value) => /^(dancing|of \$5M|money, and sniper traders|downloads\*\*|features|smart contracts)$/i.test(value)),
      false
    );
    assert.equal(
      templateData.project_experience_entries.some((entry) =>
        entry.project_bullets.some((bullet) => /Work Experience|Education|Projects/.test(bullet.project_bullet_text))
      ),
      false
    );
  }
);

test(
  'Role4 CV4-3 report view model keeps a clean single education row and expected blockchain project titles',
  {
    skip: fs.existsSync(path.join(ROLE4_ROOT, 'CV4-3.pdf')) && fs.existsSync(JD4_PATH)
      ? false
      : 'Role4 fixture documents are not available on this machine.'
  },
  async () => {
    const templateData = await loadRole4TemplateData('CV4-3.pdf');
    const projectNames = templateData.project_experience_entries.map((entry) => entry.project_name);

    assert.equal(templateData.education_entries.length, 1);
    assert.deepEqual(
      templateData.education_entries[0],
      {
        degree_name: 'Bachelo1’s Degree in Industrial Design',
        field_of_study: '',
        education_field_institution_line: 'South China University of Technology',
        university: 'South China University of Technology',
        institution_name: 'South China University of Technology',
        start_year: '2011',
        end_year: '2015',
        education_start_year: '2011',
        education_end_year: '2015',
        education_location: '',
        education_date_location_line: '2015'
      }
    );
    assert.deepEqual(projectNames, [
      'High Performance Blockchain Relayer and Indexer',
      'Real-Time Leaderboard System',
      'Low-Latency Solana Transaction Engine'
    ]);
  }
);

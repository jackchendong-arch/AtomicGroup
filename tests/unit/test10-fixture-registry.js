const fs = require('node:fs');
const path = require('node:path');

const { SUPPORTED_EXTENSIONS } = require('../../services/document-service');

const TEST10_ROOT = '/Users/jack/Dev/Test/AtomicGroup/Test10';
const TEST10_SHARED_JD_FILE_NAME = 'HSBC JD - Senior Software Engineering Manager.docx';
const TEST10_NOISE_FILE_NAMES = new Set([
  '.DS_Store',
  TEST10_SHARED_JD_FILE_NAME,
  '凯华物业服务（广州）有限公司_20260407_26442000003751670851_发票金额6413.76元.pdf'
]);

const TEST10_CURATED_CASES = [
  {
    fileName: 'Peng Wang王鹏-Test Automation Architect-Atomic-2026.1.30.docx',
    expectedCandidateName: 'Peng Wang王鹏',
    expectedRoleTitle: 'Senior Software Engineering Manager : 0000K19E',
    expectedState: 'red',
    expectedIssueCodes: ['education_entry_malformed', 'employment_entry_missing_core_fields'],
    minEmploymentHistory: 6,
    minProjects: 8
  },
  {
    fileName: 'CV_Zhaihui_ZHANG_EN_202512.pdf',
    expectedCandidateName: 'Zhaihui ZHANG',
    expectedRoleTitle: 'Senior Software Engineering Manager : 0000K19E',
    expectedState: 'red',
    expectedIssueCodes: ['education_entry_malformed', 'employment_entry_missing_core_fields'],
    minEmploymentHistory: 3,
    minProjects: 0
  },
  {
    fileName: 'Wu Cong-Senior Project Manager(Payment).docx',
    expectedCandidateName: 'Wu Cong',
    expectedRoleTitle: 'Senior Software Engineering Manager : 0000K19E',
    expectedState: 'red',
    expectedIssueCodes: ['education_entry_malformed'],
    minEmploymentHistory: 9,
    minProjects: 0
  },
  {
    fileName: '苏朗轩-iOS-GCB5-Atomic.docx',
    expectedCandidateName: '苏朗轩',
    expectedRoleTitle: 'Senior Software Engineering Manager : 0000K19E',
    expectedState: 'red',
    expectedIssueCodes: ['education_entry_malformed', 'employment_entry_missing_core_fields'],
    minEmploymentHistory: 3,
    minProjects: 12
  }
];

function test10IsPresent() {
  return fs.existsSync(TEST10_ROOT) && fs.statSync(TEST10_ROOT).isDirectory();
}

function listTest10Files() {
  if (!test10IsPresent()) {
    return [];
  }

  return fs.readdirSync(TEST10_ROOT)
    .filter((fileName) => !TEST10_NOISE_FILE_NAMES.has(fileName))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function getTest10FilePath(fileName) {
  return path.join(TEST10_ROOT, fileName);
}

function getTest10JdPath() {
  return getTest10FilePath(TEST10_SHARED_JD_FILE_NAME);
}

function isSupportedTest10CvFile(fileName) {
  return SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function getSupportedTest10CvCases() {
  return listTest10Files().filter(isSupportedTest10CvFile);
}

function getUnsupportedTest10CvCases() {
  return listTest10Files().filter((fileName) => !isSupportedTest10CvFile(fileName));
}

module.exports = {
  TEST10_CURATED_CASES,
  TEST10_ROOT,
  TEST10_SHARED_JD_FILE_NAME,
  getSupportedTest10CvCases,
  getTest10FilePath,
  getTest10JdPath,
  getUnsupportedTest10CvCases,
  test10IsPresent
};

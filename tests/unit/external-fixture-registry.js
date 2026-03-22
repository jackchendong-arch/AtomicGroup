const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_ROOT = '/Users/jack/Dev/Test/AtomicGroup';

const EXTERNAL_FIXTURE_CASES = [
  {
    name: 'Test1',
    directory: 'Test1',
    cvFileName: 'CV.pdf',
    jdFileName: 'JD.pdf',
    contractMode: 'valid_pair',
    expectedCandidateName: 'JACK XIN DONG CHEN',
    expectedRoleTitle: 'Head of IT Transformation',
    sourceLanguage: 'en',
    minEmploymentHistory: 5,
    outputFileName: 'test1-word-export.docx'
  },
  {
    name: 'Test2',
    directory: 'Test2',
    cvFileName: 'CV_Shawn CONG_2026 .pdf',
    jdFileName: 'HSBC TA Lead.pdf',
    contractMode: 'valid_pair',
    expectedCandidateName: 'Xiaoshen CONG (Shawn)',
    expectedRoleTitle: 'Leadership Talent Acquisition Partner (VP), Technology Center',
    sourceLanguage: 'en',
    minEmploymentHistory: 5,
    outputFileName: 'test2-word-export.docx'
  },
  {
    name: 'Test3',
    directory: 'test3',
    cvFileName: 'CV1.pdf',
    jdFileName: 'CV4-1.pdf',
    contractMode: 'invalid_pair',
    sourceLanguage: 'mixed',
    notes: 'This folder does not contain a real JD fixture; keep it in smoke coverage only and exclude it from candidate-role contract assertions.',
    minEmploymentHistory: 1,
    outputFileName: 'test3-word-export.docx'
  },
  {
    name: 'Test4',
    directory: 'Test4',
    cvFileName: 'CV4-1.pdf',
    jdFileName: 'JD4.docx',
    contractMode: 'valid_pair',
    expectedCandidateName: 'Noah Zhang',
    expectedRoleTitle: '区块链开发工程师 (Blockchain Developer)',
    sourceLanguage: 'zh',
    minEmploymentHistory: 1,
    outputFileName: 'test4-word-export.docx'
  },
  {
    name: 'Test5',
    directory: 'Test5',
    cvFileName: 'CV2.pdf',
    jdFileName: 'JD2.pdf',
    contractMode: 'valid_pair',
    expectedCandidateName: 'Mandy Leung',
    expectedRoleTitle: 'Leadership Talent Acquisition Partner (VP), Technology Center',
    sourceLanguage: 'en',
    minEmploymentHistory: 1,
    outputFileName: 'test5-word-export.docx'
  },
  {
    name: 'Test6',
    directory: 'Test6',
    cvFileName: 'CV3.pdf',
    jdFileName: 'JD3.docx',
    contractMode: 'valid_pair',
    expectedCandidateName: '熊兵兵 Bingbing Xiong',
    expectedRoleTitle: 'Java开发工程师(物流)',
    sourceLanguage: 'zh',
    minEmploymentHistory: 1,
    outputFileName: 'test6-word-export.docx'
  },
  {
    name: 'Test7',
    directory: 'Test7',
    cvFileName: 'CV4-2.pdf',
    jdFileName: 'JD4.docx',
    contractMode: 'valid_pair',
    expectedCandidateName: 'Chenhao Li',
    expectedRoleTitle: '区块链开发工程师 (Blockchain Developer)',
    sourceLanguage: 'mixed',
    minEmploymentHistory: 1,
    outputFileName: 'test7-word-export.docx'
  },
  {
    name: 'Test8',
    directory: 'Test8',
    cvFileName: 'CV4-5.pdf',
    jdFileName: 'JD4.docx',
    contractMode: 'valid_pair',
    expectedCandidateName: 'Xiaoyang Zhu',
    expectedRoleTitle: '区块链开发工程师 (Blockchain Developer)',
    sourceLanguage: 'mixed',
    minEmploymentHistory: 1,
    outputFileName: 'test8-word-export.docx'
  }
];

function getFixturePath(relativePath) {
  return path.join(FIXTURE_ROOT, relativePath);
}

function fixtureExists(relativePath) {
  return fs.existsSync(getFixturePath(relativePath));
}

function fixtureCaseIsPresent(fixtureCase) {
  return fixtureExists(path.join(fixtureCase.directory, fixtureCase.cvFileName)) &&
    fixtureExists(path.join(fixtureCase.directory, fixtureCase.jdFileName));
}

function getFixtureCvPath(fixtureCase) {
  return getFixturePath(path.join(fixtureCase.directory, fixtureCase.cvFileName));
}

function getFixtureJdPath(fixtureCase) {
  return getFixturePath(path.join(fixtureCase.directory, fixtureCase.jdFileName));
}

function fixtureCaseHasValidContract(fixtureCase) {
  return fixtureCase?.contractMode === 'valid_pair';
}

module.exports = {
  EXTERNAL_FIXTURE_CASES,
  FIXTURE_ROOT,
  fixtureCaseHasValidContract,
  fixtureCaseIsPresent,
  fixtureExists,
  getFixtureCvPath,
  getFixtureJdPath
};

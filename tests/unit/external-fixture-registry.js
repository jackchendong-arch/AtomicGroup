const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_ROOT = '/Users/jack/Dev/Test/AtomicGroup';

const EXTERNAL_FIXTURE_CASES = [
  {
    name: 'Test1',
    directory: 'Test1',
    cvFileName: 'CV.pdf',
    jdFileName: 'JD.pdf',
    minEmploymentHistory: 5,
    outputFileName: 'test1-word-export.docx'
  },
  {
    name: 'Test2',
    directory: 'Test2',
    cvFileName: 'CV_Shawn CONG_2026 .pdf',
    jdFileName: 'HSBC TA Lead.pdf',
    minEmploymentHistory: 5,
    outputFileName: 'test2-word-export.docx'
  },
  {
    name: 'Test3',
    directory: 'test3',
    cvFileName: 'CV1.pdf',
    jdFileName: 'CV4-1.pdf',
    minEmploymentHistory: 1,
    outputFileName: 'test3-word-export.docx'
  },
  {
    name: 'Test4',
    directory: 'Test4',
    cvFileName: 'CV4-1.pdf',
    jdFileName: 'JD4.docx',
    minEmploymentHistory: 1,
    outputFileName: 'test4-word-export.docx'
  },
  {
    name: 'Test5',
    directory: 'Test5',
    cvFileName: 'CV2.pdf',
    jdFileName: 'JD2.pdf',
    minEmploymentHistory: 1,
    outputFileName: 'test5-word-export.docx'
  },
  {
    name: 'Test6',
    directory: 'Test6',
    cvFileName: 'CV3.pdf',
    jdFileName: 'JD3.docx',
    minEmploymentHistory: 1,
    outputFileName: 'test6-word-export.docx'
  },
  {
    name: 'Test7',
    directory: 'Test7',
    cvFileName: 'CV4-2.pdf',
    jdFileName: 'JD4.docx',
    minEmploymentHistory: 1,
    outputFileName: 'test7-word-export.docx'
  },
  {
    name: 'Test8',
    directory: 'Test8',
    cvFileName: 'CV4-5.pdf',
    jdFileName: 'JD4.docx',
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

module.exports = {
  EXTERNAL_FIXTURE_CASES,
  FIXTURE_ROOT,
  fixtureCaseIsPresent,
  fixtureExists,
  getFixtureCvPath,
  getFixtureJdPath
};

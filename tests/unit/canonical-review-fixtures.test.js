const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const { buildCanonicalExtractionReview } = require('../../services/canonical-schema-service');
const {
  EXTERNAL_FIXTURE_CASES,
  fixtureCaseHasValidContract,
  fixtureCaseIsPresent,
  getFixtureCvPath,
  getFixtureJdPath
} = require('./external-fixture-registry');
const { writeCanonicalReviewArtifacts } = require('./canonical-review-artifact-utils');

const EXPECTED_CANONICAL_REGRESSION = {
  Test1: {
    state: 'green',
    uniqueIssueCodes: [],
    minProjects: 0,
    selectedCandidateLocation: ''
  },
  Test2: {
    state: 'red',
    uniqueIssueCodes: ['education_entry_malformed'],
    minProjects: 0,
    selectedCandidateLocation: 'Shanghai'
  },
  Test4: {
    state: 'green',
    uniqueIssueCodes: [],
    minProjects: 2,
    selectedCandidateLocation: ''
  },
  Test5: {
    state: 'red',
    uniqueIssueCodes: ['education_entry_malformed'],
    minProjects: 1,
    selectedCandidateLocation: ''
  },
  Test6: {
    state: 'red',
    uniqueIssueCodes: ['employment_entry_missing_core_fields'],
    minProjects: 1,
    selectedCandidateLocation: ''
  },
  Test7: {
    state: 'amber',
    uniqueIssueCodes: ['project_role_ambiguous'],
    minProjects: 4,
    selectedCandidateLocation: '',
    ambiguousProjectName: '721Land – OpenSea-like NFT Marketplace',
    ambiguousEmploymentCandidates: [
      {
        employmentIndex: 0,
        companyName: 'Shanghai Xiaohan Technology Co., Ltd.',
        jobTitle: 'Blockchain Engineer',
        startDate: '2021',
        endDate: '2025'
      },
      {
        employmentIndex: 1,
        companyName: 'Wanxiang Blockchain Inc., Shanghai',
        jobTitle: 'Blockchain Engineer',
        startDate: '2021',
        endDate: '2021'
      },
      {
        employmentIndex: 2,
        companyName: 'Shanghai Tancheng Data Technology Co., Ltd.',
        jobTitle: 'Full-Stack Engineer',
        startDate: '2020',
        endDate: '2021'
      }
    ]
  },
  Test8: {
    state: 'red',
    uniqueIssueCodes: ['employment_entry_missing_core_fields'],
    minProjects: 0,
    selectedCandidateLocation: 'Beijing'
  }
};

const REQUIRED_ARTIFACT_FILES = [
  'source-model.json',
  'identity-extraction.json',
  'education-extraction.json',
  'employment-extraction.json',
  'projects-extraction.json',
  'jd-requirements-extraction.json',
  'canonical-candidate.json',
  'canonical-jd.json',
  'validation-summary.json',
  'run-metadata.json'
];

for (const fixtureCase of EXTERNAL_FIXTURE_CASES) {
  const expectation = EXPECTED_CANONICAL_REGRESSION[fixtureCase.name];
  const fixtureAvailable = fixtureCaseIsPresent(fixtureCase) && fixtureCaseHasValidContract(fixtureCase) && expectation;

  test(
    `canonical extraction review writes ${fixtureCase.name} fixture artifacts with expected validation state`,
    { skip: fixtureAvailable ? false : 'Canonical fixture pair is not available or not part of the valid regression pack.' },
    async () => {
      const cvPath = getFixtureCvPath(fixtureCase);
      const jdPath = getFixtureJdPath(fixtureCase);
      const cvDocument = await importDocument(cvPath);
      const jdDocument = await importDocument(jdPath);
      const review = buildCanonicalExtractionReview({ cvDocument, jdDocument });
      const outputDirectory = await writeCanonicalReviewArtifacts({
        fixtureId: fixtureCase.name,
        review,
        metadata: {
          cvPath,
          jdPath,
          contractMode: fixtureCase.contractMode,
          sourceLanguage: fixtureCase.sourceLanguage
        }
      });
      const uniqueIssueCodes = [...new Set(review.validationSummary.issues.map((issue) => issue.code))].sort();

      assert.equal(review.candidateSchema.identity.name, fixtureCase.expectedCandidateName);
      assert.equal(review.jdSchema.role.title, fixtureCase.expectedRoleTitle);
      assert.equal(review.validationSummary.state, expectation.state);
      assert.deepEqual(uniqueIssueCodes, [...expectation.uniqueIssueCodes].sort());
      assert.equal(review.sectionExtractions.identity.selectedCandidateLocation, expectation.selectedCandidateLocation);
      assert.equal(review.candidateSchema.identity.location, expectation.selectedCandidateLocation);
      assert.ok(
        review.candidateSchema.employmentHistory.length >= fixtureCase.minEmploymentHistory,
        `${fixtureCase.name} should keep at least ${fixtureCase.minEmploymentHistory} employment rows`
      );
      assert.ok(
        review.candidateSchema.projectExperiences.length >= expectation.minProjects,
        `${fixtureCase.name} should keep at least ${expectation.minProjects} project rows`
      );
      assert.ok(review.sourceModel.documents.length >= 2);
      assert.ok(Array.isArray(review.sectionExtractions.projectExperiences.selectedOrigins));

      if (expectation.ambiguousProjectName) {
        const ambiguousProject = review.candidateSchema.projectExperiences.find(
          (entry) => entry.projectName === expectation.ambiguousProjectName
        );
        const ambiguousIssue = review.validationSummary.issues.find(
          (issue) => issue.code === 'project_role_ambiguous' && issue.projectName === expectation.ambiguousProjectName
        );

        assert.deepEqual(ambiguousProject?.ambiguousEmploymentCandidates, expectation.ambiguousEmploymentCandidates);
        assert.deepEqual(ambiguousIssue?.ambiguousEmploymentCandidates, expectation.ambiguousEmploymentCandidates);
      }

      for (const fileName of REQUIRED_ARTIFACT_FILES) {
        assert.equal(fs.existsSync(path.join(outputDirectory, fileName)), true, `${fileName} should be written for ${fixtureCase.name}`);
      }

      const candidateArtifact = JSON.parse(
        await fsPromises.readFile(path.join(outputDirectory, 'canonical-candidate.json'), 'utf8')
      );
      const sourceModelArtifact = JSON.parse(
        await fsPromises.readFile(path.join(outputDirectory, 'source-model.json'), 'utf8')
      );
      const metadataArtifact = JSON.parse(
        await fsPromises.readFile(path.join(outputDirectory, 'run-metadata.json'), 'utf8')
      );
      const validationArtifact = JSON.parse(
        await fsPromises.readFile(path.join(outputDirectory, 'validation-summary.json'), 'utf8')
      );

      assert.equal(candidateArtifact.identity.name, fixtureCase.expectedCandidateName);
      assert.ok(sourceModelArtifact.documents.every((document) => Array.isArray(document.blocks) && document.blocks.length > 0));
      assert.equal(metadataArtifact.fixtureId, fixtureCase.name);
      assert.equal(metadataArtifact.validationState, expectation.state);

      if (expectation.ambiguousProjectName) {
        const ambiguousArtifactIssue = validationArtifact.issues.find(
          (issue) => issue.code === 'project_role_ambiguous' && issue.projectName === expectation.ambiguousProjectName
        );

        assert.deepEqual(ambiguousArtifactIssue?.ambiguousEmploymentCandidates, expectation.ambiguousEmploymentCandidates);
      }
    }
  );
}

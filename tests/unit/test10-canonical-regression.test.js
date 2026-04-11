const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const { buildCanonicalExtractionReview } = require('../../services/canonical-schema-service');
const {
  buildOutputDirectory,
  DEBUG_CV_BLOCKS_DIR,
  writeCanonicalReviewArtifacts
} = require('./canonical-review-artifact-utils');
const {
  TEST10_CURATED_CASES,
  TEST10_SHARED_JD_FILE_NAME,
  getSupportedTest10CvCases,
  getTest10FilePath,
  getTest10JdPath,
  getUnsupportedTest10CvCases,
  test10IsPresent
} = require('./test10-fixture-registry');

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

const TEST10_JD_PATH = getTest10JdPath();
const TEST10_AVAILABLE = test10IsPresent() && fs.existsSync(TEST10_JD_PATH);
const CURATED_TEST10_FILE_NAMES = new Set(TEST10_CURATED_CASES.map((fixtureCase) => fixtureCase.fileName));
const TEST10_MANIFEST_PATH = path.join(DEBUG_CV_BLOCKS_DIR, 'Test10', 'manifest.json');

function sanitizeIssueCodes(issues) {
  return [...new Set(
    Array.isArray(issues)
      ? issues.map((issue) => String(issue?.code || '').trim()).filter(Boolean)
      : []
  )].sort();
}

function isValidValidationState(state) {
  return ['green', 'amber', 'red'].includes(state);
}

async function loadTest10Review(fileName) {
  const cvPath = getTest10FilePath(fileName);
  const cvDocument = await importDocument(cvPath);
  const jdDocument = await importDocument(TEST10_JD_PATH);

  assert.equal(cvDocument.error, null, `${fileName} should import successfully as a supported CV fixture.`);
  assert.equal(jdDocument.error, null, 'The shared Test10 JD should import successfully.');

  const review = buildCanonicalExtractionReview({ cvDocument, jdDocument });
  const outputDirectory = await writeCanonicalReviewArtifacts({
    fixtureId: fileName,
    outputSubdirectory: 'Test10',
    review,
    metadata: {
      cvPath,
      jdPath: TEST10_JD_PATH,
      fixturePack: 'Test10',
      assertionMode: 'stage2-stage3-regression'
    }
  });

  return {
    cvPath,
    review,
    outputDirectory
  };
}

test(
  'Test10 artifact output directories stay unique per supported CV',
  { skip: TEST10_AVAILABLE ? false : 'Test10 fixture folder or shared JD is not available on this machine.' },
  async () => {
    const directories = getSupportedTest10CvCases().map((fileName) =>
      buildOutputDirectory({
        fixtureId: fileName,
        outputSubdirectory: 'Test10'
      })
    );

    assert.equal(new Set(directories).size, directories.length);
  }
);

for (const fixtureCase of TEST10_CURATED_CASES) {
  test(
    `Test10 curated canonical regression stays stable for ${fixtureCase.fileName}`,
    { skip: TEST10_AVAILABLE ? false : 'Test10 fixture folder or shared JD is not available on this machine.' },
    async () => {
      const { review, outputDirectory } = await loadTest10Review(fixtureCase.fileName);
      const issueCodes = sanitizeIssueCodes(review.validationSummary.issues);
      const metadataArtifact = JSON.parse(
        await fsPromises.readFile(path.join(outputDirectory, 'run-metadata.json'), 'utf8')
      );

      assert.equal(review.candidateSchema.identity.name, fixtureCase.expectedCandidateName);
      assert.equal(review.jdSchema.role.title, fixtureCase.expectedRoleTitle);
      assert.equal(review.validationSummary.state, fixtureCase.expectedState);
      assert.deepEqual(issueCodes, [...fixtureCase.expectedIssueCodes].sort());
      assert.ok(
        review.candidateSchema.employmentHistory.length >= fixtureCase.minEmploymentHistory,
        `${fixtureCase.fileName} should keep at least ${fixtureCase.minEmploymentHistory} employment rows`
      );
      assert.ok(
        review.candidateSchema.projectExperiences.length >= fixtureCase.minProjects,
        `${fixtureCase.fileName} should keep at least ${fixtureCase.minProjects} project rows`
      );
      assert.equal(metadataArtifact.fixturePack, 'Test10');
      assert.equal(metadataArtifact.fixtureId, fixtureCase.fileName);
    }
  );
}

for (const fileName of getSupportedTest10CvCases().filter((candidateFile) => !CURATED_TEST10_FILE_NAMES.has(candidateFile))) {
  test(
    `Test10 supported stage-2/3 smoke stays explainable for ${fileName}`,
    { skip: TEST10_AVAILABLE ? false : 'Test10 fixture folder or shared JD is not available on this machine.' },
    async () => {
      const { review, outputDirectory } = await loadTest10Review(fileName);

      assert.equal(review.sourceModel.documents.length, 2, `${fileName} should produce a CV+JD source model.`);
      assert.ok(isValidValidationState(review.validationSummary.state), `${fileName} should emit a normalized validation state.`);
      assert.equal(review.jdSchema.role.title, 'Senior Software Engineering Manager : 0000K19E');
      assert.ok(Array.isArray(review.candidateSchema.education), `${fileName} should produce a canonical education array.`);
      assert.ok(Array.isArray(review.candidateSchema.employmentHistory), `${fileName} should produce a canonical employment array.`);
      assert.ok(Array.isArray(review.candidateSchema.projectExperiences), `${fileName} should produce a canonical project array.`);
      assert.ok(review.sectionExtractions?.identity && typeof review.sectionExtractions.identity === 'object');
      assert.ok(review.sectionExtractions?.employmentHistory && typeof review.sectionExtractions.employmentHistory === 'object');
      assert.ok(review.sectionExtractions?.projectExperiences && typeof review.sectionExtractions.projectExperiences === 'object');
      assert.equal(
        /^(19|20)\d{2}/.test(String(review.candidateSchema.identity.location || '')),
        false,
        `${fileName} should not promote a date-led line into candidate location.`
      );

      if (review.validationSummary.state === 'green') {
        assert.equal(review.validationSummary.issues.length, 0, `${fileName} should not carry issues when the state is green.`);
      } else {
        assert.ok(review.validationSummary.issues.length > 0, `${fileName} should explain non-green validation states with explicit issues.`);
      }

      for (const issue of review.validationSummary.issues) {
        assert.ok(String(issue.code || '').trim(), `${fileName} issues should carry a normalized code.`);
        assert.ok(String(issue.section || '').trim(), `${fileName} issues should carry a normalized section.`);
        assert.ok(String(issue.message || '').trim(), `${fileName} issues should carry an explanation.`);

        if (issue.code === 'project_role_ambiguous') {
          assert.ok(
            Array.isArray(issue.ambiguousEmploymentCandidates) && issue.ambiguousEmploymentCandidates.length > 0,
            `${fileName} ambiguous project issues should include competing employment candidates.`
          );
        }
      }

      for (const artifactFile of REQUIRED_ARTIFACT_FILES) {
        assert.equal(
          fs.existsSync(path.join(outputDirectory, artifactFile)),
          true,
          `${artifactFile} should be written for ${fileName}`
        );
      }
    }
  );
}

for (const fileName of getUnsupportedTest10CvCases()) {
  test(
    `Test10 legacy unsupported smoke stays explicit for ${fileName}`,
    { skip: TEST10_AVAILABLE ? false : 'Test10 fixture folder or shared JD is not available on this machine.' },
    async () => {
      const result = await importDocument(getTest10FilePath(fileName));

      assert.equal(result.file.importStatus, 'error');
      assert.match(String(result.error || ''), /Unsupported file type/i);
      assert.equal(result.text, '');
      assert.equal(result.previewText, '');
    }
  );
}

test(
  'Test10 manifest maps every CV fixture to its exact latest-run output or unsupported status',
  { skip: TEST10_AVAILABLE ? false : 'Test10 fixture folder or shared JD is not available on this machine.' },
  async () => {
    const supportedEntries = [];

    for (const fileName of getSupportedTest10CvCases()) {
      const { review, outputDirectory } = await loadTest10Review(fileName);

      supportedEntries.push({
        fileName,
        status: 'supported',
        outputDirectory: path.relative(process.cwd(), outputDirectory),
        selectedCandidateName: review.sectionExtractions?.identity?.selectedCandidateName || '',
        selectedRoleTitle: review.sectionExtractions?.identity?.selectedRoleTitle || '',
        validationState: review.validationSummary?.state || '',
        issueCodes: sanitizeIssueCodes(review.validationSummary?.issues)
      });
    }

    const unsupportedEntries = getUnsupportedTest10CvCases().map((fileName) => ({
      fileName,
      status: 'unsupported',
      reason: 'Legacy .doc CV is outside the current factual extraction pipeline.'
    }));

    const manifest = {
      fixturePack: 'Test10',
      sharedJdFileName: TEST10_SHARED_JD_FILE_NAME,
      supportedCount: supportedEntries.length,
      unsupportedCount: unsupportedEntries.length,
      generatedAt: new Date().toISOString(),
      entries: [...supportedEntries, ...unsupportedEntries]
    };

    await fsPromises.mkdir(path.dirname(TEST10_MANIFEST_PATH), { recursive: true });
    await fsPromises.writeFile(TEST10_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const reloaded = JSON.parse(await fsPromises.readFile(TEST10_MANIFEST_PATH, 'utf8'));

    assert.equal(reloaded.fixturePack, 'Test10');
    assert.equal(reloaded.sharedJdFileName, TEST10_SHARED_JD_FILE_NAME);
    assert.equal(reloaded.supportedCount, getSupportedTest10CvCases().length);
    assert.equal(reloaded.unsupportedCount, getUnsupportedTest10CvCases().length);
    assert.equal(reloaded.entries.length, getSupportedTest10CvCases().length + getUnsupportedTest10CvCases().length);
    assert.ok(
      reloaded.entries.some(
        (entry) =>
          entry.fileName === '刘欣简历.pdf' &&
          entry.status === 'supported' &&
          entry.selectedCandidateName === '刘欣'
      ),
      'The manifest should include exact output mapping for 刘欣简历.pdf'
    );
    assert.ok(
      reloaded.entries.some(
        (entry) =>
          entry.fileName === '殷昱的简历.pdf' &&
          entry.status === 'supported' &&
          entry.selectedCandidateName === '殷昱'
      ),
      'The manifest should surface the selected candidate name for 殷昱的简历.pdf'
    );
  }
);

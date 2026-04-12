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
const TEST10_TRIAGE_SUMMARY_PATH = path.join(DEBUG_CV_BLOCKS_DIR, 'Test10', 'triage-summary.json');
const TEST10_IDENTITY_EXPECTATIONS = {
  '【Devops数据中心云专家_深圳_30-45K】戴海军_21年.pdf': {
    expectedCandidateName: '戴海军',
    forbiddenIssueCodes: [
      'candidate_name_missing_or_generic',
      'candidate_name_embedded_metadata',
      'candidate_name_heading_or_table_header',
      'candidate_name_embedded_role_or_banner'
    ]
  },
  'Resume - Pengcheng Zhao.pdf': {
    expectedCandidateName: 'Pengcheng Zhao',
    forbiddenIssueCodes: [
      'candidate_name_missing_or_generic',
      'candidate_name_embedded_metadata',
      'candidate_name_heading_or_table_header',
      'candidate_name_embedded_role_or_banner'
    ]
  },
  '【资深sre工程师（外资行，甲方，稳定）_西安 30-60K】王翔 10年以上.pdf': {
    expectedCandidateName: '王翔',
    forbiddenIssueCodes: [
      'candidate_name_missing_or_generic',
      'candidate_name_embedded_metadata',
      'candidate_name_heading_or_table_header',
      'candidate_name_embedded_role_or_banner'
    ]
  },
  '【高级全栈开发工程师_西安 25-50K】赖锦有 10年以上.pdf': {
    expectedCandidateName: '赖锦有',
    forbiddenIssueCodes: [
      'candidate_name_missing_or_generic',
      'candidate_name_embedded_metadata',
      'candidate_name_heading_or_table_header',
      'candidate_name_embedded_role_or_banner'
    ]
  },
  'Atomic CV-SRE总监-胡晓亮.pdf': {
    expectedCandidateName: '胡晓亮',
    forbiddenIssueCodes: [
      'candidate_name_missing_or_generic',
      'candidate_name_embedded_metadata',
      'candidate_name_heading_or_table_header',
      'candidate_name_embedded_role_or_banner'
    ],
    expectedState: 'green'
  }
};
const TEST10_IDENTITY_OUTLIER_EXPECTATIONS = {
  '【ios技术专家_西安 30-50K】王虎啸 5年.pdf': {
    expectedIssueCodes: ['candidate_name_heading_or_table_header']
  },
  '【高级android开发工程师（外资+福利多）_西安 30-50K】赵先生 10年以上.pdf': {
    expectedIssueCodes: ['candidate_name_embedded_metadata']
  }
};

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

function buildValidationStateCounts(entries = []) {
  return entries.reduce((counts, entry) => {
    const state = entry.validationState;

    if (!isValidValidationState(state)) {
      return counts;
    }

    counts[state] += 1;
    return counts;
  }, { green: 0, amber: 0, red: 0 });
}

function mapIssueCodeToFamily(code) {
  const normalized = String(code || '').trim();

  if (normalized.startsWith('candidate_name_')) {
    return 'identity';
  }

  if (normalized.startsWith('employment_')) {
    return 'employment';
  }

  if (normalized.startsWith('education_')) {
    return 'education';
  }

  if (normalized.startsWith('project_')) {
    return 'projects';
  }

  if (normalized.startsWith('role_')) {
    return 'role';
  }

  if (normalized.startsWith('jd_')) {
    return 'requirements';
  }

  return 'other';
}

function buildSortedCountRows(values = []) {
  const counts = new Map();

  for (const value of values) {
    const normalized = String(value || '').trim();

    if (!normalized) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => (
      right.count - left.count ||
      left.code.localeCompare(right.code, 'en')
    ));
}

function buildHighestSignalOutliers(entries = []) {
  const candidateNameIssuePrefix = 'candidate_name_';

  return entries
    .filter((entry) => entry.issueCodes.some((code) => code.startsWith(candidateNameIssuePrefix)))
    .map((entry) => ({
      fileName: entry.fileName,
      selectedCandidateName: entry.selectedCandidateName,
      validationState: entry.validationState,
      issueCodes: entry.issueCodes,
      outputDirectory: entry.outputDirectory
    }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName, 'en'));
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
      const issueCodes = sanitizeIssueCodes(review.validationSummary.issues);

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

      const targetedIdentityExpectation = TEST10_IDENTITY_EXPECTATIONS[fileName];

      if (targetedIdentityExpectation) {
        assert.equal(review.candidateSchema.identity.name, targetedIdentityExpectation.expectedCandidateName);

        if (targetedIdentityExpectation.expectedState) {
          assert.equal(review.validationSummary.state, targetedIdentityExpectation.expectedState);
        }

        for (const forbiddenIssueCode of targetedIdentityExpectation.forbiddenIssueCodes) {
          assert.equal(
            issueCodes.includes(forbiddenIssueCode),
            false,
            `${fileName} should no longer carry the identity issue ${forbiddenIssueCode}`
          );
        }
      }

      const identityOutlierExpectation = TEST10_IDENTITY_OUTLIER_EXPECTATIONS[fileName];

      if (identityOutlierExpectation) {
        for (const expectedIssueCode of identityOutlierExpectation.expectedIssueCodes) {
          assert.equal(
            issueCodes.includes(expectedIssueCode),
            true,
            `${fileName} should surface ${expectedIssueCode} for identity triage`
          );
        }
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
    const triageSummary = {
      fixturePack: 'Test10',
      sharedJdFileName: TEST10_SHARED_JD_FILE_NAME,
      generatedAt: new Date().toISOString(),
      counts: {
        supported: supportedEntries.length,
        unsupported: unsupportedEntries.length,
        validationStates: buildValidationStateCounts(supportedEntries)
      },
      dominantIssueCodes: buildSortedCountRows(
        supportedEntries.flatMap((entry) => entry.issueCodes)
      ),
      dominantIssueFamilies: buildSortedCountRows(
        supportedEntries.flatMap((entry) => entry.issueCodes.map(mapIssueCodeToFamily))
      ),
      highestSignalOutliers: buildHighestSignalOutliers(supportedEntries)
    };

    await fsPromises.mkdir(path.dirname(TEST10_MANIFEST_PATH), { recursive: true });
    await fsPromises.writeFile(TEST10_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await fsPromises.writeFile(TEST10_TRIAGE_SUMMARY_PATH, `${JSON.stringify(triageSummary, null, 2)}\n`, 'utf8');

    const reloaded = JSON.parse(await fsPromises.readFile(TEST10_MANIFEST_PATH, 'utf8'));
    const reloadedTriage = JSON.parse(await fsPromises.readFile(TEST10_TRIAGE_SUMMARY_PATH, 'utf8'));

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
    assert.equal(reloadedTriage.fixturePack, 'Test10');
    assert.equal(reloadedTriage.counts.supported, getSupportedTest10CvCases().length);
    assert.equal(reloadedTriage.counts.validationStates.green >= 1, true);
    assert.equal(
      reloadedTriage.highestSignalOutliers.some(
        (entry) =>
          entry.fileName === '【ios技术专家_西安 30-50K】王虎啸 5年.pdf' &&
          entry.issueCodes.includes('candidate_name_heading_or_table_header')
      ),
      true
    );
  }
);

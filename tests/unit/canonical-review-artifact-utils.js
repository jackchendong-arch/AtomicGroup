const fs = require('node:fs/promises');
const path = require('node:path');

const DEBUG_CV_BLOCKS_DIR = path.resolve(__dirname, '../../debug/CV_blocks');

function sanitizeFixtureId(fixtureId) {
  return String(fixtureId || 'unknown-fixture')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_');
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeCanonicalReviewArtifacts({
  fixtureId,
  review,
  metadata = {}
}) {
  const outputDirectory = path.join(DEBUG_CV_BLOCKS_DIR, sanitizeFixtureId(fixtureId));

  await fs.mkdir(outputDirectory, { recursive: true });
  await writeJson(path.join(outputDirectory, 'source-model.json'), review.sourceModel || { documents: [] });
  await writeJson(path.join(outputDirectory, 'identity-extraction.json'), review.sectionExtractions?.identity || {});
  await writeJson(path.join(outputDirectory, 'education-extraction.json'), review.sectionExtractions?.education || {});
  await writeJson(path.join(outputDirectory, 'employment-extraction.json'), review.sectionExtractions?.employmentHistory || {});
  await writeJson(path.join(outputDirectory, 'projects-extraction.json'), review.sectionExtractions?.projectExperiences || {});
  await writeJson(path.join(outputDirectory, 'jd-requirements-extraction.json'), review.sectionExtractions?.jdRequirements || {});
  await writeJson(path.join(outputDirectory, 'canonical-candidate.json'), review.candidateSchema || {});
  await writeJson(path.join(outputDirectory, 'canonical-jd.json'), review.jdSchema || {});
  await writeJson(path.join(outputDirectory, 'validation-summary.json'), review.validationSummary || {});
  await writeJson(path.join(outputDirectory, 'run-metadata.json'), {
    fixtureId,
    schemaVersion: review.schemaVersion,
    validationState: review.validationSummary?.state || '',
    issueCodes: Array.isArray(review.validationSummary?.issues)
      ? review.validationSummary.issues.map((issue) => issue.code)
      : [],
    generatedAt: new Date().toISOString(),
    ...metadata
  });

  return outputDirectory;
}

module.exports = {
  DEBUG_CV_BLOCKS_DIR,
  writeCanonicalReviewArtifacts
};

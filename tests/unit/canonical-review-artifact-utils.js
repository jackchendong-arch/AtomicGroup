const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const DEBUG_CV_BLOCKS_DIR = path.resolve(__dirname, '../../debug/CV_blocks');

function sanitizeFixtureId(fixtureId) {
  const normalized = String(fixtureId || 'unknown-fixture')
    .normalize('NFKC')
    .trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[\u0000-\u001f]+/g, '')
    .replace(/\s+/g, ' ');
  const fallbackSafe = normalized
    .replace(/[<>:"|?*]+/g, '_')
    .trim() || 'unknown-fixture';
  const suffix = createHash('sha1')
    .update(String(fixtureId || 'unknown-fixture'))
    .digest('hex')
    .slice(0, 8);

  return `${fallbackSafe}--${suffix}`;
}

function sanitizePathSegment(segment) {
  return String(segment || 'unknown')
    .normalize('NFKC')
    .trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[\u0000-\u001f]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[<>:"|?*]+/g, '_')
    .trim() || 'unknown';
}

function buildOutputDirectory({ fixtureId, outputSubdirectory = '' }) {
  const pathSegments = Array.isArray(outputSubdirectory)
    ? outputSubdirectory
    : String(outputSubdirectory || '')
      .split(/[\\/]/)
      .filter(Boolean);

  return path.join(
    DEBUG_CV_BLOCKS_DIR,
    ...pathSegments.map((segment) => sanitizePathSegment(segment)),
    sanitizeFixtureId(fixtureId)
  );
}

function buildLegacyOutputDirectory({ fixtureId, outputSubdirectory = '' }) {
  const pathSegments = Array.isArray(outputSubdirectory)
    ? outputSubdirectory
    : String(outputSubdirectory || '')
      .split(/[\\/]/)
      .filter(Boolean);

  return path.join(
    DEBUG_CV_BLOCKS_DIR,
    ...pathSegments.map((segment) => sanitizePathSegment(segment)),
    sanitizePathSegment(fixtureId)
  );
}

function buildOutputScopeDirectory(outputSubdirectory = '') {
  const pathSegments = Array.isArray(outputSubdirectory)
    ? outputSubdirectory
    : String(outputSubdirectory || '')
      .split(/[\\/]/)
      .filter(Boolean);

  return path.join(
    DEBUG_CV_BLOCKS_DIR,
    ...pathSegments.map((segment) => sanitizePathSegment(segment))
  );
}

async function removeDirectoryIfPresent(directoryPath) {
  await fs.rm(directoryPath, { recursive: true, force: true });
}

async function clearCanonicalReviewArtifacts({
  fixtureId,
  outputSubdirectory = ''
}) {
  await removeDirectoryIfPresent(buildOutputDirectory({ fixtureId, outputSubdirectory }));
  await removeDirectoryIfPresent(buildLegacyOutputDirectory({ fixtureId, outputSubdirectory }));
}

async function clearCanonicalReviewArtifactScope(outputSubdirectory = '') {
  await removeDirectoryIfPresent(buildOutputScopeDirectory(outputSubdirectory));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeCanonicalReviewArtifacts({
  fixtureId,
  outputSubdirectory = '',
  review,
  metadata = {}
}) {
  const outputDirectory = buildOutputDirectory({ fixtureId, outputSubdirectory });

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
  clearCanonicalReviewArtifacts,
  clearCanonicalReviewArtifactScope,
  buildLegacyOutputDirectory,
  buildOutputDirectory,
  writeCanonicalReviewArtifacts
};

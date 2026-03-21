const fs = require('node:fs/promises');
const path = require('node:path');

const { SUPPORTED_EXTENSIONS } = require('./document-service');

function compareSourceFolderFiles(left, right) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
}

async function listSourceFolderDocuments(folderPath) {
  const resolvedPath = path.resolve(folderPath);
  const stats = await fs.stat(resolvedPath);

  if (!stats.isDirectory()) {
    throw new Error('The selected source path is not a folder.');
  }

  const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
  const fileCandidates = entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      entry,
      extension: path.extname(entry.name).toLowerCase()
    }))
    .filter(({ extension }) => SUPPORTED_EXTENSIONS.has(extension));

  const files = await Promise.all(fileCandidates.map(async ({ entry, extension }) => {
    const filePath = path.join(resolvedPath, entry.name);
    const fileStats = await fs.stat(filePath);

    return {
      path: filePath,
      name: entry.name,
      extension,
      sizeBytes: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    };
  }));

  files.sort(compareSourceFolderFiles);

  return {
    folder: {
      path: resolvedPath,
      name: path.basename(resolvedPath) || resolvedPath
    },
    files
  };
}

module.exports = {
  listSourceFolderDocuments
};

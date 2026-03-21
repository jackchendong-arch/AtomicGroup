const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { listSourceFolderDocuments } = require('../../services/source-folder-service');

test('listSourceFolderDocuments returns only supported source files from the selected folder', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-source-folder-'));

  try {
    await fs.writeFile(path.join(tempRoot, 'candidate-cv.pdf'), 'pdf');
    await fs.writeFile(path.join(tempRoot, 'job-description.docx'), 'docx');
    await fs.writeFile(path.join(tempRoot, 'notes.txt'), 'txt');
    await fs.writeFile(path.join(tempRoot, 'guidance.md'), 'markdown');
    await fs.mkdir(path.join(tempRoot, 'nested'));
    await fs.writeFile(path.join(tempRoot, 'nested', 'nested-cv.pdf'), 'nested');

    const result = await listSourceFolderDocuments(tempRoot);

    assert.equal(result.folder.path, tempRoot);
    assert.equal(result.folder.name, path.basename(tempRoot));
    assert.deepEqual(
      result.files.map((file) => file.name),
      ['candidate-cv.pdf', 'job-description.docx', 'notes.txt']
    );
    assert.deepEqual(
      result.files.map((file) => file.extension),
      ['.pdf', '.docx', '.txt']
    );
    assert.ok(result.files.every((file) => typeof file.sizeBytes === 'number'));
    assert.ok(result.files.every((file) => typeof file.modifiedAt === 'string' && file.modifiedAt.length > 0));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('listSourceFolderDocuments rejects non-directory paths', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-source-folder-'));
  const filePath = path.join(tempRoot, 'candidate-cv.pdf');

  try {
    await fs.writeFile(filePath, 'pdf');

    await assert.rejects(
      () => listSourceFolderDocuments(filePath),
      /not a folder/i
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

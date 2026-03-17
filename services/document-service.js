const fs = require('node:fs/promises');
const path = require('node:path');

const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

function normalizeWhitespace(value) {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function createPreviewText(text, maxLength = 1200) {
  if (!text) {
    return '';
  }

  const normalized = normalizeWhitespace(text);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function createWarnings(text, extension) {
  const warnings = [];
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    warnings.push('No readable text was extracted from this document.');
    return warnings;
  }

  if (normalized.length < 140) {
    warnings.push('Extracted text is very short and may be incomplete.');
  }

  if (extension === '.pdf' && normalized.length < 220) {
    warnings.push('This PDF may be image-based or low quality. Review the preview before drafting.');
  }

  return warnings;
}

async function extractTextFromTxt(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractTextFromPdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractText(filePath, extension) {
  if (extension === '.txt') {
    return extractTextFromTxt(filePath);
  }

  if (extension === '.docx') {
    return extractTextFromDocx(filePath);
  }

  if (extension === '.pdf') {
    return extractTextFromPdf(filePath);
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

async function importDocument(filePath) {
  const resolvedPath = path.resolve(filePath);
  const name = path.basename(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const stats = await fs.stat(resolvedPath);

  if (!stats.isFile()) {
    return {
      file: {
        path: resolvedPath,
        name,
        extension: extension || 'unknown',
        sizeBytes: 0,
        importStatus: 'error'
      },
      text: '',
      previewText: '',
      warnings: [],
      error: 'The selected path is not a file.'
    };
  }

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      file: {
        path: resolvedPath,
        name,
        extension: extension || 'unknown',
        sizeBytes: stats.size,
        importStatus: 'error'
      },
      text: '',
      previewText: '',
      warnings: [],
      error: 'Unsupported file type. Release 1 accepts PDF, DOCX, and TXT only.'
    };
  }

  try {
    const text = normalizeWhitespace(await extractText(resolvedPath, extension));
    const warnings = createWarnings(text, extension);

    return {
      file: {
        path: resolvedPath,
        name,
        extension,
        sizeBytes: stats.size,
        importStatus: warnings.length > 0 ? 'warning' : 'ready'
      },
      text,
      previewText: createPreviewText(text),
      warnings,
      error: null
    };
  } catch (error) {
    return {
      file: {
        path: resolvedPath,
        name,
        extension,
        sizeBytes: stats.size,
        importStatus: 'error'
      },
      text: '',
      previewText: '',
      warnings: [],
      error: error instanceof Error ? error.message : 'Unable to extract text from this document.'
    };
  }
}

module.exports = {
  importDocument,
  SUPPORTED_EXTENSIONS
};

const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt']);
const REFERENCE_TEMPLATE_EXTENSIONS = new Set(['.md']);
const execFileAsync = promisify(execFile);
const PDF_PAGE_MARKER_PATTERN = /^[-–—]*\s*\d+\s+of\s+\d+\s*[-–—]*$/i;
const PDF_OPAQUE_ARTIFACT_PATTERN = /^(?:~+|(?=.*\d)(?=.*[A-Za-z])(?=.*[_~-])[A-Za-z0-9_~-]{20,})$/;
const PDF_OCR_PAGE_LIMIT = 6;
const OCR_LANGUAGE = 'eng+chi_sim';
let legacyWordConverterCheckPromise = null;

function startTimer() {
  const startedAt = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function normalizeWhitespace(value) {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function stripStandalonePdfPageMarkers(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !PDF_PAGE_MARKER_PATTERN.test(String(line || '').trim()))
    .join('\n');
}

function stripStandalonePdfArtifacts(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => {
      const normalizedLine = String(line || '').trim();

      if (!normalizedLine) {
        return true;
      }

      return !PDF_OPAQUE_ARTIFACT_PATTERN.test(normalizedLine);
    })
    .join('\n');
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

function createWarnings(text, extension, extractionMeta = {}) {
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

  if (extension === '.pdf' && extractionMeta.weakImageBasedPdf && !extractionMeta.usedOcrFallback) {
    warnings.push('This PDF appears image-based and the extracted text may be incomplete without OCR support.');
  }

  if (extension === '.pdf' && extractionMeta.usedOcrFallback) {
    warnings.push('OCR fallback was used for this PDF because the embedded text looked incomplete.');
  }

  if (extension === '.doc' && extractionMeta.usedLegacyWordConverter) {
    warnings.push('This legacy Word (.doc) file was converted during import. Review the extracted text before drafting.');
  }

  return warnings;
}

async function extractTextFromTxt(filePath) {
  return fsPromises.readFile(filePath, 'utf8');
}

async function extractTextFromMd(filePath) {
  return fsPromises.readFile(filePath, 'utf8');
}

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function checkLegacyWordConverterAvailable() {
  if (!legacyWordConverterCheckPromise) {
    legacyWordConverterCheckPromise = execFileAsync('textutil', ['-help'], {
      maxBuffer: 2 * 1024 * 1024
    })
      .then(() => true)
      .catch(() => false);
  }

  return legacyWordConverterCheckPromise;
}

async function extractTextFromDoc(filePath) {
  const converterAvailable = await checkLegacyWordConverterAvailable();

  if (!converterAvailable) {
    throw new Error('Legacy Word (.doc) import requires the macOS textutil converter on this machine.');
  }

  const output = await getCommandOutput('textutil', ['-convert', 'txt', '-stdout', filePath]);
  return output;
}

async function extractTextFromPdf(filePath) {
  const buffer = await fsPromises.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function getCommandOutput(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  return result.stdout || '';
}

async function inspectPdfImagePages(filePath) {
  try {
    const output = await getCommandOutput('pdfimages', ['-list', filePath]);
    const lines = output.split('\n').slice(2).map((line) => line.trim()).filter(Boolean);
    const imagePages = new Set();

    for (const line of lines) {
      const match = line.match(/^(\d+)\s+\d+\s+image\b/i);
      if (match) {
        imagePages.add(Number.parseInt(match[1], 10));
      }
    }

    return {
      imagePages: [...imagePages].sort((left, right) => left - right),
      imagePageCount: imagePages.size
    };
  } catch {
    return {
      imagePages: [],
      imagePageCount: 0
    };
  }
}

async function readPdfPageCount(filePath) {
  try {
    const output = await getCommandOutput('pdfinfo', [filePath]);
    const match = output.match(/^Pages:\s+(\d+)$/m);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function countPdfPageMarkers(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => PDF_PAGE_MARKER_PATTERN.test(String(line || '').trim()))
    .length;
}

function scorePdfExtractionCandidate(text) {
  const normalized = normalizeWhitespace(stripStandalonePdfArtifacts(stripStandalonePdfPageMarkers(text)));
  if (!normalized) {
    return 0;
  }

  const dateMatches = normalized.match(/\b(?:19|20)\d{2}\b/g) || [];
  const experienceMatches = normalized.match(/\b(?:professional|employment|work|project)\s+experience\b/gi) || [];
  const bulletMatches = normalized.match(/(?:^|\n)\s*[•*-]\s+/gm) || [];

  return normalized.length +
    (dateMatches.length * 120) +
    (experienceMatches.length * 260) +
    (bulletMatches.length * 45) -
    (countPdfPageMarkers(text) * 220);
}

function shouldAttemptPdfOcrFallback(text, imageInspection, pageCount) {
  const normalized = normalizeWhitespace(text);
  const pageMarkerCount = countPdfPageMarkers(text);
  const imagePageCount = imageInspection?.imagePageCount || 0;
  const effectivePageCount = pageCount || imagePageCount || 0;
  const averageCharsPerPage = effectivePageCount > 0
    ? normalized.length / effectivePageCount
    : normalized.length;
  const imageHeavyPdf = effectivePageCount > 0
    ? imagePageCount >= Math.max(1, effectivePageCount - 1)
    : imagePageCount > 0;

  if (!normalized) {
    return imagePageCount > 0;
  }

  if (effectivePageCount > PDF_OCR_PAGE_LIMIT) {
    return false;
  }

  if (pageMarkerCount >= Math.max(1, effectivePageCount - 1) && imageHeavyPdf && averageCharsPerPage < 700) {
    return true;
  }

  if (normalized.length < 1600 && imageHeavyPdf && averageCharsPerPage < 700) {
    return true;
  }

  return false;
}

async function extractTextFromPdfWithOcr(filePath, pageCount) {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'atomicgroup-pdf-ocr-'));
  const prefix = path.join(tempDir, 'page');

  try {
    const pdftoppmArgs = ['-png'];

    if (pageCount) {
      pdftoppmArgs.push('-f', '1', '-l', String(pageCount));
    }

    pdftoppmArgs.push(filePath, prefix);
    await execFileAsync('pdftoppm', pdftoppmArgs, { maxBuffer: 16 * 1024 * 1024 });

    const files = (await fsPromises.readdir(tempDir))
      .filter((file) => /^page-\d+\.png$/i.test(file))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const pageTexts = [];

    for (const file of files) {
      const imagePath = path.join(tempDir, file);
      const { stdout } = await execFileAsync('tesseract', [
        imagePath,
        'stdout',
        '-l',
        OCR_LANGUAGE,
        '--psm',
        '11'
      ], {
        maxBuffer: 16 * 1024 * 1024
      });

      const pageText = normalizeWhitespace(stdout);
      if (pageText) {
        pageTexts.push(pageText);
      }
    }

    return pageTexts.join('\n\n');
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
}

async function improvePdfExtractionIfNeeded(filePath, extractedText) {
  const pageCount = await readPdfPageCount(filePath);
  const imageInspection = await inspectPdfImagePages(filePath);
  const weakImageBasedPdf = shouldAttemptPdfOcrFallback(extractedText, imageInspection, pageCount);

  if (!weakImageBasedPdf) {
    return {
      text: extractedText,
      weakImageBasedPdf: false,
      usedOcrFallback: false
    };
  }

  try {
    const limitedPageCount = pageCount ? Math.min(pageCount, PDF_OCR_PAGE_LIMIT) : PDF_OCR_PAGE_LIMIT;
    const ocrText = await extractTextFromPdfWithOcr(filePath, limitedPageCount);
    const baseScore = scorePdfExtractionCandidate(extractedText);
    const ocrScore = scorePdfExtractionCandidate(ocrText);

    if (ocrScore > baseScore + 400) {
      return {
        text: ocrText,
        weakImageBasedPdf: true,
        usedOcrFallback: true
      };
    }
  } catch {
    // Fall back silently to the embedded text layer; warnings will still reflect weak image-based extraction.
  }

  return {
    text: extractedText,
    weakImageBasedPdf: true,
    usedOcrFallback: false
  };
}

async function extractText(filePath, extension) {
  if (extension === '.txt') {
    return extractTextFromTxt(filePath);
  }

  if (extension === '.md') {
    return extractTextFromMd(filePath);
  }

  if (extension === '.docx') {
    return extractTextFromDocx(filePath);
  }

  if (extension === '.doc') {
    return extractTextFromDoc(filePath);
  }

  if (extension === '.pdf') {
    return extractTextFromPdf(filePath);
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

async function importDocumentWithOptions(filePath, {
  supportedExtensions = SUPPORTED_EXTENSIONS,
  unsupportedMessage = 'Unsupported file type. Source documents accept PDF, DOC, DOCX, and TXT only.'
} = {}) {
  const totalTimer = startTimer();
  const resolvedPath = path.resolve(filePath);
  const name = path.basename(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const stats = await fsPromises.stat(resolvedPath);

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
      error: 'The selected path is not a file.',
      performance: {
        totalMs: totalTimer()
      }
    };
  }

  if (!supportedExtensions.has(extension)) {
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
      error: unsupportedMessage,
      performance: {
        totalMs: totalTimer()
      }
    };
  }

  try {
    const extractTimer = startTimer();
    const extractedText = await extractText(resolvedPath, extension);
    const extractMs = extractTimer();
    const normalizeTimer = startTimer();
    const improvedPdfExtraction = extension === '.pdf'
      ? await improvePdfExtractionIfNeeded(resolvedPath, extractedText)
      : extension === '.doc'
        ? {
          text: extractedText,
          weakImageBasedPdf: false,
          usedOcrFallback: false,
          usedLegacyWordConverter: true
        }
      : {
        text: extractedText,
        weakImageBasedPdf: false,
        usedOcrFallback: false
      };
    const text = normalizeWhitespace(stripStandalonePdfArtifacts(stripStandalonePdfPageMarkers(improvedPdfExtraction.text)));
    const normalizeMs = normalizeTimer();
    const warnings = createWarnings(text, extension, improvedPdfExtraction);

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
      error: null,
      performance: {
        totalMs: totalTimer(),
        extractMs,
        normalizeMs
      }
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
      error: error instanceof Error ? error.message : 'Unable to extract text from this document.',
      performance: {
        totalMs: totalTimer()
      }
    };
  }
}

async function importDocument(filePath) {
  return importDocumentWithOptions(filePath);
}

async function importReferenceTemplateDocument(filePath) {
  return importDocumentWithOptions(filePath, {
    supportedExtensions: REFERENCE_TEMPLATE_EXTENSIONS,
    unsupportedMessage: 'Unsupported reference template type. Reference templates accept Markdown (.md) only.'
  });
}

module.exports = {
  importDocument,
  importReferenceTemplateDocument,
  REFERENCE_TEMPLATE_EXTENSIONS,
  SUPPORTED_EXTENSIONS
};

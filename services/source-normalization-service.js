const path = require('node:path');

const STANDALONE_PAGE_MARKER_PATTERN = /^[-–—\s]*\d+\s+of\s+\d+\s*[-–—\s]*$/i;
const PAGE_OF_PATTERN = /^page\s+\d+\s+of\s+\d+$/i;
const OPAQUE_PDF_ARTIFACT_PATTERN = /^(?:~+|(?=.*\d)(?=.*[A-Za-z])(?=.*[_~-])[A-Za-z0-9_~-]{20,})$/;
const DECORATION_ONLY_PATTERN = /^[\s\-–—_=~*•·•▪●○◦]{3,}$/;
const BULLET_PREFIX_PATTERN = /^\s*[•●◦▪■○*\-–—]+\s+/;

const SECTION_KEY_BY_HEADING = {
  experience: 'experience',
  'work experience': 'experience',
  'employment experience': 'experience',
  'professional experience': 'experience',
  'career history': 'experience',
  'project experience': 'projects',
  projects: 'projects',
  education: 'education',
  'education background': 'education',
  skills: 'skills',
  'technical skills': 'skills',
  languages: 'languages',
  language: 'languages',
  requirements: 'requirements',
  requirement: 'requirements',
  responsibilities: 'responsibilities',
  responsibility: 'responsibilities',
  summary: 'overview',
  overview: 'overview',
  'job title': 'overview',
  'target role': 'overview',
  candidate: 'overview',
  'fit summary': 'fit',
  relevant: 'experience',
  'relevant experience': 'experience',
  'key requirements': 'requirements',
  'match against key requirements': 'requirements',
  'potential concerns / gaps': 'concerns',
  'recommended next step': 'next-step',
  工作经历: 'experience',
  工作经验: 'experience',
  职业经历: 'experience',
  项目经历: 'projects',
  教育背景: 'education',
  教育经历: 'education',
  技能: 'skills',
  技术栈: 'skills',
  语言: 'languages',
  岗位职责: 'responsibilities',
  任职要求: 'requirements',
  岗位要求: 'requirements',
  职位描述: 'overview',
  岗位描述: 'overview',
  匹配概述: 'fit',
  相关经验: 'experience',
  与关键要求的匹配: 'requirements',
  '潜在顾虑 / 差距': 'concerns',
  建议下一步: 'next-step'
};

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeading(value) {
  return cleanLine(String(value || '')
    .replace(/^#+\s*/, '')
    .replace(/[:：]\s*$/, '')
    .toLowerCase());
}

function splitParagraphs(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function isStandalonePageMarker(text) {
  const normalized = cleanLine(text);

  if (!normalized) {
    return false;
  }

  return STANDALONE_PAGE_MARKER_PATTERN.test(normalized) || PAGE_OF_PATTERN.test(normalized);
}

function isOpaquePdfArtifactLine(text) {
  const normalized = cleanLine(text);

  if (!normalized) {
    return false;
  }

  return OPAQUE_PDF_ARTIFACT_PATTERN.test(normalized);
}

function isDecorationOnlyLine(text) {
  const normalized = cleanLine(text);

  if (!normalized) {
    return false;
  }

  return DECORATION_ONLY_PATTERN.test(normalized);
}

function normalizeBulletMarker(text) {
  const normalized = cleanLine(text);

  if (!normalized) {
    return '';
  }

  return BULLET_PREFIX_PATTERN.test(normalized)
    ? normalized.replace(BULLET_PREFIX_PATTERN, '- ')
    : normalized;
}

function resolveSectionKey(heading, fallback = 'overview') {
  return SECTION_KEY_BY_HEADING[normalizeHeading(heading)] || fallback;
}

function isHeadingParagraph(paragraph) {
  const lines = paragraph.split('\n').map((line) => cleanLine(line)).filter(Boolean);

  if (lines.length !== 1) {
    return false;
  }

  const line = lines[0];
  const normalized = normalizeHeading(line);

  if (SECTION_KEY_BY_HEADING[normalized]) {
    return true;
  }

  if (line.startsWith('#')) {
    return true;
  }

  return /^[A-Z][A-Za-z\s/&-]{2,40}$/.test(line) || /^[\u4e00-\u9fffA-Za-z\s/&-]{2,20}$/.test(line);
}

function createCleaningManifestEntry({
  ruleId,
  action,
  documentType,
  paragraphIndex,
  lineIndex,
  before,
  after = '',
  confidence = 'high'
}) {
  return {
    ruleId,
    action,
    documentType,
    sourceRef: {
      paragraph: paragraphIndex + 1,
      line: lineIndex + 1
    },
    before,
    after,
    confidence
  };
}

function normalizeParagraphLines(paragraph, { documentType, paragraphIndex, cleaningManifest }) {
  const originalLines = String(paragraph || '')
    .split('\n')
    .map((line) => String(line || ''));
  const normalizedLinePairs = [];

  originalLines.forEach((line, lineIndex) => {
    const cleanedOriginal = cleanLine(line);

    if (!cleanedOriginal) {
      return;
    }

    if (isStandalonePageMarker(cleanedOriginal)) {
      cleaningManifest.push(createCleaningManifestEntry({
        ruleId: 'strip_page_marker',
        action: 'strip',
        documentType,
        paragraphIndex,
        lineIndex,
        before: cleanedOriginal
      }));
      return;
    }

    if (isOpaquePdfArtifactLine(cleanedOriginal)) {
      cleaningManifest.push(createCleaningManifestEntry({
        ruleId: 'strip_opaque_pdf_artifact',
        action: 'strip',
        documentType,
        paragraphIndex,
        lineIndex,
        before: cleanedOriginal
      }));
      return;
    }

    if (isDecorationOnlyLine(cleanedOriginal)) {
      cleaningManifest.push(createCleaningManifestEntry({
        ruleId: 'strip_decoration_only_line',
        action: 'strip',
        documentType,
        paragraphIndex,
        lineIndex,
        before: cleanedOriginal
      }));
      return;
    }

    const normalizedLine = normalizeBulletMarker(cleanedOriginal);
    const actions = [];

    if (normalizedLine !== cleanedOriginal) {
      actions.push('normalize_bullet_marker');
      cleaningManifest.push(createCleaningManifestEntry({
        ruleId: 'normalize_bullet_marker',
        action: 'normalize',
        documentType,
        paragraphIndex,
        lineIndex,
        before: cleanedOriginal,
        after: normalizedLine
      }));
    }

    normalizedLinePairs.push({
      original: cleanedOriginal,
      normalized: normalizedLine,
      actions
    });
  });

  return normalizedLinePairs;
}

function createBlockId(documentType, order) {
  return `${documentType}-${order + 1}`;
}

function buildNormalizedSourceDocument({
  documentType,
  label,
  text,
  sourcePath = ''
}) {
  const paragraphs = splitParagraphs(text);
  const cleaningManifest = [];
  const normalizedBlocks = [];
  let currentSectionKey = 'overview';
  let currentSectionLabel = 'Overview';
  let currentClassificationReason = 'default_overview';
  let currentClassificationConfidence = 'medium';

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const normalizedLinePairs = normalizeParagraphLines(paragraph, {
      documentType,
      paragraphIndex,
      cleaningManifest
    });

    if (normalizedLinePairs.length === 0) {
      return;
    }

    const normalizedLines = normalizedLinePairs.map((entry) => entry.normalized);
    const originalLines = normalizedLinePairs.map((entry) => entry.original);
    const normalizedParagraph = normalizedLines.join('\n');

    if (isHeadingParagraph(normalizedParagraph)) {
      currentSectionLabel = normalizedLines[0];
      currentSectionKey = resolveSectionKey(currentSectionLabel, currentSectionKey);
      currentClassificationReason = 'explicit_heading';
      currentClassificationConfidence = 'high';
      return;
    }

    if (normalizedLines.length > 1 && isHeadingParagraph(normalizedLines[0])) {
      currentSectionLabel = normalizedLines[0];
      currentSectionKey = resolveSectionKey(currentSectionLabel, currentSectionKey);
      currentClassificationReason = 'explicit_heading';
      currentClassificationConfidence = 'high';
      normalizedLines.shift();
      originalLines.shift();
      normalizedLinePairs.shift();
    }

    const blockOriginal = originalLines.join('\n').trim();
    const blockNormalized = normalizedLines.join('\n').trim();

    if (!blockNormalized) {
      return;
    }

    normalizedBlocks.push({
      blockId: createBlockId(documentType, normalizedBlocks.length),
      documentType,
      documentLabel: label,
      sourcePath,
      sourceName: sourcePath ? path.basename(sourcePath) : label,
      sectionKey: currentSectionKey,
      sectionLabel: currentSectionLabel,
      classificationReason: currentClassificationReason,
      classificationConfidence: currentClassificationConfidence,
      order: normalizedBlocks.length,
      textOriginal: blockOriginal,
      textNormalized: blockNormalized,
      cleaningActions: [...new Set(normalizedLinePairs.flatMap((entry) => entry.actions))],
      sourceRefs: [
        {
          paragraph: paragraphIndex + 1
        }
      ]
    });
  });

  if (normalizedBlocks.length === 0 && cleanLine(text)) {
    normalizedBlocks.push({
      blockId: createBlockId(documentType, 0),
      documentType,
      documentLabel: label,
      sourcePath,
      sourceName: sourcePath ? path.basename(sourcePath) : label,
      sectionKey: 'overview',
      sectionLabel: 'Overview',
      classificationReason: 'default_overview',
      classificationConfidence: 'low',
      order: 0,
      textOriginal: cleanLine(text),
      textNormalized: cleanLine(text),
      cleaningActions: [],
      sourceRefs: [
        {
          paragraph: 1
        }
      ]
    });
  }

  return {
    rawSource: {
      documentType,
      label,
      sourcePath,
      sourceName: sourcePath ? path.basename(sourcePath) : label,
      text: String(text || '')
    },
    normalizedBlocks,
    cleaningManifest
  };
}

module.exports = {
  buildNormalizedSourceDocument,
  cleanLine,
  normalizeHeading,
  splitParagraphs
};

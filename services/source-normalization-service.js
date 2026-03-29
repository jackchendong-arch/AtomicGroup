const path = require('node:path');

const STANDALONE_PAGE_MARKER_PATTERN = /^[-–—\s]*\d+\s+of\s+\d+\s*[-–—\s]*$/i;
const PAGE_OF_PATTERN = /^page\s+\d+\s+of\s+\d+$/i;
const OPAQUE_PDF_ARTIFACT_PATTERN = /^(?:~+|(?=.*\d)(?=.*[A-Za-z])(?=.*[_~-])[A-Za-z0-9_~-]{20,})$/;
const DECORATION_ONLY_PATTERN = /^[\s\-–—_=~*•·•▪●○◦]{3,}$/;
const BULLET_PREFIX_PATTERN = /^\s*[•●◦▪■○*\-–—]+\s+/;
const YEAR_RANGE_PATTERN = /(?:19|20)\d{2}(?:[./-]\d{1,2})?\s*(?:–|-|—|to|至)\s*(?:present|current|now|(?:19|20)\d{2})(?:[./-]\d{1,2})?/i;
const DEGREE_HINT_PATTERN = /\b(?:bachelor|master|msc|mba|phd|bsc|ma|ba|degree)\b|(?:本科|硕士|博士|学士|研究生)/i;
const EDUCATION_ORG_HINT_PATTERN = /\b(?:university|college|school|institute)\b|(?:大学|学院|研究所)/i;
const EMPLOYMENT_TITLE_HINT_PATTERN = /\b(?:engineer|developer|manager|consultant|analyst|architect|designer|lead|director)\b|(?:工程师|经理|顾问|开发|架构师|设计师|主任)/i;
const COMPANY_HINT_PATTERN = /\b(?:ltd|limited|inc|corp|company|technologies|technology|bank|group|studio)\b|(?:公司|科技|信息|银行|集团|工作室)/i;
const PROJECT_HINT_PATTERN = /\b(?:project|platform|system|engine|aggregator|app|bot)\b|(?:项目|系统|平台|应用|引擎)/i;
const TECH_STACK_HINT_PATTERN = /(?:tech stack|使用技术)\s*[:：]/i;
const REQUIREMENT_HINT_PATTERN = /\b(?:requirements?|qualifications?|must have|required)\b|(?:任职要求|岗位要求)/i;
const RESPONSIBILITY_HINT_PATTERN = /\b(?:responsibilities?|duties)\b|(?:职责|岗位职责)/i;

const SECTION_LABEL_BY_KEY = {
  overview: 'Overview',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  requirements: 'Requirements',
  responsibilities: 'Responsibilities'
};

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

function defaultSectionLabel(sectionKey) {
  return SECTION_LABEL_BY_KEY[sectionKey] || 'Overview';
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

function looksLikeEducationParagraph(lines) {
  const paragraphText = lines.join(' ');

  if (!paragraphText) {
    return false;
  }

  return (
    (hasDateRangeHint(paragraphText) && (DEGREE_HINT_PATTERN.test(paragraphText) || EDUCATION_ORG_HINT_PATTERN.test(paragraphText))) ||
    (DEGREE_HINT_PATTERN.test(paragraphText) && EDUCATION_ORG_HINT_PATTERN.test(paragraphText))
  );
}

function hasDateRangeHint(value) {
  const normalized = cleanLine(value);

  if (!normalized) {
    return false;
  }

  return YEAR_RANGE_PATTERN.test(normalized) ||
    /(?:19|20)\d{2}.*(?:–|-|—|to|至).*?(?:present|current|now|(?:19|20)\d{2})/i.test(normalized);
}

function looksLikeEmploymentParagraph(lines) {
  const paragraphText = lines.join(' ');
  const firstLine = lines[0] || '';
  const secondLine = lines[1] || '';

  if (!paragraphText) {
    return false;
  }

  return (
    (hasDateRangeHint(paragraphText) && (COMPANY_HINT_PATTERN.test(paragraphText) || EMPLOYMENT_TITLE_HINT_PATTERN.test(paragraphText))) ||
    (firstLine.includes('|') && hasDateRangeHint(firstLine) && (COMPANY_HINT_PATTERN.test(firstLine) || EMPLOYMENT_TITLE_HINT_PATTERN.test(firstLine))) ||
    ((COMPANY_HINT_PATTERN.test(firstLine) || EMPLOYMENT_TITLE_HINT_PATTERN.test(firstLine)) && hasDateRangeHint(secondLine))
  );
}

function looksLikeProjectParagraph(lines) {
  const paragraphText = lines.join(' ');
  const firstLine = lines[0] || '';

  if (!paragraphText) {
    return false;
  }

  return (
    TECH_STACK_HINT_PATTERN.test(paragraphText) ||
    (PROJECT_HINT_PATTERN.test(firstLine) && !looksLikeEducationParagraph(lines) && !looksLikeEmploymentParagraph(lines)) ||
    (hasDateRangeHint(firstLine) && PROJECT_HINT_PATTERN.test(paragraphText))
  );
}

function looksLikeRequirementsParagraph(lines) {
  const paragraphText = lines.join(' ');
  return REQUIREMENT_HINT_PATTERN.test(paragraphText) || lines.some((line) => line.startsWith('- ') && /must|experience|required|qualification/i.test(line));
}

function looksLikeResponsibilitiesParagraph(lines) {
  const paragraphText = lines.join(' ');
  return RESPONSIBILITY_HINT_PATTERN.test(paragraphText) || lines.some((line) => line.startsWith('- ') && /responsib|duty|design|build|lead/i.test(line));
}

function inferStructuralSection(lines, documentType) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  if (documentType === 'cv') {
    if (looksLikeEducationParagraph(lines)) {
      return {
        sectionKey: 'education',
        sectionLabel: defaultSectionLabel('education'),
        reason: 'structural_pattern',
        confidence: 'medium'
      };
    }

    if (looksLikeEmploymentParagraph(lines)) {
      return {
        sectionKey: 'experience',
        sectionLabel: defaultSectionLabel('experience'),
        reason: 'structural_pattern',
        confidence: 'medium'
      };
    }

    if (looksLikeProjectParagraph(lines)) {
      return {
        sectionKey: 'projects',
        sectionLabel: defaultSectionLabel('projects'),
        reason: 'structural_pattern',
        confidence: 'medium'
      };
    }
  }

  if (documentType === 'jd') {
    if (looksLikeRequirementsParagraph(lines)) {
      return {
        sectionKey: 'requirements',
        sectionLabel: defaultSectionLabel('requirements'),
        reason: 'structural_pattern',
        confidence: 'medium'
      };
    }

    if (looksLikeResponsibilitiesParagraph(lines)) {
      return {
        sectionKey: 'responsibilities',
        sectionLabel: defaultSectionLabel('responsibilities'),
        reason: 'structural_pattern',
        confidence: 'medium'
      };
    }
  }

  return null;
}

function shouldMergeWithPreviousBullet(previousLine, currentLine, sectionKey) {
  if (!['experience', 'projects', 'requirements', 'responsibilities'].includes(sectionKey)) {
    return false;
  }

  if (!String(previousLine || '').startsWith('- ')) {
    return false;
  }

  if (String(currentLine || '').startsWith('- ')) {
    return false;
  }

  if (isHeadingParagraph(currentLine)) {
    return false;
  }

  return /^[a-z(]/.test(String(currentLine || '').trim());
}

function mergeSectionAwareContinuations(linePairs, {
  sectionKey,
  documentType,
  paragraphIndex,
  cleaningManifest
}) {
  const merged = [];

  linePairs.forEach((pair, lineIndex) => {
    const previous = merged[merged.length - 1];

    if (previous && shouldMergeWithPreviousBullet(previous.normalized, pair.normalized, sectionKey)) {
      const mergedNormalized = `${previous.normalized} ${pair.normalized}`.trim();
      const mergedOriginal = `${previous.original} ${pair.original}`.trim();

      cleaningManifest.push(createCleaningManifestEntry({
        ruleId: 'normalize_wrapped_bullet_continuation',
        action: 'normalize',
        documentType,
        paragraphIndex,
        lineIndex,
        before: pair.original,
        after: mergedNormalized
      }));

      previous.normalized = mergedNormalized;
      previous.original = mergedOriginal;
      previous.actions = [...new Set([...previous.actions, 'normalize_wrapped_bullet_continuation'])];
      return;
    }

    merged.push({
      ...pair
    });
  });

  return merged;
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
  let currentClassificationConfidence = 'low';

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
    const normalizedParagraph = normalizedLines.join('\n');

    if (isHeadingParagraph(normalizedParagraph)) {
      currentSectionLabel = normalizedLines[0];
      currentSectionKey = resolveSectionKey(currentSectionLabel, currentSectionKey);
      currentClassificationReason = 'explicit_heading';
      currentClassificationConfidence = 'high';
      return;
    }

    let workingLinePairs = normalizedLinePairs;

    if (normalizedLines.length > 1 && isHeadingParagraph(normalizedLines[0])) {
      currentSectionLabel = normalizedLines[0];
      currentSectionKey = resolveSectionKey(currentSectionLabel, currentSectionKey);
      currentClassificationReason = 'explicit_heading';
      currentClassificationConfidence = 'high';
      workingLinePairs = normalizedLinePairs.slice(1);
    }

    let blockSectionKey = currentSectionKey;
    let blockSectionLabel = currentSectionLabel;
    let blockClassificationReason = currentClassificationReason;
    let blockClassificationConfidence = currentClassificationConfidence;
    const structuralSection = inferStructuralSection(
      workingLinePairs.map((entry) => entry.normalized),
      documentType
    );

    if (structuralSection && !(currentClassificationReason === 'explicit_heading' && structuralSection.sectionKey === currentSectionKey)) {
      blockSectionKey = structuralSection.sectionKey;
      blockSectionLabel = structuralSection.sectionLabel;
      blockClassificationReason = structuralSection.reason;
      blockClassificationConfidence = structuralSection.confidence;
      currentSectionKey = blockSectionKey;
      currentSectionLabel = blockSectionLabel;
      currentClassificationReason = blockClassificationReason;
      currentClassificationConfidence = blockClassificationConfidence;
    } else if (currentClassificationReason !== 'default_overview') {
      blockClassificationReason = 'inherited_context';
      blockClassificationConfidence = 'medium';
    }

    workingLinePairs = mergeSectionAwareContinuations(workingLinePairs, {
      sectionKey: blockSectionKey,
      documentType,
      paragraphIndex,
      cleaningManifest
    });

    const blockOriginal = workingLinePairs.map((entry) => entry.original).join('\n').trim();
    const blockNormalized = workingLinePairs.map((entry) => entry.normalized).join('\n').trim();

    if (!blockNormalized) {
      return;
    }

    normalizedBlocks.push({
      blockId: createBlockId(documentType, normalizedBlocks.length),
      documentType,
      documentLabel: label,
      sourcePath,
      sourceName: sourcePath ? path.basename(sourcePath) : label,
      sectionKey: blockSectionKey,
      sectionLabel: blockSectionLabel,
      classificationReason: blockClassificationReason,
      classificationConfidence: blockClassificationConfidence,
      order: normalizedBlocks.length,
      textOriginal: blockOriginal,
      textNormalized: blockNormalized,
      cleaningActions: [...new Set(workingLinePairs.flatMap((entry) => entry.actions))],
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

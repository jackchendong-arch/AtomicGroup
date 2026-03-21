const path = require('node:path');

const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'being', 'by', 'can', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'his', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or',
  'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was',
  'were', 'will', 'with', 'you', 'your'
]);

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

const DEFAULT_LIMITS = {
  cv: 8,
  jd: 6,
  guidance: 1
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

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ')
    .split(/\s+/)
    .flatMap((token) => {
      if (!token) {
        return [];
      }

      if (/[\u4e00-\u9fff]/.test(token)) {
        const characters = [...token];

        if (characters.length <= 1) {
          return characters;
        }

        const grams = [];

        for (let index = 0; index < characters.length - 1; index += 1) {
          grams.push(`${characters[index]}${characters[index + 1]}`);
        }

        return grams;
      }

      return [token];
    })
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function uniqueTokens(text) {
  return [...new Set(tokenize(text))];
}

function buildManifestPreview(text, maxLength = 180) {
  const normalized = cleanLine(text);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
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

  return /^[-–—\s]*\d+\s+of\s+\d+\s*[-–—\s]*$/i.test(normalized) ||
    /^page\s+\d+\s+of\s+\d+$/i.test(normalized);
}

function stripArtifactLines(lines) {
  return lines.filter((line) => !isStandalonePageMarker(line));
}

function resolveSectionKey(heading, fallback = 'general') {
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

function createBlockId(documentType, order) {
  return `${documentType}-${order + 1}`;
}

function buildDocumentSourceBlocks(documentType, label, text, sourcePath = '') {
  const paragraphs = splitParagraphs(text);
  const blocks = [];
  let currentSectionKey = 'overview';
  let currentSectionLabel = 'Overview';

  paragraphs.forEach((paragraph) => {
    const lines = paragraph.split('\n').map((line) => cleanLine(line)).filter(Boolean);

    if (lines.length === 0) {
      return;
    }

    if (isHeadingParagraph(paragraph)) {
      currentSectionLabel = lines[0];
      currentSectionKey = resolveSectionKey(currentSectionLabel, currentSectionKey);
      return;
    }

    if (lines.length > 1 && isHeadingParagraph(lines[0])) {
      currentSectionLabel = lines[0];
      currentSectionKey = resolveSectionKey(currentSectionLabel, currentSectionKey);
      lines.shift();
    }

    const contentLines = stripArtifactLines(lines);
    const blockText = contentLines.join('\n').trim();

    if (!blockText) {
      return;
    }

    blocks.push({
      blockId: createBlockId(documentType, blocks.length),
      documentType,
      documentLabel: label,
      sourcePath,
      sourceName: sourcePath ? path.basename(sourcePath) : label,
      sectionKey: currentSectionKey,
      sectionLabel: currentSectionLabel,
      order: blocks.length,
      text: blockText,
      tokenCount: uniqueTokens(blockText).length
    });
  });

  if (blocks.length === 0 && cleanLine(text)) {
    blocks.push({
      blockId: createBlockId(documentType, 0),
      documentType,
      documentLabel: label,
      sourcePath,
      sourceName: sourcePath ? path.basename(sourcePath) : label,
      sectionKey: 'overview',
      sectionLabel: 'Overview',
      order: 0,
      text: cleanLine(text),
      tokenCount: uniqueTokens(text).length
    });
  }

  return {
    documentType,
    label,
    sourcePath,
    blocks
  };
}

function buildWorkspaceSourceModel({
  cvDocument,
  jdDocument,
  templateGuidance = null
}) {
  const documents = [];

  if (cvDocument?.text) {
    documents.push(buildDocumentSourceBlocks(
      'cv',
      'Candidate CV',
      cvDocument.text,
      cvDocument.file?.path || ''
    ));
  }

  if (jdDocument?.text) {
    documents.push(buildDocumentSourceBlocks(
      'jd',
      'Job Description',
      jdDocument.text,
      jdDocument.file?.path || ''
    ));
  }

  if (templateGuidance?.content) {
    documents.push(buildDocumentSourceBlocks(
      'guidance',
      templateGuidance.label || 'Template Guidance',
      templateGuidance.content,
      templateGuidance.sourcePath || ''
    ));
  }

  return {
    documents
  };
}

function scoreBlock(block, queryTokens, preferredSectionKeys = []) {
  const blockTokens = uniqueTokens(block.text);
  const overlapCount = blockTokens.filter((token) => queryTokens.includes(token)).length;
  const overlapScore = overlapCount / Math.max(queryTokens.length, 1);
  const preferredSectionBoost = preferredSectionKeys.includes(block.sectionKey) ? 0.25 : 0;
  const leadBlockBoost = block.order === 0 ? 0.1 : 0;

  return overlapScore + preferredSectionBoost + leadBlockBoost;
}

function selectDocumentBlocks(document, {
  queryText,
  limit,
  preferredSectionKeys = [],
  includeLeadBlock = true
}) {
  if (!document || document.blocks.length === 0) {
    return [];
  }

  const queryTokens = uniqueTokens(queryText);
  const selected = [];
  const selectedIds = new Set();

  if (includeLeadBlock) {
    const leadBlock = document.blocks[0];

    if (leadBlock) {
      selected.push({
        ...leadBlock,
        score: 1
      });
      selectedIds.add(leadBlock.blockId);
    }
  }

  const scoredBlocks = document.blocks
    .filter((block) => !selectedIds.has(block.blockId))
    .map((block) => ({
      ...block,
      score: scoreBlock(block, queryTokens, preferredSectionKeys)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.order - right.order;
    });

  for (const block of scoredBlocks) {
    if (selected.length >= limit) {
      break;
    }

    if (block.score <= 0 && selected.length > 0) {
      continue;
    }

    selected.push(block);
    selectedIds.add(block.blockId);
  }

  if (selected.length < Math.min(limit, document.blocks.length)) {
    for (const block of document.blocks) {
      if (selected.length >= limit) {
        break;
      }

      if (selectedIds.has(block.blockId)) {
        continue;
      }

      selected.push({
        ...block,
        score: 0
      });
      selectedIds.add(block.blockId);
    }
  }

  return selected.sort((left, right) => left.order - right.order);
}

function selectWorkspaceSourceBlocks(sourceModel, {
  queryText,
  limits = DEFAULT_LIMITS,
  preferredSectionKeysByDocumentType = {}
}) {
  const documents = Array.isArray(sourceModel?.documents) ? sourceModel.documents : [];
  const selectionByDocumentType = {};
  const retrievalManifest = [];

  for (const document of documents) {
    const selectedBlocks = selectDocumentBlocks(document, {
      queryText,
      limit: limits[document.documentType] || DEFAULT_LIMITS[document.documentType] || 4,
      preferredSectionKeys: preferredSectionKeysByDocumentType[document.documentType] || [],
      includeLeadBlock: document.documentType !== 'guidance'
    });

    selectionByDocumentType[document.documentType] = selectedBlocks;
    selectedBlocks.forEach((block) => {
      retrievalManifest.push({
        blockId: block.blockId,
        documentType: block.documentType,
        documentLabel: block.documentLabel,
        sourceName: block.sourceName,
        sectionKey: block.sectionKey,
        sectionLabel: block.sectionLabel,
        preview: buildManifestPreview(block.text),
        order: block.order,
        score: Number(block.score.toFixed(4))
      });
    });
  }

  return {
    selectionByDocumentType,
    retrievalManifest
  };
}

function renderSourceBlocksContext(blocks = []) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return '(no source blocks selected)';
  }

  return blocks
    .map((block) => [
      `[${block.blockId}] ${block.documentLabel} · ${block.sectionLabel}`,
      block.text
    ].join('\n'))
    .join('\n\n');
}

function buildWorkspaceRetrievalQuery({
  candidateName,
  roleTitle,
  requirements = [],
  summaryHeadingHints = []
}) {
  return [
    cleanLine(candidateName),
    cleanLine(roleTitle),
    ...requirements.map((entry) => cleanLine(entry)),
    ...summaryHeadingHints.map((entry) => cleanLine(entry))
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  buildWorkspaceRetrievalQuery,
  buildWorkspaceSourceModel,
  renderSourceBlocksContext,
  selectWorkspaceSourceBlocks
};

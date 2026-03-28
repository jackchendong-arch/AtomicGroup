const { buildNormalizedSourceDocument } = require('./source-normalization-service');

const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'being', 'by', 'can', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'his', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or',
  'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was',
  'were', 'will', 'with', 'you', 'your'
]);

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

function buildDocumentSourceBlocks(documentType, label, text, sourcePath = '') {
  const normalizedDocument = buildNormalizedSourceDocument({
    documentType,
    label,
    text,
    sourcePath
  });
  const blocks = normalizedDocument.normalizedBlocks.map((block) => ({
    blockId: block.blockId,
    documentType: block.documentType,
    documentLabel: block.documentLabel,
    sourcePath: block.sourcePath,
    sourceName: block.sourceName,
    sectionKey: block.sectionKey,
    sectionLabel: block.sectionLabel,
    classificationReason: block.classificationReason,
    classificationConfidence: block.classificationConfidence,
    cleaningActions: block.cleaningActions,
    sourceRefs: block.sourceRefs,
    order: block.order,
    text: block.textNormalized,
    textOriginal: block.textOriginal,
    tokenCount: uniqueTokens(block.textNormalized).length
  }));

  return {
    documentType,
    label,
    sourcePath,
    rawSource: normalizedDocument.rawSource,
    cleaningManifest: normalizedDocument.cleaningManifest,
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

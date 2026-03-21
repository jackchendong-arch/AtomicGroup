const fs = require('node:fs');
const path = require('node:path');
const {
  isChineseOutputLanguage,
  normalizeOutputLanguage
} = require('./output-language-service');
const {
  buildWorkspaceRetrievalQuery,
  buildWorkspaceSourceModel,
  renderSourceBlocksContext,
  selectWorkspaceSourceBlocks
} = require('./workspace-source-service');

const DEFAULT_TEMPLATE_LABEL = 'Default Recruiter Profile Template';
const DEFAULT_TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'default-summary-template.md');
const DEFAULT_TEMPLATE_ZH_LABEL = 'Default Recruiter Profile Template · Chinese';
const DEFAULT_TEMPLATE_ZH_PATH = path.join(__dirname, '..', 'templates', 'default-summary-template.zh.md');
const DEFAULT_TEMPLATE = fs.readFileSync(DEFAULT_TEMPLATE_PATH, 'utf8').trim();
const DEFAULT_TEMPLATE_ZH = fs.readFileSync(DEFAULT_TEMPLATE_ZH_PATH, 'utf8').trim();
const ANONYMOUS_CANDIDATE_LABEL = 'Anonymous Candidate';

const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'being', 'by', 'can', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'his', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or',
  'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was',
  'were', 'will', 'with', 'you', 'your'
]);

const GENERIC_CANDIDATE_FILE_NAMES = new Set([
  'candidate',
  'candidates',
  'candidate cv',
  'candidate resume',
  'candidate profile',
  'cv',
  'profile',
  'resume',
  'resumes',
  'curriculum vitae'
]);

const GENERIC_ROLE_HEADINGS = new Set([
  'about the job',
  'about this job',
  'job description',
  'job summary',
  'overview',
  'responsibilities',
  'responsibility',
  'requirements',
  'about the role',
  'about us',
  'about company',
  'about the company',
  '职位描述',
  '岗位描述',
  '岗位职责',
  '任职要求',
  '岗位要求',
  '关于职位',
  '关于岗位',
  '职位',
  '职责'
]);

function getDefaultTemplateForLanguage(outputLanguage = 'en') {
  return isChineseOutputLanguage(outputLanguage) ? DEFAULT_TEMPLATE_ZH : DEFAULT_TEMPLATE;
}

function getDefaultTemplateLabel(outputLanguage = 'en') {
  return isChineseOutputLanguage(outputLanguage) ? DEFAULT_TEMPLATE_ZH_LABEL : DEFAULT_TEMPLATE_LABEL;
}

function cleanLine(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function fillTemplate(template, replacements) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => replacements[key] ?? '');
}

function stripMarkdownEmphasis(text) {
  return String(text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1');
}

function splitLines(text) {
  return text
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map(cleanLine)
    .filter((line) => line.length > 0);
}

function tokenize(text) {
  return text
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

function normalizeLooseKey(value) {
  return cleanLine(String(value || '').toLowerCase().replace(/[_-]+/g, ' '));
}

function extractCandidateName(cvText, fileName) {
  const lines = splitLines(cvText);

  for (const line of lines.slice(0, 10)) {
    const labeledMatch = line.match(/^(?:name|candidate name|姓名|候选人姓名)\s*[:：]\s*(.+)$/i);

    if (
      labeledMatch?.[1] &&
      !labeledMatch[1].includes('@') &&
      !/\d{5,}/.test(labeledMatch[1])
    ) {
      return cleanLine(labeledMatch[1]);
    }
  }

  for (const line of lines.slice(0, 6)) {
    if (
      /^[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){1,4}(?: \([A-Za-z][A-Za-z\s'-]*\))?$/.test(line) &&
      !line.includes('@') &&
      !/\d/.test(line)
    ) {
      return line;
    }
  }

  for (const line of lines.slice(0, 6)) {
    if (
      /^[\u4e00-\u9fff·]{2,12}$/.test(line) &&
      !line.includes('@') &&
      !/\d/.test(line)
    ) {
      return line;
    }
  }

  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const words = baseName.split(/\s+/).filter(Boolean);
  const normalizedBaseName = normalizeLooseKey(baseName);

  if (words.length > 0 && !GENERIC_CANDIDATE_FILE_NAMES.has(normalizedBaseName)) {
    if (words.length === 1 && /[\u4e00-\u9fff]/.test(words[0])) {
      return words[0];
    }

    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return 'Candidate';
}

function extractRoleTitle(jdText, fileName) {
  const lines = splitLines(jdText);
  const labeled = lines.find((line) => /^(job title|role|position|职位|岗位|职位名称|岗位名称|应聘职位)\s*[:：]/i.test(line));

  if (labeled) {
    const labeledValue = labeled.split(/[:：]/).slice(1).join(':').trim();

    if (labeledValue && !GENERIC_ROLE_HEADINGS.has(normalizeLooseKey(labeledValue))) {
      return labeledValue;
    }
  }

  const firstLongLine = lines.find((line) => {
    const normalizedLine = normalizeLooseKey(line);

      return (
        line.length >= 5 &&
        line.length <= 120 &&
        !GENERIC_ROLE_HEADINGS.has(normalizedLine) &&
        !/^(company|organization|client|employer|hiring manager|公司|客户|招聘经理)\s*[:：]/i.test(line) &&
        !/^[-*•]\s+/.test(line)
      );
  });

  if (firstLongLine) {
    return firstLongLine;
  }

  const fallbackName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  return GENERIC_ROLE_HEADINGS.has(normalizeLooseKey(fallbackName)) ? 'Role' : fallbackName;
}

function extractRequirements(jdText) {
  const lines = splitLines(jdText);
  const candidateLines = lines.filter((line) => {
    const wordCount = line.split(/\s+/).length;
    return (
      wordCount >= 4 &&
      wordCount <= 20 &&
      (line.startsWith('-') ||
        line.startsWith('*') ||
        line.startsWith('•') ||
        /\b(experience|ability|knowledge|build|lead|manage|design|develop|partner|communicate|deliver)\b/i.test(line) ||
        /(经验|能力|熟悉|负责|要求|领导|管理|设计|开发|交付|沟通|协调)/.test(line))
    );
  });

  const requirements = [];
  const seen = new Set();

  for (const line of candidateLines) {
    const normalized = cleanLine(line.replace(/^[-*]\s*/, ''));

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    requirements.push(normalized);
    seen.add(key);

    if (requirements.length === 5) {
      return requirements;
    }
  }

  const sentences = splitSentences(jdText);

  for (const sentence of sentences) {
    const normalized = cleanLine(sentence);
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    requirements.push(normalized);
    seen.add(key);

    if (requirements.length === 5) {
      break;
    }
  }

  return requirements;
}

function scoreSentence(requirement, sentence) {
  const requirementTokens = uniqueTokens(requirement);
  const sentenceTokens = new Set(tokenize(sentence));

  if (requirementTokens.length === 0 || sentenceTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of requirementTokens) {
    if (sentenceTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / requirementTokens.length;
}

function findBestEvidence(requirements, cvText) {
  const sentences = splitSentences(cvText).filter((sentence) => sentence.length > 30);

  return requirements.map((requirement) => {
    let bestSentence = '';
    let bestScore = 0;

    for (const sentence of sentences) {
      const score = scoreSentence(requirement, sentence);

      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }

    return {
      requirement,
      evidence: bestSentence,
      score: bestScore
    };
  });
}

function uniqueEvidenceLines(matches, minimumScore) {
  const lines = [];
  const seen = new Set();

  for (const match of matches) {
    if (!match.evidence || match.score < minimumScore) {
      continue;
    }

    const key = match.evidence.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    lines.push(match.evidence);
    seen.add(key);
  }

  return lines;
}

function buildFitSummary(candidateName, roleTitle, strengths, gaps, outputLanguage = 'en') {
  if (isChineseOutputLanguage(outputLanguage)) {
    const summary = [];

    if (strengths.length > 0) {
      summary.push(`${candidateName}基于简历与职位描述的直接匹配，整体上与${roleTitle}岗位具有较强相关性。`);
      summary.push(`最突出的匹配主题包括${strengths.slice(0, 3).map((match) => `“${match.requirement}”`).join('、')}。`);
    } else {
      summary.push(`${candidateName}与${roleTitle}岗位可能存在一定契合度，但当前可直接佐证的证据仍有限，建议进一步审阅。`);
    }

    if (gaps.length > 0) {
      summary.push(`部分岗位要求在当前简历中尚未被清晰证明，尤其是${gaps.slice(0, 2).map((gap) => `“${gap.requirement}”`).join('和')}。`);
    }

    return summary.join('');
  }

  const summary = [];

  if (strengths.length > 0) {
    summary.push(
      `${candidateName} appears to have relevant experience for the ${roleTitle} role based on direct overlap between the CV and the job description.`
    );
    summary.push(
      `The strongest matched themes are ${strengths
        .slice(0, 3)
        .map((match) => `"${match.requirement}"`)
        .join(', ')}.`
    );
  } else {
    summary.push(
      `${candidateName} may have partial alignment with the ${roleTitle} role, but the current evidence is limited and should be reviewed carefully.`
    );
  }

  if (gaps.length > 0) {
    summary.push(
      `Some role requirements are not clearly evidenced in the CV yet, especially ${gaps
        .slice(0, 2)
        .map((gap) => `"${gap.requirement}"`)
        .join(' and ')}.`
    );
  }

  return summary.join(' ');
}

function buildRecommendedNextStep(strengths, gaps, outputLanguage = 'en') {
  if (isChineseOutputLanguage(outputLanguage)) {
    if (strengths.length >= 3 && gaps.length <= 1) {
      return '建议推进至顾问复核环节，并围绕当前职责范围、团队匹配度及岗位背景补充跟进问题。';
    }

    if (strengths.length >= 1) {
      return '建议先进行顾问电话筛选，重点核实最强匹配经验，并补足仍缺失的证据点后再与用人经理分享。';
    }

    return '建议先进一步由顾问复核后再决定是否分享，当前简历对岗位关键要求的直接证据仍不足。';
  }

  if (strengths.length >= 3 && gaps.length <= 1) {
    return 'Recommend moving this candidate into recruiter review with follow-up questions focused on current scope, team fit, and role context.';
  }

  if (strengths.length >= 1) {
    return 'Recommend a recruiter screen to validate the strongest matched experience areas and close the remaining evidence gaps before manager sharing.';
  }

  return 'Recommend further recruiter review before sharing, as the current CV does not yet provide enough direct evidence against the role requirements.';
}

function buildSummaryPrompt({ candidateName, roleTitle, cvText, jdText, outputMode = 'named', outputLanguage = 'en' }) {
  return buildSummaryPromptWithTemplateGuidance({
    candidateName,
    roleTitle,
    cvText,
    jdText,
    templateGuidance: null,
    outputMode,
    outputLanguage
  });
}

function resolveTemplateGuidance(templateGuidance, outputLanguage = 'en') {
  const defaultLabel = getDefaultTemplateLabel(outputLanguage);
  const defaultTemplate = getDefaultTemplateForLanguage(outputLanguage);

  if (!templateGuidance || templateGuidance.usesDefaultTemplate === true) {
    return {
      label: defaultLabel,
      content: defaultTemplate,
      usesDefaultTemplate: true
    };
  }

  if (!templateGuidance.content || !templateGuidance.label) {
    return {
      label: defaultLabel,
      content: defaultTemplate,
      usesDefaultTemplate: true
    };
  }

  return {
    label: templateGuidance.label,
    content: String(templateGuidance.content).trim(),
    usesDefaultTemplate: false
  };
}

function buildSummaryPromptWithTemplateGuidance({
  candidateName,
  roleTitle,
  cvText,
  jdText,
  cvSourceLabel = 'Candidate CV',
  jdSourceLabel = 'Job Description',
  templateGuidance,
  outputMode = 'named',
  outputLanguage = 'en'
}) {
  const resolvedTemplateGuidance = resolveTemplateGuidance(templateGuidance, outputLanguage);
  const normalizedOutputMode = outputMode === 'anonymous' ? 'anonymous' : 'named';
  const modeDescriptor = normalizedOutputMode === 'anonymous' ? 'an anonymous' : 'a named';
  const candidateLabel = normalizedOutputMode === 'anonymous'
    ? ANONYMOUS_CANDIDATE_LABEL
    : candidateName;
  const languageInstruction = isChineseOutputLanguage(outputLanguage)
    ? [
      'Return the completed recruiter summary in Simplified Chinese.',
      'Keep section headings and narrative content in Simplified Chinese.',
      'Preserve candidate names, company names, job titles, and other exact source terms in their original form when appropriate.'
    ]
    : [
      'Return the completed recruiter summary in English.'
    ];

  return [
    `Create ${modeDescriptor} recruiter-ready candidate summary using the ${resolvedTemplateGuidance.usesDefaultTemplate ? 'built-in default template' : 'selected reference template guidance'}.`,
    `Candidate: ${candidateLabel}`,
    `Target role: ${roleTitle}`,
    '',
    'Use only evidence supported by the CV against the JD.',
    'Call out strengths, likely fit, and gaps without overstating certainty.',
    'Return only the completed template and keep the section order unchanged.',
    'Keep the first two label/value entries as single-line fields using the labels shown in the selected template.',
    'Use plain bullets beginning with `- ` where the template expects lists.',
    'Do not add a report title, markdown bold, italics, tables, or decorative formatting.',
    ...languageInstruction,
    ...(normalizedOutputMode === 'anonymous'
      ? [
        `Use \`${ANONYMOUS_CANDIDATE_LABEL}\` only for the single-line Candidate label.`,
        isChineseOutputLanguage(outputLanguage)
          ? 'In narrative sentences, refer to the person as “该候选人” or “候选人” instead of repeating the anonymous label.'
          : 'In narrative sentences, refer to the person as "the candidate" or "this candidate" instead of repeating the anonymous label.',
        'Do not include the candidate’s real name, email, phone number, LinkedIn URL, or exact street address in the output.'
      ]
      : []),
    '',
    resolvedTemplateGuidance.usesDefaultTemplate
      ? 'Template:'
      : `Reference template guidance (${resolvedTemplateGuidance.label}):`,
    resolvedTemplateGuidance.content,
    ...(resolvedTemplateGuidance.usesDefaultTemplate ? [] : [
      '',
      'Return the recruiter summary using the app-required section structure shown below, while grounding section emphasis and phrasing in the selected reference template guidance.',
      '',
      'Required recruiter summary structure:',
      getDefaultTemplateForLanguage(outputLanguage)
    ]),
    '',
    `${cvSourceLabel}:`,
    cvText,
    '',
    `${jdSourceLabel}:`,
    jdText
  ].join('\n');
}

function buildSummaryRequest({
  cvDocument,
  jdDocument,
  systemPrompt,
  templateGuidance = null,
  sourceModel = null,
  outputMode = 'named',
  outputLanguage = 'en'
}) {
  const normalizedOutputLanguage = normalizeOutputLanguage(outputLanguage);
  const candidateName = extractCandidateName(cvDocument.text, cvDocument.file.name);
  const roleTitle = extractRoleTitle(jdDocument.text, jdDocument.file.name);
  const requirements = extractRequirements(jdDocument.text);
  const evidenceMatches = findBestEvidence(requirements, cvDocument.text)
    .filter((match) => match.evidence)
    .slice(0, 5)
    .map((match) => `- Requirement: ${match.requirement}\n  Evidence hint: ${match.evidence}`);
  const resolvedTemplateGuidance = resolveTemplateGuidance(templateGuidance, normalizedOutputLanguage);
  const workspaceSourceModel = sourceModel || buildWorkspaceSourceModel({
    cvDocument,
    jdDocument,
    templateGuidance: resolvedTemplateGuidance
  });
  const sourceSelection = selectWorkspaceSourceBlocks(workspaceSourceModel, {
    queryText: buildWorkspaceRetrievalQuery({
      candidateName,
      roleTitle,
      requirements,
      summaryHeadingHints: ['fit summary', 'relevant experience', 'match against key requirements']
    }),
    limits: {
      cv: 8,
      jd: 6,
      guidance: 1
    },
    preferredSectionKeysByDocumentType: {
      cv: ['overview', 'experience', 'projects', 'skills', 'education'],
      jd: ['overview', 'requirements', 'responsibilities'],
      guidance: ['overview', 'fit', 'experience', 'requirements']
    }
  });
  const cvSourceContext = renderSourceBlocksContext(sourceSelection.selectionByDocumentType.cv);
  const jdSourceContext = renderSourceBlocksContext(sourceSelection.selectionByDocumentType.jd);

  const prompt = [
    buildSummaryPromptWithTemplateGuidance({
      candidateName,
      roleTitle,
      cvText: cvSourceContext,
      jdText: jdSourceContext,
      cvSourceLabel: 'Candidate CV source blocks',
      jdSourceLabel: 'Job Description source blocks',
      templateGuidance: resolvedTemplateGuidance,
      outputMode,
      outputLanguage: normalizedOutputLanguage
    }),
    '',
    'Requirement-to-evidence hints:',
    evidenceMatches.length > 0 ? evidenceMatches.join('\n') : '- No strong evidence hints were extracted automatically.',
    '',
    'Important constraints:',
    ...(outputMode === 'anonymous'
      ? [
        `- Keep the draft anonymous. Use \`${ANONYMOUS_CANDIDATE_LABEL}\` instead of the candidate's real name.`,
        '- Do not include email, phone, LinkedIn URL, or exact street address details in the output.'
      ]
      : [
        '- Use the candidate name when it is supported by the CV.'
      ]),
    '- Keep the output substantive and recruiter-ready. Include enough detail to explain fit clearly without padding.',
    '- If evidence is missing, state it as a gap instead of inventing information.'
  ].join('\n');

  return {
    templateLabel: resolvedTemplateGuidance.label,
    prompt,
    retrievalManifest: sourceSelection.retrievalManifest,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
}

function normalizeGeneratedSummary(summary) {
  const sourceLines = String(summary || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  const normalizedLines = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = cleanLine(stripMarkdownEmphasis(sourceLines[index]));
    const heading = line.replace(/^#+\s*/, '').trim();

    if (!line) {
      if (normalizedLines[normalizedLines.length - 1] !== '') {
        normalizedLines.push('');
      }
      continue;
    }

    if (/^(candidate profile summary|候选人摘要)$/i.test(heading)) {
      continue;
    }

    if (/^candidate$/i.test(heading) || /^target role$/i.test(heading)) {
      let value = '';

      while (index + 1 < sourceLines.length) {
        const nextLine = cleanLine(stripMarkdownEmphasis(sourceLines[index + 1]));
        index += 1;

        if (!nextLine) {
          continue;
        }

        value = nextLine;
        break;
      }

      if (value) {
        normalizedLines.push(`${/^candidate$/i.test(heading) ? 'Candidate' : 'Target Role'}: ${value}`);
      }

      continue;
    }

    if (/^why this candidate may be a fit$/i.test(heading)) {
      normalizedLines.push('## Fit Summary');
      continue;
    }

    normalizedLines.push(line);
  }

  return normalizedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function generateSummaryDraft({ cvDocument, jdDocument, outputLanguage = 'en' }) {
  const candidateName = extractCandidateName(cvDocument.text, cvDocument.file.name);
  const roleTitle = extractRoleTitle(jdDocument.text, jdDocument.file.name);
  const requirements = extractRequirements(jdDocument.text);
  const matches = findBestEvidence(requirements, cvDocument.text);
  const strengths = matches.filter((match) => match.score >= 0.2 && match.evidence).slice(0, 3);
  const concerns = matches.filter((match) => match.score < 0.2).slice(0, 3);
  const experienceLines = uniqueEvidenceLines(matches, 0.18).slice(0, 4);
  const fitSummary = buildFitSummary(candidateName, roleTitle, strengths, concerns, outputLanguage);
  const recommendedNextStep = buildRecommendedNextStep(strengths, concerns, outputLanguage);
  const prompt = buildSummaryPrompt({
    candidateName,
    roleTitle,
    cvText: cvDocument.text,
    jdText: jdDocument.text,
    outputLanguage
  });

  const matchLines = strengths.length > 0
    ? strengths.map((match) => `- ${match.requirement} -> ${match.evidence}`)
    : [isChineseOutputLanguage(outputLanguage)
      ? '- 当前简历文本中尚未自动确认出强匹配的岗位要求。'
      : '- No strong role match was automatically confirmed from the current CV text.'];

  const concernLines = concerns.length > 0
    ? concerns.map((match) => `- ${match.requirement}`)
    : [isChineseOutputLanguage(outputLanguage)
      ? '- 当前启发式比对中未发现明显缺口。'
      : '- No major gaps were detected from the current heuristic comparison.'];

  const relevantExperienceLines = experienceLines.length > 0
    ? experienceLines.map((line) => `- ${line}`)
    : [isChineseOutputLanguage(outputLanguage)
      ? '- 当前简历文本中暂未能可靠提取到相关经验。'
      : '- Relevant experience could not be confidently extracted from the current CV text.'];

  const summary = normalizeGeneratedSummary(fillTemplate(getDefaultTemplateForLanguage(outputLanguage), {
    candidate_name: candidateName,
    role_title: roleTitle,
    fit_summary: fitSummary,
    relevant_experience: relevantExperienceLines.join('\n'),
    match_requirements: matchLines.join('\n'),
    potential_concerns: concernLines.join('\n'),
    recommended_next_step: recommendedNextStep
  }));

  return {
    templateLabel: getDefaultTemplateLabel(outputLanguage),
    prompt,
    summary,
    strengths,
    concerns
  };
}

module.exports = {
  DEFAULT_TEMPLATE,
  DEFAULT_TEMPLATE_PATH,
  DEFAULT_TEMPLATE_ZH_PATH,
  DEFAULT_TEMPLATE_LABEL,
  DEFAULT_TEMPLATE_ZH_LABEL,
  buildSummaryRequest,
  buildSummaryPrompt,
  buildSummaryPromptWithTemplateGuidance,
  extractCandidateName,
  extractRequirements,
  extractRoleTitle,
  getDefaultTemplateForLanguage,
  getDefaultTemplateLabel,
  generateSummaryDraft,
  normalizeGeneratedSummary,
  resolveTemplateGuidance
};

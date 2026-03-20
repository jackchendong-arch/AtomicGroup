const { normalizeBriefing } = require('./briefing-service');
const {
  isChineseOutputLanguage,
  normalizeOutputLanguage
} = require('./output-language-service');

function cleanLine(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNonEmptyLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripBulletPrefix(value) {
  return cleanLine(value).replace(/^[-*•–—]\s*/, '');
}

function getLocalizedEmailCopy(outputLanguage = 'en') {
  if (isChineseOutputLanguage(outputLanguage)) {
    return {
      anonymousCandidate: '匿名候选人',
      genericCandidate: '候选人',
      genericRole: '职位简报',
      greeting: '您好，',
      keyPoints: '重点亮点：',
      attachmentLine: '附件为《Hiring Manager Briefing》文档，内含候选人概况、相关经历及支撑性细节，供您审阅。',
      noAttachmentLine: '可根据已审批草稿生成《Hiring Manager Briefing》文档供您审阅。',
      close: '如您希望进一步讨论该候选人，或推进下一步面试流程，欢迎随时联系我。',
      bestRegards: '此致',
      roleConnector: '职位',
      subjectSeparator: '｜',
      recommendVerb: '推荐'
    };
  }

  return {
    anonymousCandidate: 'Anonymous Candidate',
    genericCandidate: 'Candidate',
    genericRole: 'Role Briefing',
    greeting: 'Hi,',
    keyPoints: 'Key points:',
    attachmentLine: 'I have attached the Hiring Manager Briefing document, which summarises the candidate profile, relevant experience, and supporting details for review.',
    noAttachmentLine: 'The Hiring Manager Briefing document can be generated from the approved draft for review.',
    close: 'Please let me know if you would like to discuss the profile further or proceed to the next step.',
    bestRegards: 'Best regards,',
    roleConnector: 'opportunity',
    subjectSeparator: ' | ',
    recommendVerb: 'recommend'
  };
}

function buildFallbackEmailSubject({ briefing, outputMode = 'named', outputLanguage = 'en' }) {
  const normalized = normalizeBriefing(briefing);
  const copy = getLocalizedEmailCopy(outputLanguage);
  const candidateName = cleanLine(normalized.candidate.name) || (outputMode === 'anonymous' ? copy.anonymousCandidate : copy.genericCandidate);
  const roleTitle = cleanLine(normalized.role.title) || copy.genericRole;

  return `${candidateName}${copy.subjectSeparator}${roleTitle}`;
}

function buildFallbackEmailBody({
  summary,
  briefing,
  outputMode = 'named',
  attachmentExpected = false,
  outputLanguage = 'en'
}) {
  const normalized = normalizeBriefing(briefing);
  const copy = getLocalizedEmailCopy(outputLanguage);
  const candidateLabel = outputMode === 'anonymous'
    ? (isChineseOutputLanguage(outputLanguage) ? '该匿名候选人' : 'an anonymized candidate')
    : (cleanLine(normalized.candidate.name) || (isChineseOutputLanguage(outputLanguage) ? '该候选人' : 'this candidate'));
  const roleTitle = cleanLine(normalized.role.title) || 'the role';
  const company = cleanLine(normalized.role.company);
  const fitSummary = cleanLine(normalized.fit_summary);
  const relevantExperience = normalized.relevant_experience
    .map((line) => stripBulletPrefix(line))
    .filter(Boolean)
    .slice(0, 3);
  const approvedSummaryExcerpt = splitNonEmptyLines(summary)
    .filter((line) => !/^candidate\s*:/i.test(line) &&
      !/^target role\s*:/i.test(line) &&
      !/^候选人\s*[：:]/.test(line) &&
      !/^目标职位\s*[：:]/.test(line))
    .map((line) => stripBulletPrefix(line))
    .find(Boolean);
  const greeting = copy.greeting;
  const introduction = isChineseOutputLanguage(outputLanguage)
    ? [
      `我想推荐${candidateLabel}供您考虑${roleTitle}${company ? `（${company}）` : ''}这一职位。`,
      '基于我们的综合评估，该候选人与岗位要求具备较强匹配度，值得您进一步审阅。'
    ]
    : [
      `I would like to recommend ${candidateLabel} for the ${roleTitle}${company ? ` ${copy.roleConnector} at ${company}` : ''}.`,
      'Based on our review, the profile appears to be a strong match for the role and worth your consideration.'
    ];
  const narrative = fitSummary
    ? fitSummary
    : (approvedSummaryExcerpt || (isChineseOutputLanguage(outputLanguage)
      ? '该候选人在相关经验和目标岗位匹配度方面表现出较强可信度。'
      : 'The candidate offers relevant experience and credible alignment with the target mandate.'));
  const attachmentLine = attachmentExpected
    ? copy.attachmentLine
    : copy.noAttachmentLine;
  const close = copy.close;
  const lines = [
    greeting,
    '',
    ...introduction,
    '',
    narrative
  ];

  if (relevantExperience.length > 0) {
    lines.push('', copy.keyPoints);
    relevantExperience.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  lines.push('', attachmentLine, '', close, '', copy.bestRegards);
  return lines.join('\n');
}

function buildMailtoUrl({ subject, body }) {
  const encodeMailtoValue = (value) => encodeURIComponent(String(value || '').replace(/\r?\n/g, '\r\n'));

  return `mailto:?subject=${encodeMailtoValue(subject)}&body=${encodeMailtoValue(body)}`;
}

function buildClipboardFallbackText({ subject, body, attachmentPath = '' }) {
  const lines = [
    `Subject: ${subject}`,
    '',
    body
  ];

  if (attachmentPath) {
    lines.push('', `Attachment path: ${attachmentPath}`);
  }

  return lines.join('\n');
}

function finalizeEmailDraft({ subject, body, attachmentPath = '' }) {
  const cleanSubject = cleanLine(subject);
  const cleanBody = String(body || '').trim();

  if (!cleanSubject || !cleanBody) {
    throw new Error('Email draft subject and body are required.');
  }

  return {
    subject: cleanSubject,
    body: cleanBody,
    attachmentPath,
    mailtoUrl: buildMailtoUrl({ subject: cleanSubject, body: cleanBody }),
    clipboardText: buildClipboardFallbackText({ subject: cleanSubject, body: cleanBody, attachmentPath })
  };
}

function buildFallbackEmailDraft({
  summary,
  briefing,
  outputMode = 'named',
  attachmentPath = '',
  attachmentExpected = false,
  outputLanguage = 'en'
}) {
  return finalizeEmailDraft({
    subject: buildFallbackEmailSubject({ briefing, outputMode, outputLanguage }),
    body: buildFallbackEmailBody({
      summary,
      briefing,
      outputMode,
      attachmentExpected,
      outputLanguage
    }),
    attachmentPath
  });
}

function buildEmailDraftRequest({
  summary,
  briefing,
  outputMode = 'named',
  systemPrompt = '',
  attachmentExpected = false,
  outputLanguage = 'en'
}) {
  const normalizedOutputLanguage = normalizeOutputLanguage(outputLanguage);
  const normalized = normalizeBriefing(briefing);
  const copy = getLocalizedEmailCopy(normalizedOutputLanguage);
  const candidateName = cleanLine(normalized.candidate.name) || (outputMode === 'anonymous' ? copy.anonymousCandidate : copy.genericCandidate);
  const roleTitle = cleanLine(normalized.role.title) || copy.genericRole;
  const company = cleanLine(normalized.role.company);
  const relevantExperience = normalized.relevant_experience
    .map((line) => stripBulletPrefix(line))
    .filter(Boolean)
    .slice(0, 4);
  const fitSummary = cleanLine(normalized.fit_summary);
  const concerns = normalized.potential_concerns
    .map((line) => stripBulletPrefix(line))
    .filter(Boolean)
    .slice(0, 3);
  const prompt = [
    'Draft a professional hiring-manager recommendation email in plain text.',
    `Candidate label: ${candidateName}`,
    `Target role: ${roleTitle}`,
    company ? `Company: ${company}` : 'Company: (not specified)',
    `Output mode: ${outputMode}`,
    `Output language: ${isChineseOutputLanguage(normalizedOutputLanguage) ? 'Simplified Chinese' : 'English'}`,
    attachmentExpected
      ? 'The email should mention that a Hiring Manager Briefing document is attached and explain what it contains.'
      : 'The email should mention that a Hiring Manager Briefing document is available for review.',
    '',
    'Requirements:',
    '- Target audience is the hiring manager.',
    '- Sound professional, business-oriented, neat, and concise.',
    '- Explain the purpose of the email and why the candidate is being recommended.',
    '- Include 2 to 4 concrete fit points when supported.',
    '- Briefly explain the attachment and what the hiring manager should expect to find in it.',
    '- Use plain text only. Do not use markdown, tables, or bullet-heavy recruiter review formatting.',
    '- Do not mention internal workflow terms such as draft, panel, or generation.',
    ...(outputMode === 'anonymous'
      ? [
        '- Keep the email anonymous. Do not reveal the candidate’s real name or direct identifiers.',
        `- Use "${copy.anonymousCandidate}" only when a candidate label is required.`,
        isChineseOutputLanguage(normalizedOutputLanguage)
          ? '- In narrative sentences, prefer “该候选人” or “候选人” so the email reads naturally.'
          : '- In narrative sentences, prefer "the candidate" or "this candidate" so the email reads naturally.'
      ]
      : []),
    '',
    'Return only valid JSON with this shape:',
    JSON.stringify({
      subject: '',
      body: ''
    }, null, 2),
    '',
    'Approved recruiter summary:',
    summary,
    '',
    'Grounded hiring-manager briefing facts:',
    JSON.stringify({
      candidate: {
        name: normalized.candidate.name,
        nationality: normalized.candidate.nationality,
        location: normalized.candidate.location,
        preferred_location: normalized.candidate.preferred_location,
        languages: normalized.candidate.languages
      },
      role: normalized.role,
      fit_summary: fitSummary,
      relevant_experience: relevantExperience,
      potential_concerns: concerns
    }, null, 2)
  ].join('\n');

  return {
    prompt,
    messages: [
      {
        role: 'system',
        content: systemPrompt || 'You write professional hiring-manager recommendation emails in clean, concise plain text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
}

function extractJsonPayload(responseText) {
  const source = String(responseText || '').trim();
  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1);
  }

  return source;
}

function parseEmailDraftResponse(responseText) {
  const jsonPayload = extractJsonPayload(responseText);

  if (!jsonPayload) {
    throw new Error('The LLM did not return an email draft payload.');
  }

  let parsed;

  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(`The LLM did not return valid JSON for the email draft. ${error.message}`);
  }

  const subject = cleanLine(parsed.subject);
  const body = String(parsed.body || '').trim();

  if (!subject) {
    throw new Error('The LLM email draft did not include a subject.');
  }

  if (!body) {
    throw new Error('The LLM email draft did not include a body.');
  }

  return {
    subject,
    body
  };
}

module.exports = {
  buildClipboardFallbackText,
  buildEmailDraftRequest,
  buildFallbackEmailBody,
  buildFallbackEmailDraft,
  buildFallbackEmailSubject,
  buildMailtoUrl,
  finalizeEmailDraft,
  parseEmailDraftResponse
};

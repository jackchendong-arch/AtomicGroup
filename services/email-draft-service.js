const { normalizeBriefing } = require('./briefing-service');

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

function buildFallbackEmailSubject({ briefing, outputMode = 'named' }) {
  const normalized = normalizeBriefing(briefing);
  const candidateName = cleanLine(normalized.candidate.name) || (outputMode === 'anonymous' ? 'Anonymous Candidate' : 'Candidate');
  const roleTitle = cleanLine(normalized.role.title) || 'Role Briefing';

  return `${candidateName} | ${roleTitle}`;
}

function buildFallbackEmailBody({
  summary,
  briefing,
  outputMode = 'named',
  attachmentExpected = false
}) {
  const normalized = normalizeBriefing(briefing);
  const candidateLabel = outputMode === 'anonymous'
    ? 'an anonymized candidate'
    : (cleanLine(normalized.candidate.name) || 'this candidate');
  const roleTitle = cleanLine(normalized.role.title) || 'the role';
  const company = cleanLine(normalized.role.company);
  const fitSummary = cleanLine(normalized.fit_summary);
  const relevantExperience = normalized.relevant_experience
    .map((line) => stripBulletPrefix(line))
    .filter(Boolean)
    .slice(0, 3);
  const approvedSummaryExcerpt = splitNonEmptyLines(summary)
    .filter((line) => !/^candidate\s*:/i.test(line) && !/^target role\s*:/i.test(line))
    .map((line) => stripBulletPrefix(line))
    .find(Boolean);
  const greeting = 'Hi,';
  const introduction = [
    `I would like to recommend ${candidateLabel} for the ${roleTitle}${company ? ` opportunity at ${company}` : ''}.`,
    'Based on our review, the profile appears to be a strong match for the role and worth your consideration.'
  ];
  const narrative = fitSummary
    ? fitSummary
    : (approvedSummaryExcerpt || 'The candidate offers relevant experience and credible alignment with the target mandate.');
  const attachmentLine = attachmentExpected
    ? 'I have attached the Hiring Manager Briefing document, which summarises the candidate profile, relevant experience, and supporting details for review.'
    : 'The Hiring Manager Briefing document can be generated from the approved draft for review.';
  const close = 'Please let me know if you would like to discuss the profile further or proceed to the next step.';
  const lines = [
    greeting,
    '',
    ...introduction,
    '',
    narrative
  ];

  if (relevantExperience.length > 0) {
    lines.push('', 'Key points:');
    relevantExperience.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  lines.push('', attachmentLine, '', close, '', 'Best regards,');
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
  attachmentExpected = false
}) {
  return finalizeEmailDraft({
    subject: buildFallbackEmailSubject({ briefing, outputMode }),
    body: buildFallbackEmailBody({
      summary,
      briefing,
      outputMode,
      attachmentExpected
    }),
    attachmentPath
  });
}

function buildEmailDraftRequest({
  summary,
  briefing,
  outputMode = 'named',
  systemPrompt = '',
  attachmentExpected = false
}) {
  const normalized = normalizeBriefing(briefing);
  const candidateName = cleanLine(normalized.candidate.name) || (outputMode === 'anonymous' ? 'Anonymous Candidate' : 'Candidate');
  const roleTitle = cleanLine(normalized.role.title) || 'Role Briefing';
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
        '- Use "Anonymous Candidate" only when a candidate label is required.',
        '- In narrative sentences, prefer "the candidate" or "this candidate" so the email reads naturally.'
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

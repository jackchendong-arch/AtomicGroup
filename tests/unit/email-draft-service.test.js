const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEmailDraftRequest,
  buildFallbackEmailDraft,
  buildMailtoUrl,
  finalizeEmailDraft,
  parseEmailDraftResponse
} = require('../../services/email-draft-service');

function createBriefing() {
  return {
    candidate: {
      name: 'Alex Wong',
      nationality: 'Singaporean',
      location: 'Hong Kong',
      preferred_location: 'Singapore',
      languages: ['English', 'Cantonese']
    },
    role: {
      title: 'Head of Technology',
      company: 'Atomic Group'
    },
    fit_summary: 'Strong alignment with the target technology leadership mandate.',
    relevant_experience: [
      'Led platform modernization across a regional engineering organization.',
      'Managed business-facing stakeholder relationships in regulated environments.'
    ],
    potential_concerns: [
      'Limited direct insurance-sector delivery experience.'
    ]
  };
}

test('buildEmailDraftRequest creates a hiring-manager-focused prompt with attachment guidance', () => {
  const request = buildEmailDraftRequest({
    summary: 'Approved recruiter summary text',
    briefing: createBriefing(),
    outputMode: 'named',
    attachmentExpected: true
  });

  assert.match(request.prompt, /professional hiring-manager recommendation email/i);
  assert.match(request.prompt, /The email should mention that a Hiring Manager Briefing document is attached/i);
  assert.match(request.prompt, /Return only valid JSON/i);
  assert.match(request.prompt, /Approved recruiter summary:/);
  assert.match(request.prompt, /Grounded hiring-manager briefing facts:/);
});

test('buildEmailDraftRequest adds anonymity constraints for anonymous mode', () => {
  const request = buildEmailDraftRequest({
    summary: 'Approved recruiter summary text',
    briefing: {
      ...createBriefing(),
      candidate: {
        ...createBriefing().candidate,
        name: 'Anonymous Candidate'
      }
    },
    outputMode: 'anonymous',
    attachmentExpected: true
  });

  assert.match(request.prompt, /Keep the email anonymous/i);
  assert.match(request.prompt, /Use "Anonymous Candidate" only when a candidate label is required\./);
  assert.match(request.prompt, /In narrative sentences, prefer "the candidate" or "this candidate"/i);
});

test('parseEmailDraftResponse accepts fenced JSON and returns subject/body', () => {
  const parsed = parseEmailDraftResponse([
    '```json',
    JSON.stringify({
      subject: 'Alex Wong | Head of Technology',
      body: 'Hi,\n\nPlease review the attached briefing.\n\nBest regards,'
    }),
    '```'
  ].join('\n'));

  assert.equal(parsed.subject, 'Alex Wong | Head of Technology');
  assert.match(parsed.body, /^Hi,/);
});

test('buildFallbackEmailDraft creates a readable recommendation email with attachment explanation', () => {
  const draft = buildFallbackEmailDraft({
    summary: 'Approved recruiter summary text',
    briefing: createBriefing(),
    attachmentExpected: true,
    attachmentPath: '/tmp/alex-wong-briefing.docx'
  });

  assert.equal(draft.subject, 'Alex Wong | Head of Technology');
  assert.match(draft.body, /I would like to recommend Alex Wong/);
  assert.match(draft.body, /I have attached the Hiring Manager Briefing document/i);
  assert.match(draft.body, /Key points:/);
  assert.match(draft.clipboardText, /Attachment path: \/tmp\/alex-wong-briefing\.docx/);
});

test('finalizeEmailDraft and buildMailtoUrl encode subject and body safely', () => {
  const draft = finalizeEmailDraft({
    subject: 'Alex Wong | Head of Technology',
    body: 'Hi,\n\nPlease review this candidate.'
  });
  const directUrl = buildMailtoUrl({
    subject: draft.subject,
    body: draft.body
  });

  assert.match(draft.mailtoUrl, /^mailto:\?/);
  assert.match(directUrl, /^mailto:\?/);
  assert.match(draft.mailtoUrl, /subject=Alex%20Wong%20%7C%20Head%20of%20Technology/);
  assert.match(draft.mailtoUrl, /body=Hi%2C%0D%0A%0D%0APlease%20review%20this%20candidate\./);
});

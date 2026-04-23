const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ANONYMOUS_CANDIDATE_LABEL,
  buildAnonymizedGenerationInputs,
  anonymizeDraftOutput
} = require('../../services/anonymization-service');

function createDocuments() {
  return {
    cvDocument: {
      file: {
        name: 'john-doe-cv.pdf'
      },
      text: [
        'John Doe',
        'Email: john.doe@example.com',
        'Phone: +65 9123 4567',
        'LinkedIn: https://www.linkedin.com/in/john-doe',
        'Address: 12 Market Street Singapore',
        'Nationality: Singaporean',
        'Current location: Singapore',
        'Preferred location: Hong Kong',
        'Notice period: 1 month'
      ].join('\n')
    },
    jdDocument: {
      file: {
        name: 'head-of-platform-engineering.pdf'
      },
      text: [
        'Job Title: Head of Platform Engineering',
        'Company: Atomic Group'
      ].join('\n')
    }
  };
}

test('anonymizeDraftOutput masks direct identifiers while keeping grounded profile data', () => {
  const { cvDocument, jdDocument } = createDocuments();

  const result = anonymizeDraftOutput({
    recruiterSummary: [
      'Candidate: John Doe',
      'Target Role: Head of Platform Engineering',
      '',
      '## Fit Summary',
      'John Doe can be contacted at john.doe@example.com or +65 9123 4567.',
      'LinkedIn: https://www.linkedin.com/in/john-doe',
      'Address: 12 Market Street Singapore'
    ].join('\n'),
    briefing: {
      candidate: {
        name: 'John Doe',
        nationality: 'Singaporean',
        location: 'Singapore',
        preferred_location: 'Hong Kong'
      },
      role: {
        title: 'Head of Platform Engineering',
        company: 'Atomic Group'
      },
      fit_summary: 'John Doe is a strong fit.',
      relevant_experience: [
        'John Doe led platform modernization.'
      ],
      employment_history: []
    },
    cvDocument,
    jdDocument
  });

  assert.match(result.summary, /Anonymous Candidate/);
  assert.doesNotMatch(result.summary, /john\.doe@example\.com/i);
  assert.doesNotMatch(result.summary, /\+65 9123 4567/);
  assert.doesNotMatch(result.summary, /linkedin\.com/i);
  assert.doesNotMatch(result.summary, /12 Market Street/i);
  assert.equal(result.briefing.candidate.name, ANONYMOUS_CANDIDATE_LABEL);
  assert.equal(result.briefing.candidate.nationality, 'Singaporean');
  assert.equal(result.briefing.candidate.location, 'Singapore');
  assert.equal(result.briefing.candidate.preferred_location, 'Hong Kong');
  assert.doesNotMatch(result.summary, /Anonymous Candidate can/i);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.modeLabel, 'Anonymous Draft');
});

test('buildAnonymizedGenerationInputs redacts source text for anonymous generation while preserving non-PII evidence', () => {
  const { cvDocument, jdDocument } = createDocuments();
  const result = buildAnonymizedGenerationInputs({ cvDocument, jdDocument });

  assert.equal(result.cvDocument.file.name, 'anonymous-candidate.pdf');
  assert.equal(result.jdDocument.file.name, 'job-description.pdf');
  assert.doesNotMatch(result.cvDocument.text, /John Doe/i);
  assert.doesNotMatch(result.cvDocument.text, /john\.doe@example\.com/i);
  assert.doesNotMatch(result.cvDocument.text, /\+65 9123 4567/);
  assert.match(result.cvDocument.text, /Anonymous Candidate/);
  assert.match(result.cvDocument.text, /Nationality: Singaporean/);
  assert.match(result.cvDocument.text, /Preferred location: Hong Kong/);
});

test('anonymizeDraftOutput also masks common first-name-only variants that appear in derived output', () => {
  const { cvDocument, jdDocument } = createDocuments();

  const result = anonymizeDraftOutput({
    recruiterSummary: [
      'Candidate: John Doe',
      'Target Role: Head of Platform Engineering',
      '',
      '## Fit Summary',
      'John is a strong fit for the role.'
    ].join('\n'),
    briefing: {
      candidate: {
        name: 'John Doe'
      },
      role: {
        title: 'Head of Platform Engineering'
      },
      fit_summary: 'John can lead the platform agenda.',
      relevant_experience: [],
      employment_history: []
    },
    cvDocument,
    jdDocument
  });

  assert.doesNotMatch(result.summary, /\bJohn\b/);
  assert.equal(result.briefing.candidate.name, ANONYMOUS_CANDIDATE_LABEL);
  assert.doesNotMatch(result.briefing.fit_summary, /\bJohn\b/);
  assert.match(result.summary, /The candidate is a strong fit/i);
  assert.match(result.briefing.fit_summary, /the candidate can lead the platform agenda/i);
});

test('anonymizeDraftOutput preserves the anonymous candidate label in Candidate headings with parenthetical duplicates', () => {
  const { cvDocument, jdDocument } = createDocuments();
  cvDocument.file.name = 'shawn-cong-cv.pdf';
  cvDocument.text = [
    'Xiaoshen CONG (Shawn)',
    'Email: shawn.cong@example.com',
    'Current location: Shanghai'
  ].join('\n');

  const result = anonymizeDraftOutput({
    recruiterSummary: [
      'Candidate: Xiaoshen CONG (Shawn)',
      'Target Role: Leadership Talent Acquisition Partner (VP), Technology Center',
      '',
      '## Fit Summary',
      'Xiaoshen CONG (Shawn) appears to be a strong fit.'
    ].join('\n'),
    briefing: {
      candidate: {
        name: 'Xiaoshen CONG (Shawn)',
        location: 'Shanghai'
      },
      role: {
        title: 'Leadership Talent Acquisition Partner (VP), Technology Center'
      },
      fit_summary: 'Xiaoshen CONG (Shawn) appears to be a strong fit.',
      relevant_experience: [],
      employment_history: []
    },
    cvDocument,
    jdDocument
  });

  assert.match(result.summary, /^Candidate: Anonymous Candidate/m);
  assert.doesNotMatch(result.summary, /the candidate \(the candidate\)/i);
  assert.equal(result.briefing.candidate.name, ANONYMOUS_CANDIDATE_LABEL);
});

test('anonymizeDraftOutput strips parenthetical nicknames that survive partial name replacement', () => {
  const { cvDocument, jdDocument } = createDocuments();
  cvDocument.file.name = 'sample-cv-parenthetical.txt';
  cvDocument.text = [
    'Xiaoshen CONG (Shawn)',
    'Email: shawn.cong@example.com'
  ].join('\n');

  const result = anonymizeDraftOutput({
    recruiterSummary: [
      'Candidate: Xiaoshen CONG (Shawn)',
      'Target Role: Senior Product Manager, Recruitment Intelligence',
      '',
      '## Fit Summary',
      'Xiaoshen CONG (Shawn) appears to be a strong fit.'
    ].join('\n'),
    briefing: {
      candidate: {
        name: 'Xiaoshen CONG (Shawn)'
      },
      role: {
        title: 'Senior Product Manager, Recruitment Intelligence'
      },
      fit_summary: 'Xiaoshen CONG (Shawn) appears to be a strong fit.',
      relevant_experience: [],
      employment_history: []
    },
    cvDocument,
    jdDocument
  });

  assert.match(result.summary, /^Candidate: Anonymous Candidate/m);
  assert.doesNotMatch(result.summary, /\(Shawn\)/);
  assert.doesNotMatch(result.summary, /the candidate \(Shawn\)/i);
  assert.equal(result.briefing.candidate.name, ANONYMOUS_CANDIDATE_LABEL);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyTranslatedDraftPayload,
  buildDraftTranslationRepairRequest,
  buildDraftTranslationRequest,
  createTranslatableDraftPayload,
  parseTranslatedDraftResponse
} = require('../../services/draft-translation-service');

test('buildDraftTranslationRequest creates a translation-only prompt for the current draft', () => {
  const request = buildDraftTranslationRequest({
    summary: [
      'Candidate: Jane Doe',
      'Target Role: Head of IT Transformation',
      '',
      '## Fit Summary',
      'Strong transformation leader with deep banking platform delivery experience.'
    ].join('\n'),
    briefing: {
      candidate: {
        name: 'Jane Doe',
        location: 'Hong Kong'
      },
      role: {
        title: 'Head of IT Transformation',
        company: 'Atomic Group'
      },
      fit_summary: 'Strong transformation leader with deep banking platform delivery experience.',
      relevant_experience: ['Led global transformation programmes across markets technology.']
    },
    sourceLanguage: 'en',
    targetLanguage: 'zh'
  });

  assert.match(request.messages[0].content, /translation engine/i);
  assert.match(request.messages[1].content, /This is a translation task only/i);
  assert.match(request.messages[1].content, /from English to Simplified Chinese/i);
  assert.match(request.messages[1].content, /Current translatable draft payload:/i);
  assert.equal(request.payload.role.company, 'Atomic Group');
});

test('buildDraftTranslationRequest adds anonymity-preserving guidance for anonymous output', () => {
  const request = buildDraftTranslationRequest({
    summary: 'Candidate: Anonymous Candidate',
    briefing: {
      candidate: {
        name: 'Anonymous Candidate'
      }
    },
    outputMode: 'anonymous',
    sourceLanguage: 'en',
    targetLanguage: 'zh'
  });

  assert.match(request.messages[1].content, /Keep the draft anonymous/i);
  assert.match(request.messages[1].content, /该候选人|候选人/);
});

test('parseTranslatedDraftResponse accepts fenced JSON and normalizes the translated payload', () => {
  const originalBriefing = {
    candidate: {
      name: 'Jane Doe',
      location: 'Hong Kong'
    },
    role: {
      title: 'Head of IT Transformation',
      company: 'Atomic Group'
    },
    fit_summary: 'Strong transformation leader with deep banking platform delivery experience.',
    relevant_experience: [
      'Led global transformation programmes across markets technology.'
    ],
    employment_history: [
      {
        job_title: 'Director, Global Head of Transformation',
        company_name: 'HSBC',
        start_date: '2021',
        end_date: 'Present',
        responsibilities: [
          'Led enterprise platform modernisation.'
        ],
        evidence_refs: [
          { source: 'cv', section: 'experience' }
        ]
      }
    ]
  };
  const translated = parseTranslatedDraftResponse([
    '```json',
    JSON.stringify({
      summary: [
        'Candidate: Jane Doe',
        'Target Role: Head of IT Transformation',
        '',
        '## Fit Summary',
        '候选人在大型金融服务平台转型方面经验扎实。'
      ].join('\n'),
      candidate: {
        name: 'Jane Doe',
        location: 'Hong Kong'
      },
      role: {
        title: 'Head of IT Transformation',
        company: 'Atomic Group'
      },
      fit_summary: '候选人在大型金融服务平台转型方面经验扎实。',
      relevant_experience: [
        '负责跨区域市场技术转型项目。'
      ],
      match_requirements: [],
      potential_concerns: [],
      recommended_next_step: '',
      employment_history: [
        {
          job_title: 'Director, Global Head of Transformation',
          company_name: 'HSBC',
          start_date: '2021',
          end_date: 'Present',
          responsibilities: [
            '负责企业平台现代化转型。'
          ]
        }
      ]
    }, null, 2),
    '```'
  ].join('\n'), originalBriefing);

  assert.match(translated.summary, /Candidate: Jane Doe/);
  assert.equal(translated.briefing.role.company, 'Atomic Group');
  assert.equal(translated.briefing.relevant_experience[0], '负责跨区域市场技术转型项目。');
  assert.equal(translated.briefing.employment_history[0].responsibilities[0], '负责企业平台现代化转型。');
  assert.deepEqual(translated.briefing.employment_history[0].evidence_refs, [{ source: 'cv', section: 'experience', excerpt: '', note: '' }]);
});

test('createTranslatableDraftPayload keeps the translation payload smaller than the full briefing object', () => {
  const payload = createTranslatableDraftPayload({
    summary: 'Candidate: Jane Doe',
    briefing: {
      candidate: {
        name: 'Jane Doe',
        location: 'Hong Kong',
        languages: ['English', 'Mandarin']
      },
      role: {
        title: 'Head of IT Transformation',
        company: 'Atomic Group'
      },
      fit_summary: 'Strong transformation leader.',
      evidence_refs: [
        { source: 'cv', excerpt: 'detail' }
      ],
      employment_history: [
        {
          job_title: 'Director',
          company_name: 'HSBC',
          start_date: '2021',
          end_date: 'Present',
          responsibilities: ['Led transformation'],
          evidence_refs: [
            { source: 'cv', excerpt: 'role line' }
          ]
        }
      ]
    }
  });

  assert.equal(payload.summary, 'Candidate: Jane Doe');
  assert.equal(payload.candidate.languages[0], 'English');
  assert.equal(payload.employment_history[0].responsibilities[0], 'Led transformation');
  assert.equal(Object.prototype.hasOwnProperty.call(payload.employment_history[0], 'evidence_refs'), false);
});

test('buildDraftTranslationRepairRequest creates a JSON-repair prompt for malformed output', () => {
  const request = buildDraftTranslationRepairRequest({
    malformedResponse: '{"summary":"abc"',
    expectedPayload: {
      summary: 'abc',
      fit_summary: 'def'
    }
  });

  assert.match(request.messages[0].content, /repair malformed json/i);
  assert.match(request.messages[1].content, /Malformed JSON response:/i);
});

test('applyTranslatedDraftPayload preserves base evidence refs while applying translated fields', () => {
  const translated = applyTranslatedDraftPayload({
    briefing: {
      fit_summary: 'Original fit summary',
      match_requirements: [
        {
          requirement: 'Leadership',
          evidence: 'Led teams',
          evidence_refs: [
            { source: 'cv', section: 'experience' }
          ]
        }
      ]
    },
    translatedPayload: {
      summary: '候选人：匿名候选人',
      fit_summary: '匹配概述',
      match_requirements: [
        {
          requirement: '领导力',
          evidence: '带领团队'
        }
      ]
    }
  });

  assert.equal(translated.briefing.match_requirements[0].requirement, '领导力');
  assert.deepEqual(translated.briefing.match_requirements[0].evidence_refs, [{ source: 'cv', section: 'experience', excerpt: '', note: '' }]);
});

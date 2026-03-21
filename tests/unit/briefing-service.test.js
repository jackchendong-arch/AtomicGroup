const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applySummaryOverridesToBriefing,
  buildBriefingGenerationSettings,
  buildBriefingRequest,
  buildBriefingRepairRequest,
  mergeBriefingWithFallback,
  normalizeBriefing,
  parseBriefingResponse,
  prepareHiringManagerBriefingOutput,
  renderHiringManagerBriefingReviewFromBriefing,
  renderSummaryFromBriefing,
  validateBriefing
} = require('../../services/briefing-service');
const { extractCandidateName } = require('../../services/summary-service');

test('parseBriefingResponse accepts fenced JSON and normalizes the structured briefing schema', () => {
  const briefing = parseBriefingResponse([
    '```json',
    JSON.stringify({
      candidate: {
        name: 'Alex Wong',
        location: 'Hong Kong',
        languages: ['English', 'Cantonese']
      },
      role: {
        title: 'Head of Technology'
      },
      fit_summary: 'Strong alignment with the target role.',
      relevant_experience: ['Led platform modernization'],
      match_requirements: [
        {
          requirement: 'Technology leadership',
          evidence: 'Led a regional engineering function'
        }
      ],
      potential_concerns: ['No direct insurance experience'],
      recommended_next_step: 'Proceed to hiring-manager review.',
      employment_history: [
        {
          job_title: 'Technology Director',
          company_name: 'HSBC',
          start_date: '2020',
          end_date: 'Present',
          responsibilities: ['Led platform transformation']
        }
      ]
    }, null, 2),
    '```'
  ].join('\n'));

  assert.equal(briefing.candidate.name, 'Alex Wong');
  assert.deepEqual(briefing.candidate.languages, ['English', 'Cantonese']);
  assert.equal(briefing.role.title, 'Head of Technology');
  assert.equal(briefing.match_requirements[0].evidence, 'Led a regional engineering function');
  assert.equal(briefing.employment_history[0].company_name, 'HSBC');
});

test('parseBriefingResponse normalizes alias employment and education keys from structured briefing responses', () => {
  const briefing = parseBriefingResponse([
    '```json',
    JSON.stringify({
      candidate: {
        name: 'Noah Zhang',
        education: [
          {
            institution: 'Johns Hopkins University',
            degree: 'Master of Science',
            dates: '2022.09-2024.06'
          }
        ]
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Strong alignment with the target role.',
      recommended_next_step: 'Proceed to review.',
      employment_history: [
        {
          employer: 'Sparksoft',
          title: 'Software Engineer',
          dates: '2024.07 - 2025.05',
          responsibilities: [
            'Built core order-processing services in Go.'
          ]
        }
      ]
    }, null, 2),
    '```'
  ].join('\n'));

  assert.equal(briefing.candidate.education[0].degree_name, 'Master of Science');
  assert.equal(briefing.candidate.education[0].university, 'Johns Hopkins University');
  assert.equal(briefing.candidate.education[0].start_year, '2022');
  assert.equal(briefing.candidate.education[0].end_year, '2024');
  assert.equal(briefing.employment_history[0].job_title, 'Software Engineer');
  assert.equal(briefing.employment_history[0].company_name, 'Sparksoft');
  assert.equal(briefing.employment_history[0].start_date, '2024');
  assert.equal(briefing.employment_history[0].end_date, '2025');
  assert.deepEqual(briefing.employment_history[0].responsibilities, [
    'Built core order-processing services in Go.'
  ]);
});

test('mergeBriefingWithFallback fills missing structured fields from fallback data', () => {
  const merged = mergeBriefingWithFallback(
    normalizeBriefing({
      candidate: {
        name: 'Alex Wong'
      },
      role: {
        title: 'Head of Technology'
      },
      fit_summary: 'Strong alignment with the target role.',
      recommended_next_step: ''
    }),
    normalizeBriefing({
      candidate: {
        name: 'Fallback Candidate',
        location: 'Singapore'
      },
      role: {
        title: 'Fallback Role',
        company: 'Atomic Group'
      },
      fit_summary: 'Fallback summary',
      recommended_next_step: 'Fallback next step',
      employment_history: [
        {
          job_title: 'Engineering Lead',
          company_name: 'Atomic Group',
          start_date: '2021',
          end_date: 'Present',
          responsibilities: ['Led platform delivery']
        }
      ]
    })
  );

  assert.equal(merged.candidate.name, 'Alex Wong');
  assert.equal(merged.candidate.location, 'Singapore');
  assert.equal(merged.role.company, 'Atomic Group');
  assert.equal(merged.recommended_next_step, 'Fallback next step');
  assert.equal(merged.employment_history.length, 1);
});

test('mergeBriefingWithFallback keeps fuller grounded fallback arrays when the LLM returns sparse structured detail', () => {
  const merged = mergeBriefingWithFallback(
    normalizeBriefing({
      candidate: {
        name: 'Alex Wong',
        languages: ['English']
      },
      role: {
        title: 'Head of Technology'
      },
      fit_summary: 'Strong alignment with the target role.',
      relevant_experience: ['Led platform modernization'],
      match_requirements: [
        {
          requirement: 'Technology leadership',
          evidence: ''
        }
      ],
      potential_concerns: ['No direct insurance experience'],
      recommended_next_step: 'Proceed to review.',
      employment_history: [
        {
          job_title: 'Technology Director',
          company_name: 'HSBC',
          start_date: '2020',
          end_date: 'Present',
          responsibilities: ['Led transformation strategy']
        }
      ]
    }),
    normalizeBriefing({
      candidate: {
        name: 'Alex Wong',
        languages: ['English', 'Cantonese']
      },
      role: {
        title: 'Head of Technology'
      },
      fit_summary: 'Fallback summary',
      relevant_experience: ['Led platform modernization', 'Managed regional engineering teams'],
      match_requirements: [
        {
          requirement: 'Technology leadership',
          evidence: 'Led a regional engineering function'
        },
        {
          requirement: 'Stakeholder management',
          evidence: 'Partnered with business and operations leaders'
        }
      ],
      potential_concerns: ['No direct insurance experience', 'Limited public-cloud delivery exposure'],
      recommended_next_step: 'Fallback next step',
      employment_history: [
        {
          job_title: 'Technology Director',
          company_name: 'HSBC',
          start_date: '2020',
          end_date: 'Present',
          responsibilities: ['Led transformation strategy', 'Managed a 60-person engineering organization']
        },
        {
          job_title: 'Engineering Lead',
          company_name: 'Standard Chartered',
          start_date: '2016',
          end_date: '2020',
          responsibilities: ['Built regional delivery teams']
        }
      ]
    })
  );

  assert.deepEqual(merged.candidate.languages, ['English', 'Cantonese']);
  assert.deepEqual(merged.relevant_experience, ['Led platform modernization', 'Managed regional engineering teams']);
  assert.equal(merged.match_requirements.length, 2);
  assert.equal(merged.match_requirements[0].evidence, 'Led a regional engineering function');
  assert.equal(merged.potential_concerns.length, 2);
  assert.equal(merged.employment_history.length, 2);
  assert.deepEqual(
    merged.employment_history[0].responsibilities,
    ['Led transformation strategy', 'Managed a 60-person engineering organization']
  );
});

test('mergeBriefingWithFallback prefers primary employment responsibilities when fallback text is in a different language', () => {
  const merged = mergeBriefingWithFallback(
    normalizeBriefing({
      candidate: {
        name: 'Noah Zhang'
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Strong alignment with the target role.',
      recommended_next_step: 'Proceed to review.',
      employment_history: [
        {
          job_title: 'Software Engineer',
          company_name: 'Sparksoft',
          start_date: '2024',
          end_date: '2025',
          responsibilities: [
            'Built core order-processing services in Go and delivered RESTful API modules.'
          ]
        }
      ]
    }),
    normalizeBriefing({
      candidate: {
        name: 'Noah Zhang'
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Fallback summary',
      recommended_next_step: 'Fallback next step',
      employment_history: [
        {
          job_title: 'Software Engineer',
          company_name: 'Sparksoft',
          start_date: '2024',
          end_date: '2025',
          responsibilities: [
            '使用 Go 语言参与构建公司核心订单处理服务，负责设计与开发 RESTful API。'
          ]
        }
      ]
    })
  );

  assert.deepEqual(merged.employment_history[0].responsibilities, [
    'Built core order-processing services in Go and delivered RESTful API modules.'
  ]);
});

test('mergeBriefingWithFallback dedupes the same employment entry across localized title and decorated company variants', () => {
  const merged = mergeBriefingWithFallback(
    normalizeBriefing({
      candidate: {
        name: 'Noah Zhang'
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Strong alignment with the target role.',
      recommended_next_step: 'Proceed to review.',
      employment_history: [
        {
          job_title: 'Software Engineer',
          company_name: 'Sparksoft',
          start_date: '2024',
          end_date: '2025',
          responsibilities: [
            'Built core order-processing services in Go and delivered RESTful API modules.'
          ]
        }
      ]
    }),
    normalizeBriefing({
      candidate: {
        name: 'Noah Zhang'
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Fallback summary',
      recommended_next_step: 'Fallback next step',
      employment_history: [
        {
          job_title: '软件工程师',
          company_name: 'Sparksoft（ 技 术 研 发 部 ）',
          start_date: '2024',
          end_date: '2025',
          responsibilities: [
            '使用 Go 语言参与构建公司核心订单处理服务，负责设计与开发 RESTful API。'
          ]
        }
      ]
    })
  );

  assert.equal(merged.employment_history.length, 1);
  assert.equal(merged.employment_history[0].job_title, 'Software Engineer');
  assert.equal(merged.employment_history[0].company_name, 'Sparksoft');
  assert.deepEqual(merged.employment_history[0].responsibilities, [
    'Built core order-processing services in Go and delivered RESTful API modules.'
  ]);
});

test('applySummaryOverridesToBriefing keeps structured facts but updates recruiter-facing narrative sections', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: 'Alex Wong',
      location: 'Hong Kong'
    },
    role: {
      title: 'Head of Technology'
    },
    fit_summary: 'Original summary',
    relevant_experience: ['Original experience'],
    match_requirements: [
      {
        requirement: 'Leadership',
        evidence: 'Original evidence'
      }
    ],
    potential_concerns: ['Original concern'],
    recommended_next_step: 'Original next step',
    employment_history: [
      {
        job_title: 'Technology Director',
        company_name: 'HSBC',
        start_date: '2020',
        end_date: 'Present',
        responsibilities: ['Led platform transformation']
      }
    ]
  });

  const updatedBriefing = applySummaryOverridesToBriefing(
    briefing,
    [
      'Candidate: Alex Wong',
      'Target Role: Group CTO',
      '',
      '## Fit Summary',
      'Updated summary from recruiter review.',
      '',
      '## Relevant Experience',
      '- Updated experience bullet',
      '',
      '## Match Against Key Requirements',
      '- Leadership -> Built and led regional engineering teams',
      '',
      '## Potential Concerns / Gaps',
      '- Limited direct banking exposure',
      '',
      '## Recommended Next Step',
      'Introduce to the hiring manager.'
    ].join('\n')
  );

  assert.equal(updatedBriefing.role.title, 'Group CTO');
  assert.equal(updatedBriefing.fit_summary, 'Updated summary from recruiter review.');
  assert.deepEqual(updatedBriefing.relevant_experience, ['Updated experience bullet']);
  assert.equal(updatedBriefing.match_requirements[0].evidence, 'Built and led regional engineering teams');
  assert.equal(updatedBriefing.employment_history[0].company_name, 'HSBC');
});

test('renderSummaryFromBriefing produces a recruiter-readable summary and validateBriefing accepts complete data', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: 'Alex Wong'
    },
    role: {
      title: 'Head of Technology'
    },
    fit_summary: 'Strong alignment with the target role.',
    relevant_experience: ['Led platform modernization'],
    match_requirements: [
      {
        requirement: 'Technology leadership',
        evidence: 'Led a regional engineering function'
      }
    ],
    potential_concerns: ['No direct insurance experience'],
    recommended_next_step: 'Proceed to hiring-manager review.'
  });

  const validation = validateBriefing(briefing);
  const summary = renderSummaryFromBriefing(briefing);

  assert.equal(validation.isValid, true);
  assert.match(summary, /Candidate: Alex Wong/);
  assert.match(summary, /## Fit Summary/);
  assert.match(summary, /Technology leadership -> Led a regional engineering function/);
});

test('renderHiringManagerBriefingReviewFromBriefing produces a reviewable hiring-manager briefing surface', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: 'Alex Wong',
      location: 'Hong Kong',
      languages: ['English', 'Cantonese'],
      education: [
        {
          degree_name: 'BEng Computer Science',
          university: 'HKUST',
          start_year: '2008',
          end_year: '2012'
        }
      ]
    },
    role: {
      title: 'Head of Technology',
      company: 'Atomic Group'
    },
    fit_summary: 'Strong alignment with the target role.',
    relevant_experience: ['Led platform modernization'],
    match_requirements: [
      {
        requirement: 'Technology leadership',
        evidence: 'Led a regional engineering function'
      }
    ],
    potential_concerns: ['No direct insurance experience'],
    recommended_next_step: 'Proceed to hiring-manager review.',
    employment_history: [
      {
        job_title: 'Technology Director',
        company_name: 'HSBC',
        start_date: '2020',
        end_date: 'Present',
        responsibilities: ['Led platform transformation']
      }
    ]
  });

  const review = renderHiringManagerBriefingReviewFromBriefing(briefing);

  assert.match(review, /## Briefing Summary/);
  assert.match(review, /Candidate: Alex Wong/);
  assert.match(review, /Hiring Company: Atomic Group/);
  assert.match(review, /## Employment Experience/);
  assert.match(review, /Technology Director \| HSBC/);
  assert.match(review, /Led platform transformation/);
});

test('renderSummaryFromBriefing supports Simplified Chinese output headings', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: '张伟'
    },
    role: {
      title: '技术负责人'
    },
    fit_summary: '该候选人与目标岗位具有较强匹配度。',
    relevant_experience: ['负责平台现代化改造'],
    match_requirements: [
      {
        requirement: '技术领导力',
        evidence: '负责区域工程团队'
      }
    ],
    potential_concerns: ['暂缺直接保险行业经验'],
    recommended_next_step: '建议进入用人经理评审。'
  });

  const summary = renderSummaryFromBriefing(briefing, 'zh');

  assert.match(summary, /候选人：张伟/);
  assert.match(summary, /## 匹配概述/);
  assert.match(summary, /技术领导力 -> 负责区域工程团队/);
});

test('renderHiringManagerBriefingReviewFromBriefing supports Simplified Chinese review headings', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: '张伟',
      location: '上海',
      languages: ['中文', 'English']
    },
    role: {
      title: '技术负责人',
      company: '原子集团'
    },
    fit_summary: '该候选人与目标岗位具有较强匹配度。',
    relevant_experience: ['负责平台现代化改造'],
    match_requirements: [
      {
        requirement: '技术领导力',
        evidence: '负责区域工程团队'
      }
    ],
    potential_concerns: ['暂缺直接保险行业经验'],
    recommended_next_step: '建议进入用人经理评审。',
    employment_history: [
      {
        job_title: '技术总监',
        company_name: '汇丰',
        start_date: '2020',
        end_date: '至今',
        responsibilities: ['负责平台转型']
      }
    ]
  });

  const review = renderHiringManagerBriefingReviewFromBriefing(briefing, 'zh');

  assert.match(review, /## 简报摘要/);
  assert.match(review, /候选人：张伟/);
  assert.match(review, /招聘公司：原子集团/);
  assert.match(review, /## 工作经历/);
  assert.match(review, /技术总监 \| 汇丰/);
  assert.match(review, /负责平台转型/);
});

test('prepareHiringManagerBriefingOutput keeps briefing review and Word template data aligned', () => {
  const output = prepareHiringManagerBriefingOutput({
    briefing: normalizeBriefing({
      candidate: {
        name: 'Alex Wong',
        location: 'Hong Kong',
        preferred_location: 'Singapore',
        nationality: 'Chinese',
        languages: ['English', 'Cantonese', 'Mandarin'],
        education: [
          {
            degree_name: 'BEng Computer Science',
            university: 'HKUST',
            start_year: '2008',
            end_year: '2012'
          },
          {
            degree_name: 'MBA',
            university: 'INSEAD',
            start_year: '2016',
            end_year: '2017'
          }
        ]
      },
      role: {
        title: 'Head of Technology',
        company: 'Atomic Group'
      },
      fit_summary: 'Original summary',
      relevant_experience: ['Original experience'],
      match_requirements: [
        {
          requirement: 'Technology leadership',
          evidence: 'Original evidence'
        }
      ],
      potential_concerns: ['Original concern'],
      recommended_next_step: 'Original next step',
      employment_history: [
        {
          job_title: 'Technology Director',
          company_name: 'HSBC',
          start_date: '2020',
          end_date: 'Present',
          responsibilities: ['Led platform transformation']
        }
      ]
    }),
    recruiterSummary: [
      'Candidate: Alex Wong',
      'Target Role: Group CTO',
      '',
      '## Fit Summary',
      'Updated summary from recruiter review.',
      '',
      '## Relevant Experience',
      '- Updated experience bullet',
      '',
      '## Match Against Key Requirements',
      '- Technology leadership -> Built and led regional engineering teams',
      '',
      '## Potential Concerns / Gaps',
      '- Limited direct banking exposure',
      '',
      '## Recommended Next Step',
      'Introduce to the hiring manager.'
    ].join('\n')
  });

  assert.match(output.review, /## Briefing Summary/);
  assert.match(output.review, /Updated summary from recruiter review\./);
  assert.equal(output.templateData.role_title, 'Group CTO');
  assert.equal(output.templateData.fit_summary, 'Updated summary from recruiter review.');
  assert.equal(output.templateData.candidate_nationality, 'Chinese');
  assert.equal(output.templateData.candidate_preferred_location, 'Singapore');
  assert.equal(output.templateData.candidate_languages, 'English, Cantonese, Mandarin');
  assert.equal(output.templateData.education_entries.length, 2);
  assert.match(output.templateData.education_summary, /BEng Computer Science/);
  assert.match(output.templateData.education_summary, /MBA/);
  assert.match(output.templateData.match_requirements, /Technology leadership -> Built and led regional engineering teams/);
  assert.equal(output.templateData.employment_history[0].company_name, 'HSBC');
});

test('extractCandidateName recognizes uppercase surnames and parenthetical nicknames from CV text', () => {
  const uppercaseSurnameName = extractCandidateName(
    [
      'Xiaoshen CONG (Shawn)',
      'Shanghai, China',
      'Talent Acquisition professional with 9+ years of experience.'
    ].join('\n'),
    'CV_Shawn_CONG_2026.pdf'
  );

  const middleNicknameName = extractCandidateName(
    [
      'Jimmy(Feiyang) Tan',
      'tan.feiyang@yahoo.com',
      'CTO / Founding Engineer with strong hands-on experience in backend systems and smart contract architecture.'
    ].join('\n'),
    'CV4-6.pdf'
  );

  assert.equal(uppercaseSurnameName, 'Xiaoshen CONG (Shawn)');
  assert.equal(middleNicknameName, 'Jimmy(Feiyang) Tan');
});

test('buildBriefingRequest explicitly tells English output to translate human-readable employment and snapshot fields', () => {
  const request = buildBriefingRequest({
    cvDocument: {
      text: [
        'Noah Zhang',
        '工作经历',
        '2024.07-2025.05 Sparksoft 软件工程师',
        'l 使用 Go 语言参与构建公司核心订单处理服务'
      ].join('\n'),
      file: {
        name: 'candidate-cv.pdf'
      }
    },
    jdDocument: {
      text: '职位：区块链开发工程师',
      file: {
        name: 'role-jd.docx'
      }
    },
    systemPrompt: 'You are a structured briefing assistant.',
    outputLanguage: 'en'
  });

  assert.match(
    request.prompt,
    /translate source-language prose into English while preserving proper nouns, employer names, and technical identifiers/i
  );
  assert.match(
    request.prompt,
    /employment-history titles, and employment-history responsibilities/i
  );
});

test('buildBriefingGenerationSettings raises the structured briefing token budget above the general default', () => {
  const settings = buildBriefingGenerationSettings({
    providerId: 'deepseek',
    maxTokens: 1200,
    temperature: 0.2
  });

  assert.equal(settings.maxTokens, 3200);
  assert.equal(settings.temperature, 0.2);
});

test('buildBriefingRepairRequest creates a JSON-repair prompt for malformed structured briefing output', () => {
  const request = buildBriefingRepairRequest({
    malformedResponse: '{"candidate":{"name":"Noah Zhang"}',
    expectedBriefing: {
      candidate: {
        name: 'Noah Zhang'
      },
      role: {
        title: 'Blockchain Developer'
      }
    }
  });

  assert.match(request.messages[0].content, /repair malformed structured briefing json/i);
  assert.match(request.messages[1].content, /Malformed JSON response:/i);
  assert.match(request.messages[1].content, /Blockchain Developer/);
});

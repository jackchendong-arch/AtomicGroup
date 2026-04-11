const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applySummaryOverridesToBriefing,
  buildBriefingGenerationSettings,
  buildBriefingRequest,
  buildBriefingRepairRequest,
  buildFallbackBriefingArtifact,
  buildTemplateDataFromBriefing,
  composeDeterministicReportBriefing,
  mergeBriefingWithFallback,
  normalizeBriefing,
  parseBriefingResponse,
  prepareHiringManagerBriefingOutput,
  repairRecruiterSummary,
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

test('composeDeterministicReportBriefing keeps narrative from the briefing but replaces factual report sections with canonical source data', () => {
  const composed = composeDeterministicReportBriefing(
    normalizeBriefing({
      candidate: {
        name: 'Eugene Liu'
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Strong fit for the role.',
      relevant_experience: ['Strong blockchain backend experience.'],
      recommended_next_step: 'Proceed to client interview.',
      employment_history: [
        {
          job_title: 'Tech Stack: Golang, Solidity, PostgreSQL, GraphQL, gRPC.',
          company_name: '',
          start_date: '2024',
          end_date: 'Present',
          responsibilities: ['ua scripting.']
        }
      ],
      project_experiences: []
    }),
    normalizeBriefing({
      candidate: {
        name: 'Eugene Liu',
        education: [
          {
            degree_name: 'Bachelor of Industrial Design',
            university: 'South China University of Technology',
            start_year: '2011',
            end_year: '2015'
          }
        ],
        skills: ['Golang', 'Solidity']
      },
      role: {
        title: 'Blockchain Developer'
      },
      fit_summary: 'Fallback summary',
      employment_history: [
        {
          job_title: 'Backend Engineer',
          company_name: 'Delulu',
          start_date: '2024',
          end_date: 'Present',
          responsibilities: [
            'Developed RFQ smart contracts.',
            'Built relayer infrastructure.'
          ]
        }
      ],
      project_experiences: [
        {
          project_name: 'High Performance Blockchain Relayer and Indexer',
          project_bullets: ['Designed configurable event indexing framework.']
        }
      ]
    })
  );

  assert.equal(composed.fit_summary, 'Strong fit for the role.');
  assert.deepEqual(composed.relevant_experience, ['Strong blockchain backend experience.']);
  assert.equal(composed.recommended_next_step, 'Proceed to client interview.');
  assert.equal(composed.employment_history[0].job_title, 'Backend Engineer');
  assert.equal(composed.employment_history[0].company_name, 'Delulu');
  assert.deepEqual(composed.employment_history[0].responsibilities, [
    'Developed RFQ smart contracts.',
    'Built relayer infrastructure.'
  ]);
  assert.equal(composed.project_experiences[0].project_name, 'High Performance Blockchain Relayer and Indexer');
  assert.equal(composed.candidate.education[0].degree_name, 'Bachelor of Industrial Design');
  assert.deepEqual(composed.candidate.skills, ['Golang', 'Solidity']);
});

test('buildFallbackBriefingArtifact projects canonical candidate and JD facts into the fallback briefing contract', () => {
  const artifact = buildFallbackBriefingArtifact({
    cvDocument: {
      text: [
        'Noah Zhang',
        'Shanghai, China',
        '',
        'Education',
        'MSc in Computing',
        'Cardiff University, UK | 2019 – 2020',
        '',
        'Work Experience',
        'Acme Capital — Blockchain Engineer',
        '2020 – 2023',
        '- Built backend services',
        '- Led protocol delivery',
        '',
        'Projects',
        'Liquidity Router (2022 – 2022)',
        '- Built low-latency routing services',
        '- Tech Stack: Golang, Solidity'
      ].join('\n'),
      file: {
        name: 'Noah Zhang CV.pdf',
        path: '/tmp/noah-zhang.pdf'
      }
    },
    jdDocument: {
      text: [
        'Role: Blockchain Engineer',
        '',
        'Requirements',
        '- Experience building backend services',
        '- Golang or Solidity experience'
      ].join('\n'),
      file: {
        name: 'JD4.docx',
        path: '/tmp/jd4.docx'
      }
    }
  });
  const briefing = artifact.briefing;

  assert.equal(artifact.canonicalValidationSummary.state, 'green');
  assert.equal(briefing.candidate.name, 'Noah Zhang');
  assert.equal(briefing.candidate.location, 'Shanghai, China');
  assert.equal(briefing.candidate.education[0].degree_name, 'MSc in Computing');
  assert.equal(briefing.employment_history[0].job_title, 'Blockchain Engineer');
  assert.deepEqual(briefing.employment_history[0].responsibilities, [
    'Built backend services',
    'Led protocol delivery'
  ]);
  assert.equal(briefing.project_experiences[0].project_name, 'Liquidity Router');
  assert.equal(briefing.project_experiences[0].linked_job_title, 'Blockchain Engineer');
  assert.equal(briefing.project_experiences[0].linked_company_name, 'Acme Capital');
  assert(briefing.project_experiences[0].project_bullets.some((bullet) => /low-latency routing services/i.test(bullet)));
  assert(briefing.project_experiences[0].project_bullets.some((bullet) => /tech stack:\s*golang,\s*solidity/i.test(bullet)));
  assert.equal(briefing.match_requirements[0].requirement, 'Experience building backend services');
  assert.equal(briefing.match_requirements[1].requirement, 'Golang or Solidity experience');
});

test('buildFallbackBriefingArtifact threads canonical amber validation alongside fallback briefing projection', () => {
  const artifact = buildFallbackBriefingArtifact({
    cvDocument: {
      text: [
        'Noah Zhang',
        'Shanghai, China',
        '',
        'Work Experience',
        'Acme Capital — Blockchain Engineer',
        '2020 – 2023',
        '- Built backend services',
        '',
        'Beta Labs — Lead Engineer',
        '2021 – 2024',
        '- Led protocol delivery',
        '',
        'Projects',
        'Liquidity Router (2022 – 2022)',
        '- Built low-latency routing services'
      ].join('\n'),
      file: {
        name: 'Noah Zhang CV.pdf',
        path: '/tmp/noah-zhang-ambiguous.pdf'
      }
    },
    jdDocument: {
      text: [
        'Role: Blockchain Engineer',
        '',
        'Requirements',
        '- Experience building backend services'
      ].join('\n'),
      file: {
        name: 'JD4.docx',
        path: '/tmp/jd4-ambiguous.docx'
      }
    }
  });

  assert.equal(artifact.canonicalValidationSummary.state, 'amber');
  assert(artifact.canonicalValidationSummary.issues.some((issue) => issue.code === 'project_role_ambiguous'));
  assert.equal(artifact.briefing.project_experiences[0].project_name, 'Liquidity Router');
  assert.equal(artifact.briefing.project_experiences[0].linked_job_title, '');
  assert.equal(artifact.briefing.project_experiences[0].linked_company_name, '');
});

test('buildTemplateDataFromBriefing populates richer report-template loops and aliases', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: 'Eugene Liu',
      location: 'Shanghai',
      skills: ['Golang', 'Solidity', 'PostgreSQL'],
      certifications: ['AWS Solutions Architect'],
      education: [
        {
          degree_name: 'Bachelor of Industrial Design',
          university: 'South China University of Technology',
          start_year: '2011',
          end_year: '2015'
        }
      ]
    },
    role: {
      title: '区块链开发工程师 (Blockchain Developer)',
      hiring_manager: 'Atomic Group'
    },
    fit_summary: 'Strong fit for the role.',
    match_requirements: [
      {
        requirement: 'Strong Golang background',
        evidence: 'Built relayer infrastructure and trading services'
      }
    ],
    recommended_next_step: 'Proceed to hiring-manager interview.',
    employment_history: [
      {
        job_title: 'Backend Engineer',
        company_name: 'Delulu',
        start_date: '2024',
        end_date: 'Present',
        responsibilities: [
          'Developed RFQ smart contracts.',
          'Built relayer infrastructure.'
        ]
      }
    ],
    project_experiences: [
      {
        project_name: 'High Performance Blockchain Relayer and Indexer',
        linked_job_title: 'Backend Engineer',
        linked_company_name: 'Delulu',
        project_bullets: [
          'Designed configurable event indexing framework.',
          'Implemented secure private key management.'
        ],
        project_bullet_originals: [
          'Designed configurable event indexing framework.',
          'Implemented secure private key management.'
        ]
      }
    ]
  });

  const templateData = buildTemplateDataFromBriefing(briefing, 'en');

  assert.equal(templateData.hiring_manager_name, 'Atomic Group');
  assert.equal(templateData.education_entries[0].field_of_study, '');
  assert.equal(templateData.education_entries[0].institution_name, 'South China University of Technology');
  assert.equal(templateData.employment_experience_entries[0].employment_start_date, '2024');
  assert.equal(
    templateData.employment_experience_entries[0].responsibility_bullets[0].responsibility_text,
    'Developed RFQ smart contracts.'
  );
  assert.equal(
    templateData.match_requirement_entries[0].match_requirement_text,
    'Strong Golang background: Built relayer infrastructure and trading services'
  );
  assert.equal(
    templateData.project_experience_entries[0].project_name,
    'High Performance Blockchain Relayer and Indexer'
  );
  assert.equal(
    templateData.project_experience_entries[0].project_bullets[0].project_bullet_text,
    'Designed configurable event indexing framework.'
  );
  assert.equal(templateData.candidate_skills, 'Golang, Solidity, PostgreSQL');
  assert.equal(templateData.candidate_certifications, 'AWS Solutions Architect');
  assert.equal(templateData.original_authoritative_appendix.length, 1);
});

test('buildTemplateDataFromBriefing splits simple English degree-in-field patterns for revised Word templates', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: 'Chenhao Li',
      education: [
        {
          degree_name: 'MSc in Computing',
          university: 'Cardiff University, UK',
          start_year: '2019',
          end_year: '2020'
        }
      ]
    },
    role: {
      title: 'Blockchain Developer'
    },
    fit_summary: 'Strong fit for the role.',
    relevant_experience: 'Relevant experience.',
    recommended_next_step: 'Proceed.',
    employment_history: [
      {
        job_title: 'Blockchain Engineer',
        company_name: 'Shanghai Xiaohan Technology Co., Ltd.',
        start_date: '2021',
        end_date: '2025',
        responsibilities: ['Built backend services.']
      }
    ],
    project_experiences: []
  });

  const templateData = buildTemplateDataFromBriefing(briefing, 'en');

  assert.equal(templateData.education_entries[0].degree_name, 'MSc');
  assert.equal(templateData.education_entries[0].field_of_study, 'Computing');
  assert.equal(templateData.degree_name, 'MSc');
  assert.equal(templateData.field_of_study, 'Computing');
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

test('repairRecruiterSummary fills missing required sections from the briefing and softens strong certainty wording', () => {
  const briefing = normalizeBriefing({
    candidate: {
      name: 'Noah Zhang'
    },
    role: {
      title: 'Blockchain Developer'
    },
    fit_summary: 'Noah Zhang is a strong candidate for this role.',
    relevant_experience: ['Built blockchain platform services at Sparksoft.'],
    match_requirements: [
      {
        requirement: 'Go and Rust delivery',
        evidence: 'Built backend and blockchain services.'
      }
    ],
    potential_concerns: ['Limited direct production DeFi scale evidence.'],
    recommended_next_step: 'Proceed to hiring-manager review.'
  });

  const repaired = repairRecruiterSummary([
    '### Recruitment Summary for Noah Zhang',
    'Target Role: Blockchain Developer',
    '',
    '#### Fit Summary',
    'Noah Zhang is an ideal candidate for this role.',
    '',
    '#### Relevant Experience',
    '- Built blockchain platform services at Sparksoft.',
    '',
    '#### Match Against Key Requirements',
    '- Go and Rust delivery -> Built backend and blockchain services.'
  ].join('\n'), briefing, 'en');

  assert.match(repaired, /## Recommended Next Step/);
  assert.match(repaired, /Proceed to hiring-manager review\./);
  assert.doesNotMatch(repaired, /\bideal candidate\b/i);
  assert.match(repaired, /\bstrong candidate\b/i);
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

  const spacedLetterOcrName = extractCandidateName(
    [
      'MSc in Computing',
      'Cardiff University, UK | 2019 – 2020',
      'Bachelor of Business Administration (BBA)',
      'Jincheng College, Nanjing University of Aeronautics and Astronautics | 2012 – 2016',
      'Shanghai Xiaohan Technology Co., Ltd. — Blockchain Engineer',
      'Sep 2021 – Sep 2025',
      'Wanxiang Blockchain Inc., Shanghai — Blockchain Engineer',
      'Feb 2021 – Sep 2021',
      'Shanghai Tancheng Data Technology Co., Ltd. — Full-Stack Engineer',
      'Sep 2020 – Feb 2021',
      'Shanghai Baoxiang Financial Information Service Co., Ltd. — Full-Stack Engineer',
      'Jun 2016 – Jun 2019',
      'Shanghai Chahe Interactive Network Technology Co., Ltd. — Android Engineer',
      'Jun 2015 – Jun 2016',
      'C h e n h a o L i',
      'Full-Stack Web3 Engineer'
    ].join('\n'),
    'CV4-2.pdf'
  );

  assert.equal(uppercaseSurnameName, 'Xiaoshen CONG (Shawn)');
  assert.equal(middleNicknameName, 'Jimmy(Feiyang) Tan');
  assert.equal(spacedLetterOcrName, 'Chenhao Li');
});

test('extractCandidateName rejects overview headings and role labels, then falls back to cleaner filename-derived names', () => {
  const chineseOverviewHeadingName = extractCandidateName(
    [
      '刘欣',
      '软件工程 硕士',
      '联系电话：18500239163',
      '个人简介',
      '现就职于花牛科技，做测试开发组长。'
    ].join('\n'),
    '刘欣简历.pdf'
  );

  const roleLabelInsteadOfName = extractCandidateName(
    [
      'Open minded, decisive, willing to drive changes and provide solutions.',
      'Business Analyst',
      'Guangzhou-Tianhe',
      'Worked across cross-border payment and transfer projects.'
    ].join('\n'),
    '殷昱的简历.pdf'
  );

  const latinInlineNameWithChineseFileName = extractCandidateName(
    [
      'Open minded, decisive, willing to drive changes and provide solutions.',
      'Farben GZ 2024/04-2025/07',
      'Business Analyst',
      'Guangzhou-Tianhe',
      'Yin Yu',
      'On job, seeking for new job · 37 · Bachelor · 15 years 2 month experience'
    ].join('\n'),
    '殷昱的简历.pdf'
  );

  const overviewLabelInsteadOfName = extractCandidateName(
    [
      'Tel： +86 18142874592',
      'E-mail：1318835235@qq.com',
      'Current Residence',
      'Beiging, China'
    ].join('\n'),
    'chenweihao-ENCV.docx'
  );

  assert.equal(chineseOverviewHeadingName, '刘欣');
  assert.equal(roleLabelInsteadOfName, '殷昱');
  assert.equal(latinInlineNameWithChineseFileName, '殷昱');
  assert.equal(overviewLabelInsteadOfName, 'Chenweihao');
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
  assert.match(
    request.prompt,
    /Do not leave whole narrative fields in Chinese when the requested output language is English/i
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

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WORD_TEMPLATE_CONTRACT,
  buildTemplateData,
  extractDocumentDerivedProfile,
  extractEducationEntries,
  extractExperienceHistory,
  parseStructuredSummary,
  validateWordTemplateContract
} = require('../../services/hiring-manager-template-service');

function buildEmploymentHistory(cvText) {
  const templateData = buildTemplateData({
    summary: [
      'Candidate: Jack Xin Dong Chen',
      'Target Role: Head of IT Transformation',
      '',
      '## Fit Summary',
      'Strong fit for the role.'
    ].join('\n'),
    cvDocument: {
      text: cvText,
      file: {
        name: 'candidate-cv.pdf'
      }
    },
    jdDocument: {
      text: 'Job Title: Head of IT Transformation\nCompany: Atomic Group',
      file: {
        name: 'role-jd.pdf'
      }
    }
  });

  return templateData.employment_history;
}

test('employment history ignores location-only lines and PDF page artifacts', () => {
  const employmentHistory = buildEmploymentHistory([
    'Jack Xin Dong Chen',
    'Hong Kong',
    '',
    'Employment Experience',
    'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
    'China',
    '2023 - Present',
    '- 1 of 3 --',
    '- 2 of 3 --',
    '',
    'Executive Director, Markets Technology',
    'HSBC',
    '2019 - 2023',
    '- Led platform modernisation',
    '- Managed global delivery'
  ].join('\n'));

  assert.equal(employmentHistory.length, 2);
  assert.deepEqual(employmentHistory[0], {
    job_title: 'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
    company_name: '',
    start_date: '2023',
    end_date: 'Present',
    responsibilities: []
  });
  assert.deepEqual(employmentHistory[1], {
    job_title: 'Executive Director, Markets Technology',
    company_name: 'HSBC',
    start_date: '2019',
    end_date: '2023',
    responsibilities: [
      {
        responsibility: 'Led platform modernisation'
      },
      {
        responsibility: 'Managed global delivery'
      }
    ]
  });
});

test('validateWordTemplateContract accepts a template inspection that satisfies the required logical tags', () => {
  const contract = validateWordTemplateContract({
    supportedDetectedTags: [
      'Candidate_Name',
      'role_title',
      '#employment_history',
      'Candidate_Summary',
      '#responsibilities',
      'responsibility'
    ]
  });

  assert.equal(contract.isValid, true);
  assert.deepEqual(contract.missingRequiredLogicalTagGroups, []);
  assert.deepEqual(contract.requiredLogicalTagGroups, WORD_TEMPLATE_CONTRACT.requiredLogicalTagGroups);
  assert.ok(contract.resolvedLogicalTags.includes('candidate_name'));
  assert.ok(contract.resolvedLogicalTags.includes('employment_history'));
});

test('validateWordTemplateContract reports missing required logical tags explicitly', () => {
  const contract = validateWordTemplateContract({
    supportedDetectedTags: [
      'candidate_name',
      '#employment_history'
    ]
  });

  assert.equal(contract.isValid, false);
  assert.deepEqual(contract.missingRequiredLogicalTagGroups, [
    ['role_title'],
    ['candidate_summary', 'fit_summary']
  ]);
});

test('validateWordTemplateContract records optional separator issues without blocking legacy templates', () => {
  const contract = validateWordTemplateContract({
    supportedDetectedTags: [
      'candidate_name',
      'role_title',
      'candidate_summary',
      '#employment_experience_entries',
      '#project_experience_entries',
      '#education_entries',
      'field_of_study',
      'institution_name',
      'education_end_year',
      'education_location',
      'linked_job_title',
      'linked_company_name'
    ],
    rawTemplateText: [
      '{{field_of_study}} | {{institution_name}}',
      '{{education_end_year}} | {{education_location}}',
      '{{linked_job_title}} | {{linked_company_name}}'
    ].join('\n')
  });

  assert.equal(contract.isValid, true);
  assert.equal(contract.missingRequiredLogicalTagGroups.length, 0);
  assert.deepEqual(contract.optionalSeparatorIssues, [
    {
      label: 'education field and institution',
      separator: '|',
      leftTag: 'field_of_study',
      rightTag: 'institution_name'
    },
    {
      label: 'education years and location',
      separator: '|',
      leftTag: 'education_end_year',
      rightTag: 'education_location'
    },
    {
      label: 'project linked role and company',
      separator: '|',
      leftTag: 'linked_job_title',
      rightTag: 'linked_company_name'
    }
  ]);
});

test('parseStructuredSummary keeps nested markdown headings inside recruiter-summary sections', () => {
  const sections = parseStructuredSummary([
    '### Candidate: Noah Zhang',
    'Target Role: Blockchain Developer',
    '',
    '## Fit Summary',
    'Strong blockchain delivery fit.',
    '',
    '---',
    '',
    '## Relevant Experience',
    '### **2024.07 - 2025.05: Technical Research & Development (Tech Research)',
    '- Role: Software Engineer at Sparksoft',
    '- Built blockchain platform services.',
    '',
    '## Match Against Key Requirements',
    '### Key Requirements for Blockchain Developer',
    '1. Go and Rust delivery experience.',
    '',
    '## Potential Concerns/Gaps',
    '1. Limited explicit DeFi production scale evidence.',
    '',
    '## Recommended Next Step',
    'Proceed to hiring-manager interview.'
  ].join('\n'));

  assert.equal(sections.candidate_name, 'Noah Zhang');
  assert.equal(sections.role_title, 'Blockchain Developer');
  assert.equal(sections.fit_summary, 'Strong blockchain delivery fit.');
  assert.match(sections.relevant_experience, /Sparksoft/);
  assert.match(sections.match_requirements, /Go and Rust delivery experience/);
  assert.match(sections.potential_concerns, /DeFi production scale evidence/);
  assert.equal(sections.recommended_next_step, 'Proceed to hiring-manager interview.');
});

test('employment history does not treat inline location suffixes as company names', () => {
  const employmentHistory = buildEmploymentHistory([
    'Jack Xin Dong Chen',
    'Hong Kong',
    '',
    'Employment Experience',
    'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT | China',
    '2023 - Present',
    '- 1 of 3 --'
  ].join('\n'));

  assert.equal(employmentHistory.length, 1);
  assert.deepEqual(employmentHistory[0], {
    job_title: 'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
    company_name: '',
    start_date: '2023',
    end_date: 'Present',
    responsibilities: []
  });
});

test('employment history falls back to a full-CV scan when the named experience section is too weak', () => {
  const employmentHistory = buildEmploymentHistory([
    'Jack Xin Dong Chen',
    'Hong Kong',
    '',
    'Employment Experience',
    'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
    '2023 - Present',
    '',
    'Summary',
    'Executive search technology leader with global platform experience.',
    '',
    'Executive Director, Markets Technology',
    'HSBC',
    '2019 - 2023',
    '- Led platform modernisation',
    '- Managed global delivery'
  ].join('\n'));

  assert.equal(employmentHistory.length, 2);
  assert.deepEqual(employmentHistory[1], {
    job_title: 'Executive Director, Markets Technology',
    company_name: 'HSBC',
    start_date: '2019',
    end_date: '2023',
    responsibilities: [
      {
        responsibility: 'Led platform modernisation'
      },
      {
        responsibility: 'Managed global delivery'
      }
    ]
  });
});

test('employment history parses real PDF-style role blocks with company-plus-date lines and wrapped en-dash bullets', () => {
  const employmentHistory = buildEmploymentHistory([
    'Jack Xin Dong Chen',
    'Hong Kong',
    '',
    'PROFESSIONAL EXPERIENCE',
    'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
    'China',
    'HSBC Oct 2023 – Present',
    'Dual-mandate technology executive within Global Equities – functionally leading Client and Market Connectivity',
    'teams across AMER, EMEA, and APAC, while directly managing the Equities IT China engineering hub in',
    'Guangzhou. Accountable for global platform modernisation, cross-regional technology delivery, and 24/7',
    'production operations across APAC, EMEA, and AMER.',
    'Strategy & Platform Transformation',
    '– Defined and executed modernisation strategy for high-volume, real-time transactional platforms,',
    'transitioning legacy components to scalable, resilient target architectures while ensuring zero business',
    'disruption across jurisdictions.',
    '– Governed end-to-end architecture across client onboarding, order routing, market gateway integration, data',
    'distribution, and infrastructure layers.',
    '-- 1 of 3 --',
    'Director, Head of Markets Securities Services IT China and Head of Equities & Securities Finance IT',
    'China',
    'HSBC Jun 2018 – Oct 2023',
    'Executive leadership role heading the Guangzhou strategic nearshore delivery centre – a core component of',
    'HSBC’s global Markets and Securities Technology organisation, purposefully aligned to Hong Kong’s business',
    'hub – with direct accountability for up to 2,000 engineers spanning Equities, FX, Fixed Income, Market',
    'Operations, and Securities Services asset classes across design, build, and run functions.',
    '– Defined and executed a multi-year strategy to deepen the centre’s strategic value within the global Markets',
    'and Securities Technology organisation – elevating engineering ownership from component-level delivery',
    'to full front-to-back platform accountability across design, build, and run, and strengthening its integration',
    'as a high-value partner to Hong Kong business operations.',
    'Director, Global Head of FX Prime Brokerage & Head of GFX IT China',
    'HSBC Jan 2017 – May 2018',
    '– Directed a global delivery organisation (UK, HK, Guangzhou) ensuring robust support for FX Prime',
    'Brokerage global business including Margin Risk Management capabilities.'
  ].join('\n'));

  assert.ok(employmentHistory.length >= 3);
  assert.deepEqual(employmentHistory[0], {
    job_title: 'Director, Global Head of Client & Market Connectivity and Head of Equities & Cross Asset Finance IT',
    company_name: 'HSBC',
    start_date: '2023',
    end_date: 'Present',
    responsibilities: [
      {
        responsibility: 'Dual-mandate technology executive within Global Equities – functionally leading Client and Market Connectivity teams across AMER, EMEA, and APAC, while directly managing the Equities IT China engineering hub in Guangzhou. Accountable for global platform modernisation, cross-regional technology delivery, and 24/7 production operations across APAC, EMEA, and AMER.'
      },
      {
        responsibility: 'Defined and executed modernisation strategy for high-volume, real-time transactional platforms, transitioning legacy components to scalable, resilient target architectures while ensuring zero business disruption across jurisdictions.'
      },
      {
        responsibility: 'Governed end-to-end architecture across client onboarding, order routing, market gateway integration, data distribution, and infrastructure layers.'
      }
    ]
  });
  assert.deepEqual(employmentHistory[1], {
    job_title: 'Director, Head of Markets Securities Services IT China and Head of Equities & Securities Finance IT',
    company_name: 'HSBC',
    start_date: '2018',
    end_date: '2023',
    responsibilities: [
      {
        responsibility: 'Executive leadership role heading the Guangzhou strategic nearshore delivery centre – a core component of HSBC’s global Markets and Securities Technology organisation, purposefully aligned to Hong Kong’s business hub – with direct accountability for up to 2,000 engineers spanning Equities, FX, Fixed Income, Market Operations, and Securities Services asset classes across design, build, and run functions.'
      },
      {
        responsibility: 'Defined and executed a multi-year strategy to deepen the centre’s strategic value within the global Markets and Securities Technology organisation – elevating engineering ownership from component-level delivery to full front-to-back platform accountability across design, build, and run, and strengthening its integration as a high-value partner to Hong Kong business operations.'
      }
    ]
  });
  assert.deepEqual(employmentHistory[2], {
    job_title: 'Director, Global Head of FX Prime Brokerage & Head of GFX IT China',
    company_name: 'HSBC',
    start_date: '2017',
    end_date: '2018',
    responsibilities: [
      {
        responsibility: 'Directed a global delivery organisation (UK, HK, Guangzhou) ensuring robust support for FX Prime Brokerage global business including Margin Risk Management capabilities.'
      }
    ]
  });
});

test('employment history parses date-first company groups with multiple dated roles and shared responsibilities', () => {
  const employmentHistory = buildEmploymentHistory([
    'Shawn Cong',
    'Shanghai',
    '',
    'PROFESSIONAL EXPERIENCE',
    '2018.03 - Present Hays Specialist Recruitment',
    '2021.07 - Present Team Manager, Corporate & Digital IT & Cyber Security',
    '2018.11 - 2021.06 Senior Consultant',
    '2018.03 - 2018.11 Consultant',
    'Responsibilities:',
    'Talent Acquisition:',
    '• Delivered end-to-end recruitment for IT and Digital leadership and specialist roles.',
    '• Built long-term partnerships with enterprise clients across Healthcare and Financial Services.',
    'Team Leadership & Development:',
    '• Led, trained, and developed 3 consultants.',
    '2016.05 - 2018.01 Robert Walters China',
    '2016.05 - 2018.01 Consultant',
    'Responsibilities:',
    '• Conducted 360-degree recruitment for front and middle office roles.',
    '2015.01 - 2016.01 Allegis Group China',
    '2015.01 - 2016.01 Associate Consultant',
    'Responsibilities:',
    '• Focused on sourcing and recruiting software engineering talent.'
  ].join('\n'));

  assert.equal(employmentHistory.length, 5);
  assert.deepEqual(employmentHistory[0], {
    job_title: 'Team Manager, Corporate & Digital IT & Cyber Security',
    company_name: 'Hays Specialist Recruitment',
    start_date: '2021',
    end_date: 'Present',
    responsibilities: [
      {
        responsibility: 'Delivered end-to-end recruitment for IT and Digital leadership and specialist roles.'
      },
      {
        responsibility: 'Built long-term partnerships with enterprise clients across Healthcare and Financial Services.'
      },
      {
        responsibility: 'Led, trained, and developed 3 consultants.'
      }
    ]
  });
  assert.deepEqual(employmentHistory[1], {
    job_title: 'Senior Consultant',
    company_name: 'Hays Specialist Recruitment',
    start_date: '2018',
    end_date: '2021',
    responsibilities: []
  });
  assert.deepEqual(employmentHistory[2], {
    job_title: 'Consultant',
    company_name: 'Hays Specialist Recruitment',
    start_date: '2018',
    end_date: '2018',
    responsibilities: []
  });
  assert.deepEqual(employmentHistory[3], {
    job_title: 'Consultant',
    company_name: 'Robert Walters China',
    start_date: '2016',
    end_date: '2018',
    responsibilities: [
      {
        responsibility: 'Conducted 360-degree recruitment for front and middle office roles.'
      }
    ]
  });
  assert.deepEqual(employmentHistory[4], {
    job_title: 'Associate Consultant',
    company_name: 'Allegis Group China',
    start_date: '2015',
    end_date: '2016',
    responsibilities: [
      {
        responsibility: 'Focused on sourcing and recruiting software engineering talent.'
      }
    ]
  });
});

test('employment history parses company-role-date inline entries and separate key projects sections', () => {
  const templateData = buildTemplateData({
    summary: [
      'Candidate: Eugene Liu',
      'Target Role: Blockchain Developer',
      '',
      '## Fit Summary',
      'Strong fit for the role.'
    ].join('\n'),
    cvDocument: {
      text: [
        'Eugene Liu',
        '',
        'Professional Experience',
        'Delulu | Backend Engineer | Jan 2024 - Present',
        'Tech Stack: Golang, Solidity, PostgreSQL, GraphQL, gRPC.',
        'Developed RFQ smart contracts supporting internal and external market makers.',
        'Implemented advanced trading systems including copy trading and limit orders.',
        'Galxe | Golang Engineer | Apr 2022 - Jan 2024',
        'Tech Stack: Golang, Solidity, PostgreSQL, GraphQL, gRPC.',
        '.',
        'Built contract service abstraction layer for secure contract interaction.',
        'Contributed to Solana smart contract development and migration.',
        'NFTGO | Golang Engineer | May 2021 - Apr 2022',
        'Built whale transaction monitoring system for real-time event ingestion.',
        '',
        'Key Projects',
        'High Performance Blockchain Relayer and Indexer',
        '.',
        'Designed configurable event indexing framework supporting custom ABI decoding.',
        '.',
        'Implemented secure private key management using Secret Manager.',
        'Low-Latency Solana Transaction Engine',
        '.',
        'Reduced transaction latency from seconds to milliseconds using optimized relayer routing.'
      ].join('\n'),
      file: {
        name: 'cv4-3.pdf'
      }
    },
    jdDocument: {
      text: 'Job Title: Blockchain Developer\nCompany: Atomic Group',
      file: {
        name: 'jd4.docx'
      }
    }
  });

  assert.equal(templateData.employment_history.length, 3);
  assert.deepEqual(templateData.employment_history[0], {
    job_title: 'Backend Engineer',
    company_name: 'Delulu',
    start_date: '2024',
    end_date: 'Present',
    responsibilities: [
      {
        responsibility: 'Developed RFQ smart contracts supporting internal and external market makers. Implemented advanced trading systems including copy trading and limit orders.'
      }
    ]
  });
  assert.equal(templateData.employment_experience_entries[0].employment_start_date, '2024');
  assert.match(
    templateData.employment_experience_entries[0].responsibility_bullets[0].responsibility_text,
    /Developed RFQ smart contracts supporting internal and external market makers\./
  );
  assert.equal(templateData.project_experience_entries.length, 2);
  assert.equal(
    templateData.project_experience_entries[0].project_name,
    'High Performance Blockchain Relayer and Indexer'
  );
  assert.match(
    templateData.project_experience_entries[0].project_bullets[0].project_bullet_text,
    /Designed configurable event indexing framework supporting custom ABI decoding\./
  );
});

test('validateWordTemplateContract accepts revised report-template loop tags', () => {
  const contract = validateWordTemplateContract({
    supportedDetectedTags: [
      'candidate_name',
      'role_title',
      'candidate_summary',
      '#employment_experience_entries',
      '#responsibility_bullets',
      'responsibility_text',
      '#education_entries',
      'degree_name'
    ]
  });

  assert.equal(contract.isValid, true);
  assert.deepEqual(contract.missingRequiredLogicalTagGroups, []);
  assert.deepEqual(contract.optionalSeparatorIssues, []);
  assert.ok(contract.resolvedLogicalTags.includes('employment_experience_entries'));
  assert.ok(contract.repeatableLogicalTags.includes('project_experience_entries'));
});

test('Chinese date-leading work history does not leak education lines into location and keeps responsibilities inside the work section', () => {
  const cvText = [
    'Noah Zhang',
    '教育背景',
    '2022.09-2024.06 Johns Hopkins University Electrical and Computer Engineering（GPA:3.7/4）| 硕士',
    '2017.09–2022.06 中国科学院大学 电子信息工程（GPA:3.7/4）| 本科',
    '工作经历',
    '2024.07-2025.05 Sparksoft（ 技 术 研 发 部 ） 软件工程师',
    'l 使用 Go 语言参与构建公司核心订单处理服务，负责设计与开发 RESTful API、业务逻辑层与后台任务模块；借助标准库',
    '及第三方框架（如 Gin/go-zero）实现高并发请求处理，提高系统稳定性与代码可维护性。',
    'l 在电商订单系统中主导实现订单创建、库存扣减与支付状态变更等功能；利用 Redis 缓存 优化热点数据访问并结合',
    'Kafka 消息队列 解耦订单生命周期事件处理，确保在促销高峰期下单流程稳定且具备良好扩展性。',
    'l 负责关系型数据库（MySQL/PostgreSQL）表结构设计、复杂 SQL 优化和事务控制，配合分布式锁机制确保订单与库存',
    '一致性，并参与日志追踪、监控与 CI/CD 部署流程建设，提高系统可观测性与运维效率。',
    '项目经历',
    '基于 Solana 生态的 DEX 聚合器',
    'l 交易解析: 使用 go-zero 框架构建 consumer 服务解析 Solana 链上交易。'
  ].join('\n');

  const profile = extractDocumentDerivedProfile({
    cvDocument: {
      text: cvText,
      file: {
        name: 'candidate-cv.pdf'
      }
    },
    jdDocument: {
      text: '职位：区块链开发工程师',
      file: {
        name: 'role-jd.docx'
      }
    }
  });

  assert.equal(profile.candidateLocation, '');
  assert.equal(profile.employmentHistory.length, 1);
  assert.deepEqual(profile.employmentHistory[0], {
    jobTitle: '软件工程师',
    companyName: 'Sparksoft（ 技 术 研 发 部 ）',
    startDate: '2024',
    endDate: '2025',
    responsibilities: [
      '使用 Go 语言参与构建公司核心订单处理服务，负责设计与开发 RESTful API、业务逻辑层与后台任务模块；借助标准库 及第三方框架（如 Gin/go-zero）实现高并发请求处理，提高系统稳定性与代码可维护性。',
      '在电商订单系统中主导实现订单创建、库存扣减与支付状态变更等功能；利用 Redis 缓存 优化热点数据访问并结合 Kafka 消息队列 解耦订单生命周期事件处理，确保在促销高峰期下单流程稳定且具备良好扩展性。',
      '负责关系型数据库（MySQL/PostgreSQL）表结构设计、复杂 SQL 优化和事务控制，配合分布式锁机制确保订单与库存 一致性，并参与日志追踪、监控与 CI/CD 部署流程建设，提高系统可观测性与运维效率。'
    ]
  });
});

test('extractExperienceHistory parses Chinese date-only rows followed by company and role lines', () => {
  const employmentHistory = extractExperienceHistory([
    '工作教育经历',
    '2016/06 --至今',
    '西安软通动力技术服务有限公司 | JAVA 高级工程师',
    '2012/05 --2016/05',
    '西安华为技术研究所 | JAVA 工程师',
    '2009/09 --2012/03',
    '西北大学| 硕士 | 计算机技术'
  ]);

  assert.deepEqual(employmentHistory, [
    {
      jobTitle: 'JAVA 高级工程师',
      companyName: '西安软通动力技术服务有限公司',
      startDate: '2016',
      endDate: '至今',
      responsibilities: []
    },
    {
      jobTitle: 'JAVA 工程师',
      companyName: '西安华为技术研究所',
      startDate: '2012',
      endDate: '2016',
      responsibilities: []
    }
  ]);
});

test('extractEducationEntries keeps compact Chinese degree rows and ignores scholarship or project noise', () => {
  const educationEntries = extractEducationEntries([
    '西安邮电大学 本科 计算机科学与技术 2016-2020',
    '2017年-2019年 连续三年获得二等奖学金',
    '2017年 acm校赛铜奖 2017年 蓝桥杯陕西赛区二等奖 2019年 acm校赛银奖',
    '游信-精品游戏推荐 iOS客户端开发 2020.08-2021.10'
  ]);

  assert.deepEqual(educationEntries, [
    {
      degreeName: '本科 | 计算机科学与技术',
      university: '西安邮电大学',
      startYear: '2016',
      endYear: '2020'
    }
  ]);
});

test('extractEducationEntries keeps consecutive delayed English degree rows without skipping the second entry', () => {
  const educationEntries = extractEducationEntries([
    'MSc in Computing',
    'Cardiff University, UK | 2019 – 2020',
    'Bachelor of Business Administration (BBA)',
    'Jincheng College, Nanjing University of Aeronautics and Astronautics | 2012 – 2016'
  ]);

  assert.deepEqual(educationEntries, [
    {
      degreeName: 'MSc in Computing',
      university: 'Cardiff University, UK',
      startYear: '2019',
      endYear: '2020'
    },
    {
      degreeName: 'Bachelor of Business Administration (BBA)',
      university: 'Jincheng College, Nanjing University of Aeronautics and Astronautics',
      startYear: '2012',
      endYear: '2016'
    }
  ]);
});

test('extractEducationEntries parses date-university-degree triplets from legacy report CVs', () => {
  const educationEntries = extractEducationEntries([
    '2025 .04– 2026.03',
    'CCT College Dublin Ireland',
    'MSc in Cybersecurity',
    '2003 – 2007',
    'Tianjin University (985)',
    'BSc in Software Engineering'
  ]);

  assert.deepEqual(educationEntries, [
    {
      degreeName: 'MSc in Cybersecurity',
      university: 'CCT College Dublin Ireland',
      startYear: '2025',
      endYear: '2026'
    },
    {
      degreeName: 'BSc in Software Engineering',
      university: 'Tianjin University (985)',
      startYear: '2003',
      endYear: '2007'
    }
  ]);
});

test('extractEducationEntries keeps compact BS degree rows alongside MSc rows', () => {
  const educationEntries = extractEducationEntries([
    '2013.09-2014.12 Coventry University (UK) MSc in International Business',
    '2009.09-2013.07 Changchun University of Science and Technology BS in Mechatronic Engineering'
  ]);

  assert.deepEqual(educationEntries, [
    {
      degreeName: 'MSc in International Business',
      university: 'Coventry University (UK)',
      startYear: '2013',
      endYear: '2014'
    },
    {
      degreeName: 'BS in Mechatronic Engineering',
      university: 'Changchun University of Science and Technology',
      startYear: '2009',
      endYear: '2013'
    }
  ]);
});

test('extractEducationEntries parses single-line institution-degree-date rows without merging lab experience', () => {
  const educationEntries = extractEducationEntries([
    'Tongji University Control Engineering Master July 2013 – June2016',
    'Infineon &Vector Lab at Tongji University Software Development (AUTOSAR CP) 2015.07 – 2016.07',
    'Yancheng Institute of Technology Automobile Service Engineering Bachelor Sept 2009 – July 2013'
  ]);

  assert.deepEqual(educationEntries, [
    {
      degreeName: 'Control Engineering Master',
      university: 'Tongji University',
      startYear: '2013',
      endYear: '2016'
    },
    {
      degreeName: 'Automobile Service Engineering Bachelor',
      university: 'Yancheng Institute of Technology',
      startYear: '2009',
      endYear: '2013'
    }
  ]);
});

test('extractEducationEntries parses summary-style degree-date-institution lines', () => {
  const educationEntries = extractEducationEntries([
    'Bachelor, 2009-2013 Guangdong University of Finance, China',
    'Master, 2013-2015 The George Washington University, Washington DC, USA'
  ]);

  assert.deepEqual(educationEntries, [
    {
      degreeName: 'Bachelor',
      university: 'Guangdong University of Finance, China',
      startYear: '2009',
      endYear: '2013'
    },
    {
      degreeName: 'Master',
      university: 'The George Washington University, Washington DC, USA',
      startYear: '2013',
      endYear: '2015'
    }
  ]);
});

test('extractExperienceHistory parses date-company-role triplets from report-style employment sections', () => {
  const employmentHistory = extractExperienceHistory([
    'Jun 2022 – Mar 2025',
    'SIE Co., Ltd',
    'Cloud Solution Architect & Team Lead',
    'Led migration of legacy enterprise systems to AWS.',
    'Dec 2020 – May 2022',
    'Intelligence Technology Co., Ltd',
    'Solution Architect',
    'Designed SaaS-based AIOps platform integrating Prometheus and Zabbix.'
  ]);

  assert.deepEqual(employmentHistory, [
    {
      jobTitle: 'Cloud Solution Architect & Team Lead',
      companyName: 'SIE Co., Ltd',
      startDate: '2022',
      endDate: '2025',
      responsibilities: [
        'Led migration of legacy enterprise systems to AWS.'
      ]
    },
    {
      jobTitle: 'Solution Architect',
      companyName: 'Intelligence Technology Co., Ltd',
      startDate: '2020',
      endDate: '2022',
      responsibilities: [
        'Designed SaaS-based AIOps platform integrating Prometheus and Zabbix.'
      ]
    }
  ]);
});

test('extractExperienceHistory parses company-date-role lines with embedded dates and location text', () => {
  const employmentHistory = extractExperienceHistory([
    'Bet365 Nov 2022 - April 2025, Manchester Senior Test Engineer',
    'LMS August 2021— Nov 2022,Manchester Senior Engineer - QA (Contract)',
    'July 2022 - Feb 2025 DoorDash, San Francisco, California, USA Software Engineer'
  ]);

  assert.deepEqual(employmentHistory, [
    {
      jobTitle: 'Senior Test Engineer',
      companyName: 'Bet365',
      startDate: '2022',
      endDate: '2025',
      responsibilities: []
    },
    {
      jobTitle: 'Senior Engineer - QA (Contract)',
      companyName: 'LMS',
      startDate: '2021',
      endDate: '2022',
      responsibilities: []
    },
    {
      jobTitle: 'Software Engineer',
      companyName: 'DoorDash',
      startDate: '2022',
      endDate: '2025',
      responsibilities: []
    }
  ]);
});

test('extractExperienceHistory parses open-ended date-company-role triplets from report summaries', () => {
  const employmentHistory = extractExperienceHistory([
    'April 2022 –',
    'Intel',
    'Senior Infrastructure Service Engineer',
    'Software release system enabling and roadmap definition.'
  ]);

  assert.deepEqual(employmentHistory, [
    {
      jobTitle: 'Senior Infrastructure Service Engineer',
      companyName: 'Intel',
      startDate: '2022',
      endDate: 'Present',
      responsibilities: [
        'Software release system enabling and roadmap definition.'
      ]
    }
  ]);
});

test('buildTemplateData parses Simplified Chinese summary headings for Word-template fields', () => {
  const templateData = buildTemplateData({
    summary: [
      '候选人：张伟',
      '目标职位：技术负责人',
      '',
      '## 匹配概述',
      '候选人与岗位具有较强匹配度。',
      '',
      '## 相关经验',
      '- 负责平台现代化改造',
      '',
      '## 与关键要求的匹配',
      '- 技术领导力 -> 负责区域工程团队',
      '',
      '## 潜在顾虑 / 差距',
      '- 暂缺直接保险行业经验',
      '',
      '## 建议下一步',
      '建议进入用人经理评审。'
    ].join('\n'),
    cvDocument: {
      text: [
        '张伟',
        '上海',
        '',
        '工作经历',
        '技术总监',
        '汇丰',
        '2020 - 至今',
        '- 负责平台转型'
      ].join('\n'),
      file: {
        name: 'candidate-cv.pdf'
      }
    },
    jdDocument: {
      text: '职位：技术负责人\n公司：原子集团',
      file: {
        name: 'role-jd.pdf'
      }
    }
  });

  assert.equal(templateData.candidate_name, '张伟');
  assert.equal(templateData.role_title, '技术负责人');
  assert.equal(templateData.fit_summary, '候选人与岗位具有较强匹配度。');
  assert.match(templateData.match_requirements, /技术领导力 -> 负责区域工程团队/);
  assert.equal(templateData.recommended_next_step, '建议进入用人经理评审。');
});

test('buildTemplateData consolidates multiple languages and education entries for template rendering', () => {
  const templateData = buildTemplateData({
    summary: [
      'Candidate: Alex Wong',
      'Target Role: Head of Technology',
      '',
      '## Fit Summary',
      'Strong fit for the role.'
    ].join('\n'),
    cvDocument: {
      text: [
        'Alex Wong',
        'Nationality: Chinese',
        'Preferred location: Singapore',
        '',
        'Languages',
        'English',
        'Cantonese',
        'Mandarin',
        '',
        'Education',
        'BEng Computer Science',
        'HKUST',
        '2008 - 2012',
        'MBA',
        'INSEAD',
        '2016 - 2017'
      ].join('\n'),
      file: {
        name: 'candidate-cv.pdf'
      }
    },
    jdDocument: {
      text: 'Job Title: Head of Technology\nCompany: Atomic Group',
      file: {
        name: 'role-jd.pdf'
      }
    }
  });

  assert.equal(templateData.candidate_nationality, 'Chinese');
  assert.equal(templateData.candidate_preferred_location, 'Singapore');
  assert.equal(templateData.candidate_languages, 'English, Cantonese, Mandarin');
  assert.equal(templateData.education_entries.length, 2);
  assert.match(templateData.education_summary, /BEng Computer Science/);
  assert.match(templateData.education_summary, /MBA/);
});

test('extractDocumentDerivedProfile keeps compact Chinese education rows and project sections separate from skills content', () => {
  const profile = extractDocumentDerivedProfile({
    cvDocument: {
      text: [
        'Noah Zhang',
        '教育背景',
        '2022.09-2024.06 Johns Hopkins University Electrical and Computer Engineering（GPA:3.7/4）| 硕士',
        '2017.09–2022.06 中国科学院大学 电子信息工程（GPA:3.7/4）| 本科',
        '工作经历',
        '2024.07-2025.05 Sparksoft（ 技 术 研 发 部 ） 软件工程师',
        'l 使用 Go 语言参与构建公司核心订单处理服务。',
        '项目经历',
        '基 于 Solana 生 态 的 DEX 聚 合 器 使用技术：Go, MySQL, Redis, Kafka, Solana, Solidity, Geth, Foundry',
        'l 交易解析: 使用 go-zero 框架，构建 consumer 服务解析 Solana 链上交易。',
        'l 交易构造: 实现 trade 服务以提供交易订单创建。',
        '基 于 Anchor 的 PumpFun 合 约 使用技术：Rust, TypeScript, Anchor, Solana',
        'l Anchor + Rust 构建的 AMM 配置账户体系。',
        'l Bonding Curve 池子创建。',
        '技能/优势及其他',
        'l 语言：Go, Rust, Solidity, Python',
        'l 英语：托福 113，GRE 325，可以熟练使用英语作为工作语言。'
      ].join('\n'),
      file: {
        name: 'CV4-1.pdf'
      }
    },
    jdDocument: {
      text: '职位: 区块链开发工程师',
      file: {
        name: 'JD4.docx'
      }
    }
  });

  assert.deepEqual(profile.educationEntries, [
    {
      degreeName: '硕士',
      university: 'Johns Hopkins University Electrical and Computer Engineering（GPA:3.7/4）',
      startYear: '2022',
      endYear: '2024'
    },
    {
      degreeName: '本科',
      university: '中国科学院大学 电子信息工程（GPA:3.7/4）',
      startYear: '2017',
      endYear: '2022'
    }
  ]);
  assert.equal(profile.projectExperiences.length, 2);
  assert.equal(profile.projectExperiences[0].project_name, '基 于 Solana 生 态 的 DEX 聚 合 器');
  assert.equal(profile.projectExperiences[1].project_name, '基 于 Anchor 的 PumpFun 合 约');
  assert.equal(
    profile.projectExperiences.some((entry) => /技能\/优势及其他|英语：/u.test(entry.project_name)),
    false
  );
});

test('extractDocumentDerivedProfile infers delayed English section headings without promoting wrapped bullets into projects', () => {
  const profile = extractDocumentDerivedProfile({
    cvDocument: {
      text: [
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
        'Full-Stack Web3 Engineer',
        'Shanghai, China 1993.09.23',
        'Rust Copy-Trading Arbitrage Bot & Jupiter-style Aggregator (2025.04 – 2025.08)',
        '* Built a Jupiter-style token swap aggregator on Solana',
        '* Integrated Raydium, Pump.fun AMM, PumpSwap, Meteora, Raydium CPMM, and Meteora DLMM',
        '* Developed a high-performance Rust copy-trading and arbitrage bot tracking KOL wallets, smart',
        'money, and sniper traders',
        '* Connected to Yellowstone Geyser nodes for real-time on-chain data streaming',
        'Work Experience',
        'Education',
        'Projects',
        'Pongolo Tequila RWA Project (2025.01 – 2025.03)',
        '* Developed the Pongolo brand website and admin management system',
        '* Tokenized Pongolo tequila barrels as real-world assets (RWA) on-chain',
        'Pumpfun Meme Character Livestream & AI Agent (2024.08 – 2024.12)',
        '* Built a Unity-based cartoon meme character livestreaming on YouTube, Twitch, and Kick',
        '* Implemented real-time voice interaction using Azure TTS with animated actions such as singing and',
        'dancing',
        'Lottery Drawer App (Personal Project)',
        '* Developed a lottery drawing utility app with multiple selection modes, configurable draws, data',
        'upload, save and update features, user registration/login, and message board'
      ].join('\n'),
      file: {
        name: 'CV4-2.pdf'
      }
    },
    jdDocument: {
      text: '职位: 区块链开发工程师',
      file: {
        name: 'JD4.docx'
      }
    }
  });

  assert.deepEqual(profile.educationEntries, [
    {
      degreeName: 'MSc in Computing',
      university: 'Cardiff University, UK',
      startYear: '2019',
      endYear: '2020'
    },
    {
      degreeName: 'Bachelor of Business Administration (BBA)',
      university: 'Jincheng College, Nanjing University of Aeronautics and Astronautics',
      startYear: '2012',
      endYear: '2016'
    }
  ]);
  assert.deepEqual(
    profile.employmentHistory.map((entry) => ({
      companyName: entry.companyName,
      jobTitle: entry.jobTitle,
      startDate: entry.startDate,
      endDate: entry.endDate
    })),
    [
      {
        companyName: 'Shanghai Xiaohan Technology Co., Ltd.',
        jobTitle: 'Blockchain Engineer',
        startDate: '2021',
        endDate: '2025'
      },
      {
        companyName: 'Wanxiang Blockchain Inc., Shanghai',
        jobTitle: 'Blockchain Engineer',
        startDate: '2021',
        endDate: '2021'
      },
      {
        companyName: 'Shanghai Tancheng Data Technology Co., Ltd.',
        jobTitle: 'Full-Stack Engineer',
        startDate: '2020',
        endDate: '2021'
      },
      {
        companyName: 'Shanghai Baoxiang Financial Information Service Co., Ltd.',
        jobTitle: 'Full-Stack Engineer',
        startDate: '2016',
        endDate: '2019'
      },
      {
        companyName: 'Shanghai Chahe Interactive Network Technology Co., Ltd.',
        jobTitle: 'Android Engineer',
        startDate: '2015',
        endDate: '2016'
      }
    ]
  );
  assert(profile.projectExperiences.some((entry) => entry.project_name === 'Rust Copy-Trading Arbitrage Bot & Jupiter-style Aggregator'));
  assert(profile.projectExperiences.some((entry) => entry.project_name === 'Pongolo Tequila RWA Project'));
  assert(profile.projectExperiences.some((entry) => entry.project_name === 'Pumpfun Meme Character Livestream & AI Agent'));
  assert(profile.projectExperiences.some((entry) => entry.project_name === 'Lottery Drawer App (Personal Project)'));
  assert.equal(
    profile.projectExperiences.some((entry) => /^(dancing|of \$5M|money, and sniper traders|downloads\*\*|features|smart contracts)$/i.test(entry.project_name)),
    false
  );
  assert.equal(
    profile.projectExperiences.some((entry) =>
      (entry.project_bullets || []).some((bullet) => /Work Experience|Education|Projects/.test(bullet))
    ),
    false
  );
});

test('extractDocumentDerivedProfile does not promote education or certificate rows into fallback projects for report-style CVs', () => {
  const profile = extractDocumentDerivedProfile({
    cvDocument: {
      text: [
        'Confidential Candidate Report',
        'Name: Peng Wang王鹏',
        'Position: Associate Director, Software Engineering Specialist',
        'Candidate Summary',
        'Name',
        'Peng Wang王鹏',
        'Current Residence',
        'Chengdu',
        'Education',
        '2001-2004',
        'Beihang University (985)',
        'Master of Computer-Aided Design and Manufacturing',
        '1997-2001',
        'Hefei University of Technology (211)',
        'Bachelor of Materials Science and Engineering',
        'Certificate',
        'CET-6 Alibaba Cloud ACP',
        'Summary',
        'Solid foundation in software testing theory; proficient in UI, API, and performance test automation.',
        'Employment Experience',
        '2021.10-2025.10',
        'Huawei',
        'Test System Engineer'
      ].join('\n'),
      file: {
        name: 'Peng Wang王鹏-Test Automation Architect-Atomic-2026.1.30.docx'
      }
    },
    jdDocument: {
      text: 'Job Title: Senior Software Engineering Manager : 0000K19E',
      file: {
        name: 'HSBC JD - Senior Software Engineering Manager.docx'
      }
    }
  });

  assert.deepEqual(profile.projectExperiences, []);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTemplateData, extractDocumentDerivedProfile } = require('../../services/hiring-manager-template-service');

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

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTemplateData } = require('../../services/hiring-manager-template-service');

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

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveWordReportAdapter,
  buildWordReportAdapterPayload,
  validateWordReportAdapterCompatibility
} = require('../../services/word-report-adapter-service');

function createBriefing() {
  return {
    candidate: {
      name: 'Alice Zhang',
      title: 'Senior Engineering Manager',
      current_location: 'Hong Kong',
      preferred_location: 'Singapore',
      nationality: 'Chinese',
      date_of_birth: '',
      notice_period: '1 month',
      languages: ['English', 'Mandarin'],
      skills: ['Java', 'AWS'],
      certifications: ['AWS Solutions Architect'],
      education: [
        {
          degree: 'MSc in Computing',
          university: 'University of Hong Kong',
          start_year: '2012',
          end_year: '2014'
        }
      ]
    },
    role: {
      title: 'Group CTO'
    },
    fit_summary: 'Strong fit for the target role.',
    relevant_experience: ['Built and led engineering teams across APAC.'],
    match_requirements: [
      {
        requirement: 'Leadership',
        evidence: 'Led platform and delivery teams.'
      }
    ],
    potential_concerns: ['None noted.'],
    recommended_next_step: 'Proceed to hiring manager interview.',
    employment_history: [
      {
        job_title: 'Engineering Director',
        company_name: 'HSBC',
        start_date: '2020',
        end_date: 'Present',
        responsibilities: ['Led regional engineering delivery.']
      }
    ],
    project_experiences: [
      {
        project_name: 'Core Banking Modernization',
        project_summary: 'Modernized customer onboarding and payment rails.',
        project_start_date: '2021',
        project_end_date: '2023',
        project_timeline_basis: 'employment-linked',
        linked_job_title: 'Engineering Director',
        linked_company_name: 'HSBC',
        project_bullets: ['Delivered staged migration without service disruption.']
      }
    ]
  };
}

test('resolveWordReportAdapter recognizes the active revised hiring-manager template', () => {
  const resolution = resolveWordReportAdapter({
    templateName: 'Atomic_Revised_Candidate_Report.dotx',
    templatePath: '/tmp/candidate-summary-template.dotx'
  });

  assert.equal(resolution.isCompatible, true);
  assert.equal(resolution.adapterId, 'atomic-hiring-manager-report');
  assert.equal(resolution.adapterVersion, '1.0');
  assert.equal(resolution.templateIdentity, 'atomic_revised_candidate_report');
});

test('resolveWordReportAdapter recognizes the legacy fixture template alias for the same adapter', () => {
  const resolution = resolveWordReportAdapter({
    templateName: 'AtomicGroupCV_Template.dotx',
    templatePath: '/tmp/AtomicGroupCV_Template.dotx'
  });

  assert.equal(resolution.isCompatible, true);
  assert.equal(resolution.templateIdentity, 'atomicgroupcv_template');
});

test('resolveWordReportAdapter recognizes the deterministic e2e sample template alias', () => {
  const resolution = resolveWordReportAdapter({
    templateName: 'hiring-manager-template.docx',
    templatePath: '/tmp/hiring-manager-template.docx'
  });

  assert.equal(resolution.isCompatible, true);
  assert.equal(resolution.templateIdentity, 'hiring_manager_template');
});

test('resolveWordReportAdapter rejects unsupported Word templates explicitly', () => {
  const resolution = resolveWordReportAdapter({
    templateName: 'Client_Custom_Template.dotx',
    templatePath: '/tmp/Client_Custom_Template.dotx'
  });

  assert.equal(resolution.isCompatible, false);
  assert.match(resolution.errors[0], /not supported by the active report adapter/i);
});

test('validateWordReportAdapterCompatibility rejects templates missing required logical groups', () => {
  const adapter = resolveWordReportAdapter({
    templateName: 'Atomic_Revised_Candidate_Report.dotx'
  });
  const compatibility = validateWordReportAdapterCompatibility({
    adapter,
    templateInspection: {
      resolvedLogicalTags: ['candidate_name', 'role_title', 'candidate_summary']
    },
    templateContract: {
      missingRequiredLogicalTagGroups: [['employment_history', 'employment_experience_entries']]
    }
  });

  assert.equal(compatibility.isCompatible, false);
  assert.match(compatibility.errors.join(' '), /missing report-contract placeholder groups/i);
});

test('buildWordReportAdapterPayload returns adapter metadata and template payload for export', () => {
  const adapter = resolveWordReportAdapter({
    templateName: 'Atomic_Revised_Candidate_Report.dotx'
  });
  const payload = buildWordReportAdapterPayload({
    adapter,
    briefing: createBriefing(),
    recruiterSummary: [
      '## Fit Summary',
      'Strong fit for the target role.',
      '',
      '## Relevant Experience',
      'Built and led engineering teams across APAC.',
      '',
      '## Match Against Key Requirements',
      'Leadership: Led platform and delivery teams.',
      '',
      '## Potential Concerns / Gaps',
      'None noted.',
      '',
      '## Recommended Next Step',
      'Proceed to hiring manager interview.'
    ].join('\n'),
    outputLanguage: 'en'
  });

  assert.equal(payload.adapterId, 'atomic-hiring-manager-report');
  assert.equal(payload.adapterVersion, '1.0');
  assert.equal(payload.templateIdentity, 'atomic_revised_candidate_report');
  assert.equal(payload.templateData.candidate_name, 'Alice Zhang');
  assert.equal(payload.templateData.role_title, 'Group CTO');
  assert.equal(payload.templateData.employment_experience_entries.length, 1);
  assert.equal(payload.templateData.project_experience_entries.length, 1);
  assert.equal(payload.templateData.education_field_institution_line, 'Computing | University of Hong Kong');
  assert.equal(payload.templateData.education_entries[0].education_field_institution_line, 'Computing | University of Hong Kong');
  assert.equal(payload.templateData.project_role_company_line, 'Engineering Director | HSBC');
  assert.equal(payload.templateData.project_experience_entries[0].project_role_company_line, 'Engineering Director | HSBC');
  assert.deepEqual(payload.validationOptions.forbiddenRenderedTextSnippets, []);
});

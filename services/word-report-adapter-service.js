const path = require('node:path');

const {
  prepareHiringManagerBriefingOutput
} = require('./briefing-service');

const WORD_REPORT_ADAPTER_PAYLOAD_VERSION = '1.0';

const ACTIVE_WORD_REPORT_ADAPTER = Object.freeze({
  adapterId: 'atomic-hiring-manager-report',
  adapterVersion: '1.0',
  payloadVersion: WORD_REPORT_ADAPTER_PAYLOAD_VERSION,
  supportedTemplateNames: Object.freeze([
    'atomic_revised_candidate_report',
    'atomicgroupcv_template'
  ]),
  requiredLogicalTagGroups: Object.freeze([
    Object.freeze(['candidate_name']),
    Object.freeze(['role_title']),
    Object.freeze(['candidate_summary', 'fit_summary']),
    Object.freeze(['employment_history', 'employment_experience', 'employment_experience_entries', 'relevant_experience'])
  ])
});

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTemplateIdentity(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/\.(docx|dotx)$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveWordReportAdapter({ templatePath = '', templateName = '' } = {}) {
  const normalizedName = normalizeTemplateIdentity(templateName);
  const normalizedBaseName = normalizeTemplateIdentity(path.basename(templatePath || ''));
  const resolvedTemplateName = normalizedName || normalizedBaseName;
  const matched = ACTIVE_WORD_REPORT_ADAPTER.supportedTemplateNames.includes(resolvedTemplateName);

  return {
    adapterId: ACTIVE_WORD_REPORT_ADAPTER.adapterId,
    adapterVersion: ACTIVE_WORD_REPORT_ADAPTER.adapterVersion,
    payloadVersion: ACTIVE_WORD_REPORT_ADAPTER.payloadVersion,
    templateName: cleanLine(templateName) || path.basename(templatePath || ''),
    templateIdentity: resolvedTemplateName,
    isCompatible: matched,
    errors: matched
      ? []
      : [
        'The configured hiring-manager Word template is not supported by the active report adapter.'
      ]
  };
}

function validateWordReportAdapterCompatibility({
  adapter,
  templateInspection = {},
  templateContract = {}
} = {}) {
  if (!adapter || adapter.isCompatible !== true) {
    return {
      isCompatible: false,
      errors: ['A compatible Word report adapter is required.']
    };
  }

  const resolvedLogicalTagSet = new Set(templateInspection.resolvedLogicalTags || []);
  const missingAdapterTagGroups = (adapter.requiredLogicalTagGroups || [])
    .filter((group) => !group.some((tag) => resolvedLogicalTagSet.has(tag)));
  const missingContractGroups = Array.isArray(templateContract.missingRequiredLogicalTagGroups)
    ? templateContract.missingRequiredLogicalTagGroups
    : [];
  const errors = [];

  if (missingAdapterTagGroups.length > 0) {
    errors.push(
      `The configured template is missing adapter-required placeholder groups: ${missingAdapterTagGroups.map((group) => group.map((tag) => `{{${tag}}}`).join(' or ')).join(', ')}.`
    );
  }

  if (missingContractGroups.length > 0) {
    errors.push(
      `The configured template is missing report-contract placeholder groups: ${missingContractGroups.map((group) => group.map((tag) => `{{${tag}}}`).join(' or ')).join(', ')}.`
    );
  }

  return {
    isCompatible: errors.length === 0,
    errors,
    missingAdapterTagGroups,
    missingContractGroups
  };
}

function buildWordReportValidationOptions(templateData = {}) {
  const forbiddenRenderedTextSnippets = [];
  const candidateName = cleanLine(templateData.candidate_name);
  const originalName = cleanLine(templateData.candidate_original_name);
  const englishName = cleanLine(templateData.candidate_english_name);

  if (/^anonymous candidate$/i.test(candidateName)) {
    if (originalName && !/^anonymous candidate$/i.test(originalName)) {
      forbiddenRenderedTextSnippets.push(originalName);
    }

    if (englishName && !/^anonymous candidate$/i.test(englishName)) {
      forbiddenRenderedTextSnippets.push(englishName);
    }
  }

  return {
    forbiddenRenderedTextSnippets
  };
}

function buildWordReportAdapterPayload({
  adapter,
  briefing,
  recruiterSummary = '',
  outputLanguage = 'en'
}) {
  if (!adapter || adapter.isCompatible !== true) {
    throw new Error('A compatible Word report adapter is required before building the report payload.');
  }

  const preparedOutput = prepareHiringManagerBriefingOutput({
    briefing,
    recruiterSummary,
    outputLanguage
  });

  return {
    adapterId: adapter.adapterId,
    adapterVersion: adapter.adapterVersion,
    payloadVersion: adapter.payloadVersion,
    templateIdentity: adapter.templateIdentity,
    review: preparedOutput.review,
    briefing: preparedOutput.briefing,
    templateData: preparedOutput.templateData,
    validationOptions: buildWordReportValidationOptions(preparedOutput.templateData)
  };
}

module.exports = {
  ACTIVE_WORD_REPORT_ADAPTER,
  WORD_REPORT_ADAPTER_PAYLOAD_VERSION,
  buildWordReportAdapterPayload,
  resolveWordReportAdapter,
  validateWordReportAdapterCompatibility
};

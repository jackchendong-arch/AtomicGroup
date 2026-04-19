const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const {
  buildWordReportAdapterPayload,
  resolveWordReportAdapter
} = require('../../services/word-report-adapter-service');
const {
  EXTERNAL_FIXTURE_CASES,
  fixtureCaseHasValidContract,
  fixtureCaseIsPresent,
  getFixtureCvPath,
  getFixtureJdPath
} = require('./external-fixture-registry');

const REPRESENTATIVE_FIXTURE_NAMES = new Set(['Test1', 'Test4', 'Test7']);

for (const fixtureCase of EXTERNAL_FIXTURE_CASES) {
  if (!REPRESENTATIVE_FIXTURE_NAMES.has(fixtureCase.name)) {
    continue;
  }

  const fixturesPresent =
    fixtureCaseIsPresent(fixtureCase) &&
    fixtureCaseHasValidContract(fixtureCase);

  test(
    `word report adapter payload stays stable for ${fixtureCase.name}`,
    { skip: fixturesPresent ? false : 'Representative fixture documents are not available on this machine.' },
    async () => {
      const cvDocument = await importDocument(getFixtureCvPath(fixtureCase));
      const jdDocument = await importDocument(getFixtureJdPath(fixtureCase));
      const briefing = buildFallbackBriefing({
        cvDocument,
        jdDocument,
        outputLanguage: 'en'
      });
      const recruiterSummary = renderSummaryFromBriefing(briefing, 'en');
      const adapter = resolveWordReportAdapter({
        templateName: 'Atomic_Revised_Candidate_Report.dotx'
      });
      const payload = buildWordReportAdapterPayload({
        adapter,
        briefing,
        recruiterSummary,
        outputLanguage: 'en'
      });

      assert.equal(payload.adapterId, 'atomic-hiring-manager-report');
      assert.equal(payload.adapterVersion, '1.0');
      assert.equal(payload.payloadVersion, '1.0');
      assert.equal(payload.templateIdentity, 'atomic_revised_candidate_report');
      assert.equal(payload.templateData.candidate_name, fixtureCase.expectedCandidateName);
      assert.equal(payload.templateData.role_title, fixtureCase.expectedRoleTitle);
      assert.ok(
        payload.templateData.employment_history.length >= fixtureCase.minEmploymentHistory,
        `${fixtureCase.name} should keep the expected employment-history depth in the adapter payload`
      );
      assert.doesNotMatch(
        payload.templateData.education_field_institution_line || '',
        /^\s*\|/,
        `${fixtureCase.name} should not expose leading education separators in the adapter payload`
      );

      if (fixtureCase.name === 'Test4') {
        assert.ok(
          payload.templateData.project_experience_entries.length >= 1,
          'Chinese fixture should preserve project experience in the adapter payload'
        );
        assert.doesNotMatch(
          payload.templateData.project_experience_entries[0].project_role_company_line || '',
          /^\s*\|/,
          'Chinese fixture should not expose leading project role/company separators in the adapter payload'
        );
      }

      if (fixtureCase.name === 'Test7') {
        assert.ok(
          payload.templateData.education_entries.length >= 2,
          'Mixed-language fixture should preserve clean education rows in the adapter payload'
        );
      }
    }
  );
}

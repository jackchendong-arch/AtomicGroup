const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  buildBriefingRequest,
  prepareHiringManagerBriefingOutput,
  renderHiringManagerBriefingReviewFromBriefing,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const { buildSummaryRequest } = require('../../services/summary-service');
const {
  createTranslatableDraftPayload
} = require('../../services/draft-translation-service');
const {
  EXTERNAL_FIXTURE_CASES,
  fixtureCaseHasValidContract,
  fixtureCaseIsPresent,
  getFixtureCvPath,
  getFixtureJdPath
} = require('./external-fixture-registry');
const {
  extractDocumentDerivedProfile
} = require('../../services/hiring-manager-template-service');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const fixtureCase of EXTERNAL_FIXTURE_CASES) {
  test(
    `${fixtureCase.name} external fixture renders summary, briefing, and translation payloads`,
    {
      skip: fixtureCaseIsPresent(fixtureCase)
        ? false
        : `${fixtureCase.name} fixture documents are not available on this machine.`
    },
    async () => {
      const cvDocument = await importDocument(getFixtureCvPath(fixtureCase));
      const jdDocument = await importDocument(getFixtureJdPath(fixtureCase));

      assert.equal(cvDocument.error, null, `${fixtureCase.name} CV should import without error`);
      assert.equal(jdDocument.error, null, `${fixtureCase.name} JD should import without error`);
      assert.ok(cvDocument.text.trim().length > 0, `${fixtureCase.name} CV should yield extracted text`);
      assert.ok(jdDocument.text.trim().length > 0, `${fixtureCase.name} JD should yield extracted text`);

      const profile = extractDocumentDerivedProfile({ cvDocument, jdDocument });

      const briefingEn = buildFallbackBriefing({
        cvDocument,
        jdDocument,
        outputLanguage: 'en'
      });
      const briefingZh = buildFallbackBriefing({
        cvDocument,
        jdDocument,
        outputLanguage: 'zh'
      });

      const summaryEn = renderSummaryFromBriefing(briefingEn, 'en');
      const summaryZh = renderSummaryFromBriefing(briefingZh, 'zh');
      const reviewEn = renderHiringManagerBriefingReviewFromBriefing(briefingEn, 'en');
      const reviewZh = renderHiringManagerBriefingReviewFromBriefing(briefingZh, 'zh');
      const preparedEn = prepareHiringManagerBriefingOutput({
        briefing: briefingEn,
        recruiterSummary: summaryEn,
        outputLanguage: 'en'
      });
      const preparedZh = prepareHiringManagerBriefingOutput({
        briefing: briefingZh,
        recruiterSummary: summaryZh,
        outputLanguage: 'zh'
      });
      const translationPayload = createTranslatableDraftPayload({
        summary: summaryZh,
        briefing: briefingZh
      });

      assert.match(summaryEn, /## Fit Summary/);
      assert.match(summaryZh, /## 匹配概述/);
      assert.match(reviewEn, /## Employment Experience/);
      assert.match(reviewZh, /## 工作经历/);
      assert.doesNotMatch(summaryEn, /## 匹配概述/);
      assert.doesNotMatch(summaryZh, /## Fit Summary/);
      assert.doesNotMatch(reviewEn, /## 简报摘要/);
      assert.doesNotMatch(reviewZh, /## Briefing Summary/);
      assert.ok(reviewEn.trim().length > 200, `${fixtureCase.name} English briefing review should be non-trivial`);
      assert.ok(reviewZh.trim().length > 120, `${fixtureCase.name} Chinese briefing review should be non-trivial`);
      assert.ok(preparedEn.review.trim().length > 0, `${fixtureCase.name} should prepare English hiring-manager review output`);
      assert.ok(preparedZh.review.trim().length > 0, `${fixtureCase.name} should prepare Chinese hiring-manager review output`);
      assert.ok(preparedEn.templateData.fit_summary, `${fixtureCase.name} English template data should include fit summary`);
      assert.ok(preparedZh.templateData.fit_summary, `${fixtureCase.name} Chinese template data should include fit summary`);
      assert.ok(translationPayload.summary.trim().length > 0, `${fixtureCase.name} translation payload should include summary text`);
      assert.ok(Array.isArray(translationPayload.employment_history), `${fixtureCase.name} translation payload should expose employment history array`);

      if (fixtureCaseHasValidContract(fixtureCase)) {
        assert.equal(
          profile.candidateName,
          fixtureCase.expectedCandidateName,
          `${fixtureCase.name} should derive the expected candidate name from the fixture documents`
        );
        assert.equal(
          profile.roleTitle,
          fixtureCase.expectedRoleTitle,
          `${fixtureCase.name} should derive the expected role title from the fixture documents`
        );
        assert.match(
          summaryEn,
          new RegExp(`^Candidate: ${escapeRegExp(fixtureCase.expectedCandidateName)}\\nTarget Role: ${escapeRegExp(fixtureCase.expectedRoleTitle)}`, 'm')
        );
        assert.match(
          summaryZh,
          new RegExp(`^候选人：${escapeRegExp(fixtureCase.expectedCandidateName)}\\n目标职位：${escapeRegExp(fixtureCase.expectedRoleTitle)}`, 'm')
        );
        assert.match(
          reviewEn,
          new RegExp(`^Candidate: ${escapeRegExp(fixtureCase.expectedCandidateName)}\\nTarget Role: ${escapeRegExp(fixtureCase.expectedRoleTitle)}`, 'm')
        );
        assert.match(
          reviewZh,
          new RegExp(`^候选人：${escapeRegExp(fixtureCase.expectedCandidateName)}\\n目标职位：${escapeRegExp(fixtureCase.expectedRoleTitle)}`, 'm')
        );
        assert.equal(
          translationPayload.role.title,
          fixtureCase.expectedRoleTitle,
          `${fixtureCase.name} translation payload should preserve the expected role title`
        );
        assert.match(
          translationPayload.summary,
          new RegExp(`^候选人：${escapeRegExp(fixtureCase.expectedCandidateName)}`, 'm'),
          `${fixtureCase.name} translated summary payload should keep the expected candidate label`
        );
      }

      if (translationPayload.employment_history.length > 0) {
        assert.ok(
          translationPayload.employment_history.every((entry) => {
            return Boolean(entry.job_title || entry.company_name || entry.start_date || entry.end_date || entry.responsibilities.length > 0);
          }),
          `${fixtureCase.name} employment-history entries should contain usable translated fields`
        );
      }
    }
  );
}

test(
  'invalid-pair fixture cases stay explicitly marked as smoke-only scenarios',
  () => {
    const invalidCases = EXTERNAL_FIXTURE_CASES.filter((fixtureCase) => fixtureCase.contractMode === 'invalid_pair');

    assert.ok(invalidCases.length > 0, 'At least one invalid or malformed fixture scenario should be tracked explicitly.');
    invalidCases.forEach((fixtureCase) => {
      assert.ok(fixtureCase.notes, `${fixtureCase.name} should explain why it is excluded from strict candidate-role contract assertions.`);
    });
  }
);

test(
  'Test8 retrieval manifests exclude standalone PDF page-marker artifacts from surfaced evidence',
  {
    skip: fixtureCaseIsPresent(EXTERNAL_FIXTURE_CASES.find((fixtureCase) => fixtureCase.name === 'Test8'))
      ? false
      : 'Test8 fixture documents are not available on this machine.'
  },
  async () => {
    const fixtureCase = EXTERNAL_FIXTURE_CASES.find((entry) => entry.name === 'Test8');
    const cvDocument = await importDocument(getFixtureCvPath(fixtureCase));
    const jdDocument = await importDocument(getFixtureJdPath(fixtureCase));

    const summaryRequest = buildSummaryRequest({
      cvDocument,
      jdDocument,
      systemPrompt: 'System prompt'
    });
    const briefingRequest = buildBriefingRequest({
      cvDocument,
      jdDocument,
      systemPrompt: 'System prompt'
    });

    const previews = [
      ...summaryRequest.retrievalManifest,
      ...briefingRequest.retrievalManifest
    ]
      .filter((entry) => entry.documentType === 'cv')
      .map((entry) => entry.preview);

    assert.ok(previews.length > 0, 'Test8 should surface CV retrieval evidence previews');
    assert.equal(
      previews.some((preview) => /(?:^|\\s)\\d+\\s+of\\s+\\d+(?:\\s|$)/i.test(preview)),
      false,
      'Standalone PDF page markers should not appear in surfaced evidence previews'
    );
  }
);

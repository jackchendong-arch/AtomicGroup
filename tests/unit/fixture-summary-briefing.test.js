const test = require('node:test');
const assert = require('node:assert/strict');

const { importDocument } = require('../../services/document-service');
const {
  buildFallbackBriefing,
  prepareHiringManagerBriefingOutput,
  renderHiringManagerBriefingReviewFromBriefing,
  renderSummaryFromBriefing
} = require('../../services/briefing-service');
const {
  createTranslatableDraftPayload
} = require('../../services/draft-translation-service');
const {
  EXTERNAL_FIXTURE_CASES,
  fixtureCaseIsPresent,
  getFixtureCvPath,
  getFixtureJdPath
} = require('./external-fixture-registry');

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
      assert.ok(reviewEn.trim().length > 200, `${fixtureCase.name} English briefing review should be non-trivial`);
      assert.ok(reviewZh.trim().length > 120, `${fixtureCase.name} Chinese briefing review should be non-trivial`);
      assert.ok(preparedEn.review.trim().length > 0, `${fixtureCase.name} should prepare English hiring-manager review output`);
      assert.ok(preparedZh.review.trim().length > 0, `${fixtureCase.name} should prepare Chinese hiring-manager review output`);
      assert.ok(preparedEn.templateData.fit_summary, `${fixtureCase.name} English template data should include fit summary`);
      assert.ok(preparedZh.templateData.fit_summary, `${fixtureCase.name} Chinese template data should include fit summary`);
      assert.ok(translationPayload.summary.trim().length > 0, `${fixtureCase.name} translation payload should include summary text`);
      assert.ok(Array.isArray(translationPayload.employment_history), `${fixtureCase.name} translation payload should expose employment history array`);

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

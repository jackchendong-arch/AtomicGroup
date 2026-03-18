# TODO

Use release-level status markers only:
- `[ ]` not started
- `[-]` in progress
- `[x]` completed after user confirms `works`

Mark a release complete only when the work is:
- implemented
- manually tested
- still working with the existing shipped workflow

## Release 1: Single Candidate Draft MVP
- [x] Release 1 shipped, completed, and tested.
- Create the initial Electron app layout for the recruiter workflow: source inputs, extracted text preview, generated summary, and primary actions.
- Add a CV file picker that lets the recruiter select one local CV file.
- Add a JD file picker that lets the recruiter select one local job description file.
- Add drag-and-drop support for one CV file and one JD file.
- Keep drag-and-drop intake working after UI refactors and Electron upgrades by resolving dropped file paths through the preload bridge instead of relying on deprecated renderer-only file path access.
- Harden drag-and-drop source intake against Finder/macOS drop quirks by supporting multiple dropped-file path resolution strategies and preventing parent handlers from swallowing valid drop events.
- Add file type validation for PDF, DOCX, and TXT inputs.
- Show imported file metadata for each input: file name, file type, and import status.
- Let the recruiter explicitly assign or correct whether an uploaded file is the CV or the JD.
- Add and maintain a Playwright smoke test harness for Electron so key UI flows can be validated continuously during Release 1 work.
- Cover the primary Release 1 UI surfaces with Playwright smoke tests, starting with launch, settings navigation, and the summary/CV/JD review tabs.
- Add and maintain fast isolated unit/service tests for document extraction, summary parsing, and Word export logic so data-path fixes do not require full Electron e2e runs.
- Add file-backed regression tests for representative external CV/JD pairs so Word export can be validated against real recruiter documents without relying on the UI.
- Extract raw text from TXT files.
- Extract raw text from PDF files.
- Extract raw text from DOCX files.
- Show a readable extracted text preview for the CV.
- Show a readable extracted text preview for the JD.
- Detect and surface extraction failures without losing the imported file state.
- Warn when extracted content appears empty or too low quality for generation.
- Add a built-in default candidate summary template.
- Implement prompt assembly using CV content, JD content, and the default summary template.
- Add an LLM configuration page where the user can set provider, base URL, model, API key, and related generation settings.
- Refine the app chrome so the workbench header does not expose model/status text and uses a compact configuration icon instead of a visible settings button.
- Refresh persisted configuration when the settings view is opened so the displayed active Word template cannot drift from the saved runtime configuration.
- Redesign the main recruiter workbench to use left-side navigation with one primary content panel for intake, CV review, JD review, and summary review so the app stays readable without heavy scrolling.
- Reduce visual clutter in the workbench by replacing the multi-column box layout with clearer document-focused reading views.
- Make the recruiter summary the default primary work surface, with candidate CV and JD available as supporting tabs in the main panel instead of competing layouts.
- Enlarge the drag-and-drop intake area and place it above the manual document selection controls so source loading is clearer and faster for recruiters.
- Polish the active Release 1 workbench so button placement, spacing, and copy density feel aligned instead of scattered or cramped.
- Reorganize the left intake rail so `Choose CV` and `Choose JD` sit directly below the drag-and-drop area as the primary import actions, with the remaining source information presented as aligned read-only status blocks.
- Compress the top window chrome into a slimmer app bar so more vertical space is available for the recruiter workbench.
- Move the `AI Recruitment Intelligence` label to the right side of the title bar so the left side stays cleaner for the workbench shell.
- Compress the left intake rail header so the source-loading area gives more room to the primary import controls and status content.
- Simplify the left intake rail metadata so each source shows a cleaner file label and one compact status line instead of multiple low-value metadata pills.
- Simplify the left intake rail further so the source cards focus on the selected file name and only surface helper or error text when it is actually useful.
- Remove redundant file/type/import metadata rows from the CV and JD review panels so those tabs stay focused on the readable document content.
- Replace the generic CV pane heading heuristics with a CV-specific formatter so role history, dates, and bullets render cleanly without falsely bolding ordinary lines as position titles.
- Compress the primary summary panel chrome so the editable content area gets more of the panel height and less space is lost to helper text and duplicated controls.
- Restyle the primary output navigation as compact browser-like tabs so `Candidate Summary`, `Candidate CV`, and `Job Description` feel like content tabs instead of oversized action buttons.
- Remove redundant workbench panel kickers and title labels that do not add meaning so the UI stays neat, clean, and focused on the actual task content.
- Render the primary CV, JD, and candidate summary panes as formatted rich-text documents so headings, spacing, and emphasis are easier to read than raw text blocks.
- Tighten the default candidate summary template so the recruiter draft uses cleaner label-value fields and plain bullets instead of redundant titles and markdown-heavy emphasis.
- Keep the summary, CV, and JD panes scrollable within their own panels so the recruiter does not need to scroll the full window to read long content.
- Show visible generation progress feedback while the LLM summary request is running so the recruiter can tell the draft is actively being produced.
- Redesign the configuration page with a left-side navigation panel and separate sections for LLM settings and candidate summary template settings.
- Persist the LLM configuration locally so the user does not need to re-enter it on each launch.
- Implement an LLM-agnostic provider interface so summary generation is not hard-wired to a single vendor.
- Add DeepSeek as the first supported provider preset.
- Validate that the configured provider settings are sufficient before allowing LLM-backed generation.
- Allow the headhunter to configure and persist a Word-based candidate summary template for hiring-manager output.
- Support both `.docx` and `.dotx` as configurable Word template formats for hiring-manager output.
- Store the configured Word-based candidate summary template under the application's local template folder instead of relying on the original external file path.
- Keep the in-app recruiter review summary on the default text structure while making the Word template the configured output format for future hiring-manager sharing.
- Generate a hiring-manager Word document from the configured template using the recruiter-reviewed summary content.
- Make Word draft export populate template placeholders reliably from the recruiter-reviewed summary even when the summary headings are edited or lose markdown markers.
- Improve hiring-manager Word draft field derivation so candidate name, role title, and other mapped template values prefer strong summary/CV/JD evidence over weak filename or generic-heading fallbacks.
- Surface which configured Word template fields were left blank during export so missing population can be diagnosed from the in-app debug trace.
- Support full employment-history population in the hiring-manager Word draft by extending both the exporter data model and the AtomicGroup source template instead of limiting export to a single extracted role block.
- Harden employment-history extraction for Word export so location lines are not mistaken for company names and PDF/page artifact lines are not emitted as role responsibilities.
- Add focused regression coverage for employment-history parsing so location-only lines and PDF/page artifacts do not reappear in Word export.
- Surface derived employment-history entries in the Word export debug trace so template-population gaps can be diagnosed from the actual parsed CV data.
- Fall back to a full-CV employment-history scan when the named experience section is too weak, so later roles are not lost because of PDF extraction or broken section boundaries.
- Surface raw CV employment-source windows in the export debug trace so extraction-loss issues can be distinguished from parser or template issues.
- Parse real PDF CV role blocks where company and date share one line and responsibilities are wrapped under en-dash bullets, so employment history matches the extracted source format used in testing.
- Parse alternate real-world CV layouts where role sections are introduced by labels like `Responsibilities:` or different heading structures, so employment history does not collapse into a single fake role during Word export.
- Add a local save/export action so the recruiter can generate the hiring-manager Word draft from the workbench.
- Reveal the saved Word draft location clearly after export so the recruiter can confirm where the file was written.
- Keep the last saved Word draft path visible in the workbench and provide a manual reveal action if automatic Finder reveal is missed.
- Show a visible debug trace for the Word draft export flow so save-dialog selection, output path resolution, render, and file-write verification can be inspected during Release 1 validation.
- Resolve folder-like save targets correctly so choosing the Documents folder still writes the draft inside that folder with the suggested filename.
- Persist the Word draft export debug trace to a local log file so failed or ambiguous save attempts can be inspected after the fact.
- Normalize `.dotx` template packages into valid `.docx` output packages and verify the saved Word draft is structurally valid before reporting success.
- Validate the configured Word template contains supported placeholders and surface a useful error or preview when the template structure cannot consume the generated candidate summary data.
- Provide a conversion path for static Word templates like `AtomicGroupCV_Template.dotx` by inserting supported placeholders while preserving the original report layout.
- Support AtomicGroup-specific placeholder names in the exporter so the existing `AtomicGroupCV_Template.dotx` layout can populate candidate summary content without manual template rebuilding.
- Generate a named candidate summary using the fixed template structure through the configured LLM provider.
- Include evidence-based match content in the summary instead of unsupported generic claims.
- Include a strengths section and a concerns or gaps section in the summary.
- Show the generated summary in an editable in-app review area.
- Let the recruiter edit the generated summary before sharing it externally.
- Add copy-to-clipboard export for the edited summary.
- Keep the app usable after a failed generation attempt so the recruiter can retry without re-importing files.
- Test the complete Release 1 flow end to end with at least one CV and one JD.

## Release 2: Structured Briefing and Template-Guided Output
- [-] Release 2 shipped, completed, and tested.
- Add support for selecting a local reference template file.
- Add support for selecting a local template folder for future multi-template workflows.
- Persist the recruiter's last selected template reference as a local preference.
- Retrieve the relevant template content and include it in generation context.
- Define a canonical structured candidate briefing schema that becomes the shared source of truth for both the recruiter summary and the hiring-manager Word document.
- Use the LLM to extract grounded candidate facts, employment history, and role-fit content from the CV and JD into that structured briefing schema instead of relying only on heuristic field extraction.
- Require source-grounding or evidence references for material candidate facts and fit claims so recruiter review can distinguish supported content from inferred content.
- Enforce a structured output schema for the generated summary.
- Detect malformed model output that does not match the expected summary structure.
- Repair malformed output automatically when safe to do so.
- Reject malformed output and show a useful error when repair is not safe.
- Validate the LLM-produced briefing schema before rendering so missing required fields, inconsistent dates, and unsupported claims are caught before summary or Word export.
- Keep `Candidate Summary Review` as the recruiter-facing LLM-completed assessment surface.
- Build the in-app `Hiring Manager Briefing` from the recruiter-reviewed key summary plus the grounded structured briefing model so recruiter assessment and hiring-manager output stay aligned without becoming the same surface.
- Keep Word document rendering deterministic through the configured template engine rather than asking the LLM to generate `.docx` content or layout directly.
- Generate an in-app hiring-manager briefing review from the same validated structured briefing object immediately after summary generation so the consultant can validate both outputs side by side.
- Add a dedicated `Hiring Manager Briefing` review tab in the primary workbench.
- Defer physical Word document creation until the consultant explicitly exports or sends the briefing, using the configured Word template to govern final fields, formatting, and layout.
- Make `Save Word Draft` create the consultant-reviewable hiring-manager Word draft from the same composed briefing content shown in the `Hiring Manager Briefing` tab, and keep that draft-generation path reusable for future email attachment handoff.
- Keep the visible progress indicator aligned to the active generation phase and avoid enabling downstream Word actions until the briefing review content is ready.
- Expand the canonical hiring-manager Word template and export payload so the Candidate Summary table and profile sections support nationality, preferred location, multiple languages, multiple education entries, and line-broken employment history rendering.
- Let the recruiter switch between the built-in default template and a local reference template.
- Test output consistency across at least two different template references.

## Release 3: Approval Gate and Anonymous Mode
- [ ] Release 3 shipped, completed, and tested.
- Add a recruiter control to choose named mode or anonymous mode before generation.
- Implement masking for candidate full name in anonymous mode.
- Implement masking for email address in anonymous mode.
- Implement masking for phone number in anonymous mode.
- Implement masking for exact address in anonymous mode.
- Implement masking for LinkedIn URL in anonymous mode.
- Add residual-PII warnings for likely identifiers that were not confidently masked.
- Let the recruiter review and edit the anonymized output before approval.
- Add draft lifecycle states: generated, edited, and approved.
- Require explicit recruiter approval before any sharing action is enabled.
- Prevent accidental sharing of an unapproved draft.
- Test both named and anonymous generation flows end to end.

## Release 4: Email Draft Handoff
- [ ] Release 4 shipped, completed, and tested.
- Add a `Share by Email` action for approved summaries.
- Build a default email subject from the candidate profile summary context.
- Build a default email body from the approved summary.
- Open the user's default email client with a prepared draft.
- Ensure the email handoff works only for approved summaries.
- Add plain-text fallback for email clients that do not handle rich formatting reliably.
- Add clipboard fallback if direct email draft handoff fails.
- Preserve recruiter control over recipients and final send.
- Test email draft handoff on macOS.
- Test email draft handoff on Windows.

## Release 5: Local Folder Intake and Job Workspace
- [ ] Release 5 shipped, completed, and tested.
- Add a folder picker so the recruiter can choose a local source folder.
- Show browsable files from the selected source folder inside the app.
- Let the recruiter select a CV and JD from the chosen folder.
- Save a local workspace containing the selected CV, selected JD, selected template, and latest draft.
- Show a recent work list so the recruiter can reopen prior work.
- Rehydrate the prior draft and document selections when a saved workspace is reopened.
- Keep the existing direct file picker workflow working alongside folder-based intake.
- Test reopening a saved workspace from local history.

## Release 6: Production Hardening
- [ ] Release 6 shipped, completed, and tested.
- Add structured error states for file import, extraction, generation, anonymization, and email handoff.
- Add recruiter-friendly retry actions for recoverable failures.
- Add local logging that is useful for diagnosing extraction and generation problems.
- Add output quality checks for missing required sections in generated summaries.
- Add safeguards against overconfident unsupported claims in the generated profile.
- Add basic performance instrumentation for import, extraction, and generation timings.
- Decide whether product-approved telemetry is allowed and implement it only if approved.
- Run regression testing across all previously shipped workflows.

## Cross-Cutting Product Decisions
- Extend the provider abstraction cleanly when additional LLM vendors are added after DeepSeek.
- Decide whether Release 1 must support image-only scanned PDFs or only text-based documents.
- Decide whether anonymous mode should also remove employer names, school names, and location references.
- Decide whether email draft output should support plain text only or both plain text and HTML.
- Decide whether Release 1 should also export Markdown, HTML, or PDF in addition to clipboard copy.
- Decide how much local history should be stored by default.
- Decide whether evidence citations or source traceability must be present in the first review UI.

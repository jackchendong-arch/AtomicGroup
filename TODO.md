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
- [-] Release 1 shipped, completed, and tested.
- Create the initial Electron app layout for the recruiter workflow: source inputs, extracted text preview, generated summary, and primary actions.
- Add a CV file picker that lets the recruiter select one local CV file.
- Add a JD file picker that lets the recruiter select one local job description file.
- Add drag-and-drop support for one CV file and one JD file.
- Add file type validation for PDF, DOCX, and TXT inputs.
- Show imported file metadata for each input: file name, file type, and import status.
- Let the recruiter explicitly assign or correct whether an uploaded file is the CV or the JD.
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

## Release 2: Approval Gate and Anonymous Mode
- [ ] Release 2 shipped, completed, and tested.
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

## Release 3: Template-Guided Consistency with Reference Inputs
- [ ] Release 3 shipped, completed, and tested.
- Add support for selecting a local reference template file.
- Add support for selecting a local template folder for future multi-template workflows.
- Persist the recruiter's last selected template reference as a local preference.
- Retrieve the relevant template content and include it in generation context.
- Enforce a structured output schema for the generated summary.
- Detect malformed model output that does not match the expected summary structure.
- Repair malformed output automatically when safe to do so.
- Reject malformed output and show a useful error when repair is not safe.
- Let the recruiter switch between the built-in default template and a local reference template.
- Test output consistency across at least two different template references.

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

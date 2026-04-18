# AI-Enabled Recruitment Intelligence

## Document Status
- Owner: Product / Founding Team
- Status: Draft v0.1
- Last updated: 2026-03-21
- Product surface: Desktop app (Electron)
- Maintenance rule: This spec should be updated alongside implemented behavior changes and agreed future design direction so it remains the working product/design record.
- Security reference: This spec is additionally informed by `/Users/jack/dev/documentation/AtomicGroupsecurity_design.html`, which defines Tier 1 and Tier 2 controls for the desktop app and later artifact-registry workflow.

## Product Summary
This product helps a headhunter turn raw recruitment documents into a high-quality candidate summary that can be reviewed and then shared with a hiring manager.

The first workflow is:
1. A headhunter provides a candidate CV and a role JD.
2. The app generates a structured candidate profile summary explaining why the candidate may be a strong fit for the role.
3. The headhunter reviews and edits the summary.
4. The headhunter shares the approved summary through their default email client.

The summary can be generated in two modes:
- Named: includes the candidate's identifying details.
- Anonymous: removes or masks candidate-identifying details.

The product should treat templates as two separate systems:
- a Markdown guidance template for recruiter-facing summary generation
- a Word template for hiring-manager document layout and presentation

CVs and JDs are dynamic workspace inputs, so the app should handle them through local extraction, normalization, and workspace-scoped retrieval rather than a single global document knowledge base.

## Problem Statement
Headhunters spend significant time reading CVs, comparing them with JDs, drafting candidate profiles, and formatting those profiles consistently for hiring managers.

Current pain points:
- Document review is manual and repetitive.
- Candidate summaries vary in quality and format between recruiters.
- Recruiters must manually anonymize details when needed.
- Sharing to hiring managers is fragmented and often happens outside a structured workflow.
- Early tooling can become brittle if it tries to solve ingestion, generation, review, anonymization, and distribution all at once.

## Product Goal
Deliver a desktop workflow that reduces recruiter effort while preserving recruiter control.

The product should:
- Produce a recruiter-ready candidate summary from a CV and JD.
- Keep a human review step mandatory before any outbound sharing.
- Support named and anonymous hiring-manager-facing outputs while keeping recruiter-facing review named.
- Support English and Chinese output for derived recruiter-facing and hiring-manager-facing artifacts.
- Enforce a repeatable format based on a reference template.
- Fit naturally into current recruiter workflows on a laptop.

## Primary Users
### Headhunter / Recruiter
The operational user of the app. They source candidates, review documents, generate the summary, edit it, and decide whether to share it.

### Hiring Manager
The downstream audience for the final summary. They are not the primary app user in this epic.

## Non-Goals for This Epic
- Full ATS / CRM integration
- Automatic sending via SMTP or background email delivery
- Bulk candidate ranking across many CVs
- Collaborative multi-user review workflows
- Interview scheduling
- Offer management
- Full search and sourcing intelligence across external talent databases

## Core User Story
As a headhunter, I want to load a candidate CV and a job description, generate a consistent candidate profile summary, review it, optionally anonymize it, and open my default email client with the approved summary so I can share qualified candidates faster with hiring managers.

## End-to-End Workflow
1. User opens the desktop app.
2. User establishes the current working context by either:
   - opening a role workspace folder that contains one role JD and many candidate CVs, or
   - manually importing one CV and one JD via file picker or drag and drop.
3. The app shows the current role and current candidate as the primary left-rail context.
4. The app lets the user switch candidate or JD context without losing sight of the currently loaded files.
5. User selects:
   - named or anonymous hiring-manager output
   - output language
   - a recruiter summary guidance template
   - a hiring-manager Word template
6. User clicks `Generate Summary`.
7. The app produces:
   - `Candidate Summary Review` for the recruiter, and
   - `Hiring Manager Briefing` for consultant validation before export
8. These outputs are based on:
   - CV content
   - JD content
   - the selected Markdown guidance template
   - the grounded structured briefing model
9. User reviews and edits the draft in the app.
10. If the user switches output language after generation, the app should translate the current derived outputs instead of rerunning the full CV/JD assessment, and should reuse a cached language variant when already available.
11. If the user switches output identity mode after generation:
   - the app should reuse a cached named/anonymous variant when already available for the current candidate-role draft
   - the app may apply deterministic anonymization to the hiring-manager-facing outputs from the current named draft without rerunning full LLM generation
   - recruiter-facing candidate summary and current-candidate context remain named
12. User marks the draft as approved.
13. User clicks `Save Word Draft` and/or `Share by Email`.
14. The app renders the final Word document through the configured Word template.
15. The app opens the system's default email client with a prepared draft when requested.
16. User performs the final send manually.

## Functional Requirements

### 1. Document Intake
- User can add one CV and one JD from local files.
- User can add files through file picker.
- User can add files through drag and drop.
- The UI clearly labels which file is the CV and which is the JD.
- The app shows file name, file type, and import status.
- The app supports common recruiting document formats.

Initial recommended file support:
- PDF
- DOCX
- TXT

### 1A. Left Rail Interaction Model
- The main stage should foreground the current working context:
  - current role
  - current candidate
  - currently loaded JD and CV
- The left rail should focus on context-switching controls rather than duplicating the active candidate context card.
- The current-candidate panel should only appear when a candidate is actually loaded, and should avoid empty placeholder text when no candidate is active.
- The current-candidate panel should prefer deterministic CV/JD-derived profile fields as soon as source documents are loaded, instead of waiting for LLM generation.
- Role workspace navigation should be the primary intake model for recruiter workflows:
  - one role workspace folder
  - one active JD
  - many candidate CVs
- Role workspace, manual import, and recent work should share one context-navigation panel with tabbed navigation.
- The left-rail context tabs should stay fully visible without horizontal clipping or hidden overflow.
- Manual single-file import and drag/drop should remain available, but should read as fallback utilities rather than the primary workflow.
- Recent work should be treated as secondary navigation, not as part of the active intake card.
- Output options such as named/anonymous and English/Chinese should be grouped as compact setup settings at the top of the shared context panel rather than as a separate action card.
- The language control should present as an intuitive `EN / CN` toggle rather than a generic text button.
- Output identity and output language switching should avoid unnecessary repeat model calls when a safe cached or deterministic draft variant is available.
- Role-workspace selectors should load the selected JD or candidate immediately, so the user does not need separate explicit load buttons in the normal folder-based workflow.

### 2. Text Extraction and Validation
- The app extracts raw text from the uploaded CV and JD.
- The app surfaces extraction failures clearly.
- The user can preview extracted text or a shortened preview before generation.
- The app warns when a file appears empty, image-only, or low-quality.
- Raw extracted source should be preserved as authoritative evidence and should not be overwritten by later cleaning or translation steps.
- Early cleaning should remove only safe extraction artifacts such as standalone page markers, repeated headers/footers, OCR junk, and broken whitespace or wrapping patterns that are proven by fixtures.
- Risky delimiters such as `|` should not be globally stripped; they should be interpreted contextually during normalization or projection.
- Cleaning rules should be built iteratively from real fixture evidence and regression coverage, not assumed complete upfront.

### 2A. Workspace-Scoped Source Model and Retrieval
- Each active CV and JD pair should be treated as a workspace-scoped source corpus.
- The app should normalize extracted content into section-aware source blocks with metadata such as:
  - source document
  - section
  - approximate page when available
  - block type
- Retrieval, when used, should operate only over the active workspace inputs:
  - CV
  - JD
  - optional Markdown guidance template
- The first retrieval design should be ephemeral and local to the active workspace, not a persistent global vector store of all candidates and roles.
- The current implementation should prefer lightweight local block selection and lexical scoring before introducing embeddings or any vector-database dependency.
- This is intentional because CVs and JDs in this product are short-lived, privacy-sensitive workspace inputs rather than long-lived shared knowledge assets.
- Retrieval should support long-document focus, evidence tracing, and structured-briefing generation without turning the system into a cross-candidate knowledge base.
- The normalized source model should support two parallel layers:
  - original-language normalized source blocks
  - an English working layer used for consistent downstream processing
- The English working layer is a processing aid only; original-language blocks remain authoritative and traceable for evidence, review, and factual rendering.
- Section-specific extraction should operate over bounded normalized blocks such as education, employment, projects, profile facts, and JD requirements rather than one whole-document CV-to-JSON call whenever practical.

### 3. Summary Generation
- The app generates a structured candidate profile summary from the CV and JD.
- The draft should explain why the candidate may fit the role based on evidence from the CV against the JD.
- The draft should not present unsupported claims as facts.
- The draft should follow a fixed output structure.
- The draft should include both strengths and gaps / risks.
- This output is the `Candidate Summary Review`.
- The target user for `Candidate Summary Review` is the headhunter consultant / recruiter.
- The LLM should complete the recruiter summary template directly from the CV and JD for recruiter review.
- The purpose of `Candidate Summary Review` is recruiter assessment, editing, and approval before any client-facing output is created.

Recommended output sections:
- Candidate headline
- Fit summary
- Relevant experience
- Match against role requirements
- Potential concerns or gaps
- Recommended next step

### 4. Template-Guided Output
- The summary format must be consistent.
- The app should support a built-in default template first.
- The app should later support a user-provided Markdown reference template.
- The generation system should ground recruiter-summary phrasing and structure using the chosen Markdown guidance template.
- If the model output breaks the expected structure, the app should reject or repair the output before review.
- The app should provide a separate `Hiring Manager Briefing` view for the hiring manager audience.
- The target receiver for `Hiring Manager Briefing` is the hiring manager, not the recruiter.
- `Hiring Manager Briefing` should combine:
  - the key summary / fit summary from `Candidate Summary Review`
  - grounded structured candidate details sourced from the CV and JD
- The content values for `Hiring Manager Briefing` should come from the grounded structured briefing model, not from the Word template itself.
- The configured Word template should govern the final hiring-manager document's fields, format, and visual layout.
- The physical Word document should only be created when the consultant explicitly exports or sends the briefing.

### 4A. LLM Ops and Artifact Governance
- Consultants should not manage prompts by editing free-form prompt text directly.
- Prompt artifacts should be authored outside the consultant workflow, versioned, reviewed, and then imported into the app as approved artifacts.
- The app should manage prompt artifacts, Markdown guidance templates, and Word presentation templates through one app-managed artifact registry.
- The registry should track, at minimum:
  - artifact ID
  - artifact type
  - semantic version
  - content hash
  - approval status
  - import timestamp
  - optional compatibility metadata
- Built-in default artifacts may ship with the app, but new approved artifact versions should be importable later without redeploying the whole app.
- The consultant should select from approved artifact versions rather than editing prompt bodies.
- Each generation run should persist a run artifact containing:
  - selected prompt/template artifact versions and hashes
  - provider/model/runtime settings
  - source document hashes
  - generated outputs
  - approval/share/export events
- When workspace-scoped retrieval is introduced, the run artifact should also capture the retrieval manifest:
  - source block IDs
  - retriever version
  - ranking or score metadata
  - evidence lineage used in generation
- The product should later define how prompt/template artifacts move from development into production user installs, for example by approved import bundles, managed sync, or another governed promotion path.

### 4B. Bilingual Output and Deterministic Translation
- The app should support at least English and Chinese for derived outputs.
- Output language should apply consistently to:
  - `Candidate Summary Review`
  - `Hiring Manager Briefing`
  - email draft handoff
  - generated hiring-manager Word briefing content
- Raw source-document views such as imported CV and JD text should remain unchanged when the recruiter switches output language.
- If the recruiter changes the output language after generation, the app should translate the current derived draft rather than rerunning the full CV/JD assessment.
- If a draft variant for the target language already exists, the app should reuse that cached variant instead of invoking the LLM again.
- Saved role workspaces should persist available draft variants so reopening a case can restore previously generated English and Chinese outputs without immediately retranslating.
- Translation should be treated as a deterministic transformation step over the current approved/generated draft content, not as a fresh candidate assessment.
- Translation should operate on bounded artifacts rather than one monolithic payload:
  - recruiter summary as plain text
  - core structured briefing fields as one bounded translation payload
  - large repeating sections such as employment history in small batches
- The app should keep the draft schema deterministic locally and merge translated field values back into that structure rather than asking the LLM to regenerate the whole draft shape.
- For large drafts, translation should automatically use section-level or batch-level requests so long cases do not depend on one oversized JSON response.
- Translation should be applied to generated output blocks and human-readable derived display fields, not to the raw imported source documents themselves.
- Raw source views such as the `Candidate CV` and `Job Description` tabs should remain exact to the imported documents regardless of output-language switching.
- Exact factual identifiers should stay stable across language variants unless a simple localized label is needed for readability:
  - candidate names
  - company names
  - university names
  - dates
  - phone numbers
  - email addresses
  - URLs
  - evidence references and other internal metadata
- Human-readable source-derived display fields may be localized when they are being rendered as part of the generated draft, for example:
  - briefing snapshot values
  - employment-history role titles and responsibility text
  - education display lines
  - recruiter-facing or hiring-manager-facing narrative sections
- If a newly generated structured briefing comes back in the wrong narrative language for the selected output, the app should normalize that briefing into the requested language before rendering the hiring-manager review.
- The app should keep the busy/progress indicator visible in a shared stage-level location while generation, translation, export, or email handoff is running.
- The app should prevent repeated conflicting language-toggle actions while translation is in progress.
- If translation output is malformed, the app should attempt a controlled repair or fall back gracefully rather than silently corrupting the draft.

### 4C. Security and Privacy Baseline
The app handles candidate PII, recruiter-generated outputs, local templates, and future prompt/template artifacts. Security requirements should therefore be treated as product requirements, not just implementation preferences.

Tier 1 priorities should be addressed before lower-priority production polish work:
- Never persist raw CV or JD text to application logs.
- Never persist generated candidate summaries, briefing text, or employment-history content to debug logs by default.
- Persist only privacy-safe metadata in diagnostics by default, such as:
  - file names or file hashes
  - provider and model identifiers
  - runtime settings
  - validation and error outcomes
  - run IDs and selected artifact versions when available
- Store the LLM API key in the OS credential store only.
- Do not allow plaintext API-key fallback in config files or other app-managed files.
- Treat the LLM API call as the primary PII egress point.
- Keep recruiter-facing candidate summary and current-candidate context named, while applying anonymous mode to hiring-manager-facing briefing, email, and Word outputs.
- Send only the minimum necessary CV/JD content for the generation task, with workspace-scoped retrieval reducing prompt size later.
- Explicitly harden Electron renderer security with:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true`
  - `webSecurity: true`

### 4D. AI Observability and STP Monitoring
The product needs privacy-safe AI observability, but the full observability stack should not live inside the recruiter-facing desktop app itself. The app should emit structured, privacy-safe run events and metrics, while collection, aggregation, dashboards, alerting, and cost reporting should live in an external observability system.

#### Observability Goals
The observability design should answer at least:
- how often the app is used
- how many CV/JD candidate assessments are processed
- how often generation, translation, review, export, and email handoff succeed
- how often the Word-report path completes without manual intervention
- why recruiters had to intervene when the flow was not straight-through
- how long the LLM assessment and translation steps take
- how much token usage and estimated provider cost the workflow creates

#### Privacy Boundary
Observability must remain privacy-safe by default. The exported event stream should not contain:
- raw CV text
- raw JD text
- generated summaries
- hiring-manager briefing text
- employment-history bullets
- project-description text
- recruiter free-form edits

It may contain:
- run IDs
- hashed workspace, CV, and JD identifiers
- artifact/template versions
- model/provider identifiers
- output mode and language
- timing metrics
- token counts
- normalized error categories
- review-check categories
- export/intervention reason codes

#### Event Model
The app should emit privacy-safe event envelopes for key workflow stages, such as:
- `workspace_opened`
- `cv_imported`
- `jd_imported`
- `summary_generation_started`
- `summary_generation_completed`
- `summary_generation_failed`
- `translation_started`
- `translation_completed`
- `translation_failed`
- `review_checks_raised`
- `draft_approved`
- `word_export_started`
- `word_export_completed`
- `word_export_blocked`
- `word_export_failed`
- `email_handoff_started`
- `email_handoff_completed`
- `email_handoff_failed`

Each event should carry stable correlation identifiers where possible:
- installation or tenant ID
- recruiter/session ID
- workspace/run ID
- operation ID
- source document hashes
- artifact/template versions

#### Metric Families
The external observability layer should derive at least the following metric families:

##### Product Usage
- active recruiters or active installs
- workspaces opened
- CV imports
- JD imports
- generated candidate assessments
- translations requested
- Word exports attempted
- Word exports completed
- email handoffs attempted/completed

##### Straight-Through Processing
The system should define an app-observable STP metric for the Word-report flow. A practical initial definition is:

`STP Word Export = a report export that completes successfully without recruiter factual override, without report-quality blocker, without retrying a failed export, and without the app surfacing a manual review-required state for factual extraction quality.`

This should be measured at least as:
- STP rate for Word export
- STP rate by CV source type (`pdf`, `docx`, `txt`)
- STP rate by language mix
- STP rate by template version
- STP rate by recruiter/team if multi-tenant rollout exists later

##### Intervention Reasons
When STP does not occur, the event stream should record normalized intervention reasons such as:
- `source-quality-issue`
- `ocr-required`
- `extraction-quality-block`
- `report-quality-block`
- `template-compatibility-block`
- `template-render-failure`
- `translation-failure`
- `provider-failure`
- `settings-or-credential-issue`
- `manual-factual-override`
- `manual-narrative-edit`
- `export-retry-required`

These reason codes should be stable so dashboards can show intervention trends over time instead of support teams having to inspect logs manually.

##### Reliability And Latency
The system should track:
- summary-generation success rate
- translation success rate
- export success rate
- email handoff success rate
- p50 / p90 / p95 latency for:
  - import
  - summary generation
  - translation
  - Word export
  - email handoff

Phase-level latency should remain available for analysis where possible, for example:
- prompt preparation
- provider wait
- repair calls
- review assembly
- translation batches

##### Token And Cost Monitoring
The observability design should capture token and cost metrics for:
- recruiter summary generation
- structured briefing generation
- translation
- email draft generation

When the provider returns usage metadata, that should be recorded as authoritative:
- input tokens
- output tokens
- cached tokens if supported
- provider-reported billing units

When provider usage metadata is unavailable, the system may record:
- local token estimate
- local cost estimate

Those estimates must be marked clearly as estimated rather than provider-authoritative.

#### Collection Architecture
The preferred architecture is:
1. the desktop app emits privacy-safe structured event envelopes locally
2. a local queue or run-artifact store batches those envelopes
3. an external observability collector receives batched uploads over HTTPS
4. the collector normalizes events into a metrics/warehouse layer
5. dashboards and alerts are built outside the app

This keeps:
- product instrumentation inside the app
- observability storage and analysis outside the app

#### Data Contract Expectations
The observability contract should define:
- event name
- event timestamp
- correlation IDs
- event version
- tenant/install context
- operation status
- normalized error category
- intervention reason codes
- timing payload
- token/cost payload
- artifact/template version payload

The contract should be versioned so dashboards and downstream pipelines do not break when new fields are added.

#### Relationship To Local Diagnostics
Local diagnostics and performance logs are still useful for support, but they are not the same thing as product-level AI observability.

- local diagnostics help debug one run
- observability metrics help measure fleet-wide usage, quality, latency, and cost

Both should reuse the same run IDs and normalized reason codes where possible so support investigations can drill from aggregated metrics into a local run trace when appropriate.
- Require a strict Content Security Policy in the renderer.
- Never load remote URLs in the main app window.
- Block unexpected navigation and window creation from the main app surface.
- Clear in-memory workspace source content when the recruiter resets the workspace, switches candidate context, or closes the active session.

Tier 2 security and privacy controls should follow once the Tier 1 baseline is in place:
- configurable run-history retention
- clear-all-history/offboarding actions
- privacy-safe run records and retrieval manifests
- artifact-bundle integrity checks for any future synced/imported registry flow
- richer audit visibility for provider/model/runtime provenance

These security requirements apply both to the currently shipped document-generation workflow and to the later artifact-registry design.

### 5. Anonymous and Named Modes
- The user can choose named or anonymous mode before generation.
- Named mode includes candidate-identifying information when present.
- Anonymous mode removes or masks identifying information.
- Anonymous mode should at minimum target:
  - full name
  - email
  - phone number
  - exact address
  - LinkedIn URL
- Anonymous mode should flag likely residual identifiers for manual review.

### 6. Review and Approval
- Generated content must be reviewed inside the app before sharing.
- The recruiter can edit the draft freely.
- The app should show draft status:
  - generated
  - edited
  - approved
- Sharing is only enabled after explicit approval.

### 7. Email Handoff
- The app opens the user's default email client instead of sending directly.
- The app prepares a draft subject and body.
- The recruiter remains responsible for final recipients and final send.
- If rich formatting is not supported consistently, the app should fall back gracefully to plain text and copy-to-clipboard support.
- SMTP delivery is out of scope for this epic.

### 8. Local File Source Options
- The user can select individual files manually.
- The user can drag and drop files into the app.
- The product should later support selecting a local source folder as a productivity enhancement.

## Quality Requirements
- Human review is mandatory before sharing.
- The UI must make it obvious which source documents were used.
- The system must prefer grounded, recruiter-safe language over overconfident marketing language.
- The app must remain usable even when generation fails; imported documents and extracted text should remain visible.
- The app should store only the minimum data needed for user convenience.
- Sensitive personal data should not be exposed unnecessarily in the UI or output.

## Proposed Output Template
This is the initial output structure to standardize against before a more flexible template library is introduced.

```md
# Candidate Profile Summary

## Candidate
[Candidate Name or Anonymous Label]

## Target Role
[Job Title]

## Why This Candidate May Be a Fit
[2-4 sentence summary]

## Relevant Experience
- [Relevant experience point 1]
- [Relevant experience point 2]
- [Relevant experience point 3]

## Match Against Key Requirements
- [Requirement] -> [Evidence from CV]
- [Requirement] -> [Evidence from CV]
- [Requirement] -> [Evidence from CV]

## Potential Concerns / Gaps
- [Gap or uncertainty]

## Recommended Next Step
[Suggested recruiter action]
```

## Current Implemented Design
The current implementation uses a hybrid flow:

1. The app extracts raw text from the CV and JD locally.
2. The current LLM requests use direct prompt context from the extracted CV and JD rather than a true retrieval layer.
3. The LLM generates the recruiter-facing candidate summary from CV text, JD text, and the default summary template.
4. The hiring-manager Word document is populated separately through deterministic field extraction and Word-template rendering.

In practice, this means:
- The recruiter summary is LLM-generated.
- The Word briefing layout is controlled by the configured Word template.
- Structured candidate facts used for Word export are currently derived mostly through local parsing and rule-based extraction.
- The app is not yet using a persistent or workspace-scoped RAG pipeline for CV/JD retrieval.

Strengths of the current design:
- Word output layout is stable and controlled by the template.
- The final `.docx` rendering is deterministic and testable.
- Failures in template population are easier to debug than free-form generated documents.

Limitations of the current design:
- CV parsing is brittle when document layouts vary.
- Recruiter summary content and Word-briefing content can drift because they are not generated from the same structured source of truth.
- Employment history and profile fields depend on heuristics that are harder to generalize across real-world CV formats.

## Target Architecture Direction: Workspace-Scoped Source Model and Template Separation
The preferred future design is not to ask the LLM to generate a Word document directly. Instead, the app should separate:
- dynamic source-document handling
- recruiter-facing assessment guidance
- grounded structured briefing content
- final Word presentation

The intended split is:
- `Candidate Summary Review`: recruiter-facing assessment generated by the LLM completing the recruiter summary template directly from CV + JD
- `Grounded Structured Briefing Model`: validated structured candidate facts and employment history grounded in CV + JD
- `Hiring Manager Briefing`: hiring-manager-facing output composed from:
  - the key summary / fit summary from `Candidate Summary Review`
  - the grounded structured briefing model
- `Word Document Output`: generated only when the consultant explicitly exports or sends the hiring-manager briefing, using the configured Word template for layout and field placement

### Core Principle
- The LLM should generate recruiter assessment content and structured grounded content, not final Word document layout.
- The Word template should remain responsible for document format, visual design, and layout consistency.
- Recruiter-facing review and hiring-manager-facing briefing are related outputs, but they are not the same surface and should not be conflated.
- CV and JD inputs should be handled as workspace-scoped dynamic documents, not as entries in a global long-lived candidate knowledge base.

### Source Handling Design
- CVs and JDs are always changing and should be treated as dynamic inputs loaded into the current recruiter workspace.
- The app should extract and normalize those documents locally before any LLM generation step.
- The normalized source model should preserve section structure and source metadata so candidate facts, employment history, and role requirements can be grounded and validated.
- Retrieval, when introduced, should be ephemeral and scoped to the active workspace only.
- The product should avoid starting with a global vector store that mixes many candidates and many roles together.
- The preferred first implementation is local lexical retrieval over section-aware source blocks, not embeddings stored in a persistent vector DB.
- A vector store is not ruled out forever, but it is not the right default for this app because the current use case is one active JD plus one active candidate CV within a recruiter workspace.

### Source Block Metadata Contract
The normalized source model should preserve enough structure for deterministic employment/project handling, not only retrieval relevance. Each source block should retain:
- source block ID
- source order
- section type
- parent-child structural relationship where known
- paragraph/list/table origin
- language hint
- page or document-position lineage where available
- parser confidence
- OCR-fallback flag when extraction quality was weak

This is important because project-role linkage often depends on structural nesting and table/list context, not just plain text content.

### Template Design
There are two different template systems in the product and they should remain separate:

1. Recruiter summary guidance template
- format: Markdown
- purpose: guide `Candidate Summary Review` structure, phrasing, and expected sections
- examples:
  - built-in default summary template
  - optional local Markdown reference template

2. Hiring-manager Word template
- format: `.docx` or `.dotx`
- purpose: govern the final document's fields, layout, branding, and visual presentation
- used only when rendering the exportable Word document
- not the source of truth for candidate facts or narrative content

### Proposed End-to-End Flow
1. Upload the CV and JD into the active desktop workspace.
2. Extract raw text and structural hints from CV and JD locally.
3. Preserve the raw extracted source as authoritative evidence with file, order, and parser metadata.
4. Normalize and clean the extracted source into stable blocks by removing safe artifacts such as standalone page markers, repeated headers/footers, OCR junk, broken wrapping, and whitespace noise.
5. Build section-aware normalized source blocks in the original source language with source references, language hints, and document-position metadata.
6. Build a normalized English working layer from those bounded source blocks for consistent downstream processing while keeping the original-language blocks authoritative.
7. Build an ephemeral workspace-level retrieval set over the active CV, JD, and optional Markdown guidance template.
8. Run bounded section-specific extraction against normalized source blocks to produce template-independent factual extraction outputs for:
   - canonical candidate profile facts
   - education
   - employment history
   - project experiences
   - canonical JD requirements and responsibilities
   - the extraction stage may remain deterministic first and later adopt bounded block/section-level LLM extraction, but it must still emit canonical facts rather than template fields
9. Reconcile and validate the canonical candidate and JD schemas deterministically:
   - dedupe entries
   - validate chronology
   - validate malformed rows
   - link projects to roles only when evidence supports it
   - keep unresolved ambiguity visible
10. Generate the fit assessment separately from factual extraction, using the validated canonical candidate and JD schemas plus source evidence as the grounding input.
11. Use the validated canonical model plus the fit assessment to drive downstream recruiter-facing generation:
   - `Candidate Summary Review`
   - `Hiring Manager Briefing`
   - email draft
12. Only when validation escalates beyond the green path, show the recruiter the specific structured rows and evidence that need confirmation or correction rather than asking for full manual CV validation.
13. Build a deterministic report view model from:
   - the validated canonical candidate and JD schemas
   - the recruiter-reviewed narrative assessment
   - any approved recruiter factual overrides
14. Keep report-payload construction LLM-free. This stage should map canonical facts plus approved assessment into a template-specific adapter payload without re-reading raw CV/JD text or asking the model to infer final template fields.
15. Only when the consultant explicitly exports or sends the briefing:
   - render the hiring-manager Word document from the report view model through the configured template adapter and layout-only Word template
16. Keep consultant business approval before sharing, but do not require full factual CV validation unless the app has surfaced a targeted review-required or blocking state.

### Source Normalization And Working-Language Layers
The pipeline should distinguish four source-processing layers:

1. `Raw Extracted Source`
- exact extracted text and parser output
- authoritative evidence

2. `Normalized Source Blocks`
- cleaned and section-aware
- original-language content preserved
- safe artifact stripping only

3. `English Working Layer`
- bounded translation/normalization for internal processing consistency
- not a replacement for the original source

4. `Canonical Validated Schema`
- language-neutral factual model used by downstream outputs

This separation ensures the app can:
- clean noisy extraction artifacts early
- keep original evidence intact
- use one primary internal processing language
- still support bilingual output later in the pipeline

### Canonical Data Layers
The report pipeline should separate five layers explicitly:

1. `Canonical Candidate Schema`
- deterministic source of truth for candidate facts derived from the CV/JD evidence
- includes employment history, project experience, education, languages, certifications, and evidence references

2. `Canonical JD Schema`
- deterministic source of truth for role title, requirements, responsibilities, preferred qualifications, and available hiring metadata

3. `Derived Assessment Model`
- LLM-generated recruiter assessment and hiring-manager recommendation narrative
- should be grounded in the canonical candidate schema and canonical JD schema

4. `Hiring Manager Briefing`
- composed review surface combining recruiter-reviewed narrative with validated candidate facts

5. `Report View Model`
- deterministic export projection tailored to the chosen Word template
- the only structure consumed by Word rendering

### Recommended Canonical Candidate Schema
The exact field set can evolve, but the canonical model should distinguish factual candidate structure from narrative assessment. A representative structure is:

```json
{
  "candidate": {
    "name": "",
    "location": "",
    "nationality": "",
    "languages": [],
    "notice_period": "",
    "education": [],
    "certifications": [],
    "skills": []
  },
  "role": {
    "title": "",
    "company": ""
  },
  "employment_history": [
    {
      "employment_id": "",
      "company_name": "",
      "company_normalized_name": "",
      "employment_start_date": "",
      "employment_end_date": "",
      "location": "",
      "titles": [
        {
          "role_id": "",
          "job_title": "",
          "start_date": "",
          "end_date": "",
          "responsibilities": [],
          "achievements": [],
          "evidence_refs": []
        }
      ],
      "validation_flags": [],
      "evidence_refs": []
    }
  ],
  "project_experiences": [
    {
      "project_id": "",
      "project_name": "",
      "project_summary": "",
      "project_start_date": "",
      "project_end_date": "",
      "timeline_basis": "explicit | inherited_from_role | unknown",
      "linked_employment_id": "",
      "linked_role_id": "",
      "link_method": "nested_structure | explicit_text | timeline_match | recruiter_confirmed | unresolved",
      "link_confidence": "high | medium | low",
      "technologies": [],
      "outcomes": [],
      "validation_flags": [],
      "evidence_refs": []
    }
  ],
  "key_summary": "",
  "fit_summary": "",
  "relevant_experience": "",
  "match_requirements": [],
  "potential_concerns": [],
  "recommended_next_step": "",
  "evidence_refs": []
}
```

Notes:
- The original CV is evidence, not the final report structure.
- Employment history should represent real employers and role chronology, not standalone projects.
- `project_experiences` should remain separate from `employment_history` even when projects are later rendered under a linked role in the report.
- `fit_summary` / `key_summary` is the narrative bridge from recruiter assessment into the hiring-manager briefing.
- Exact candidate profile values such as name, nationality, education, notice period, employment history, and project relationships should come from grounded extraction and validation, not from unconstrained narrative generation.
- The Word template controls how these values are laid out in the final document, but it is not the source of truth for the values themselves.
- The same validated candidate schema plus approved narrative should drive both the in-app `Hiring Manager Briefing` review and the final Word export.

### Recommended Canonical JD Schema
The JD side should also become a structured deterministic artifact rather than staying as only raw prompt context. A representative structure is:

```json
{
  "role": {
    "title": "",
    "company": "",
    "hiring_manager": "",
    "location": ""
  },
  "requirements": [],
  "responsibilities": [],
  "preferred_qualifications": [],
  "evidence_refs": []
}
```

Notes:
- The JD schema should be extracted from bounded JD source blocks rather than from one unconstrained whole-document prompt.
- The validated JD schema should be reused for fit assessment, recruiter summary, hiring-manager briefing, and Word report generation.
- Keeping JD data canonical allows requirement matching and report generation to stay deterministic and traceable.

### Project Experience Handling Rules
- A project should never be treated as an employment record just because it contains responsibilities or outcomes.
- If a project is structurally nested under a role section, the app should link it to that role and may inherit role dates when project dates are absent.
- If a project appears in a separate project section, the app should store it first as a standalone `project_experiences` entry instead of forcing it into employment history.
- Timeline-based role linkage should only happen when the dates and evidence support it clearly.
- If project-role linkage remains ambiguous, the project should remain unresolved, be preserved in the model, and be surfaced for recruiter review instead of being silently dropped.
- The final report may render linked projects under the relevant role and unresolved or standalone projects in a dedicated project-experience section.

### Project-Role Mapping Precedence
When project-linkage signals conflict, the app should apply a deterministic precedence order:
1. recruiter-confirmed override
2. explicit structural nesting under a role section
3. explicit text naming the employer or role
4. unambiguous timeline match
5. unresolved

If multiple lower-priority signals conflict or two candidate roles remain plausible, the mapping should stay unresolved and require recruiter review rather than silently choosing one.

### Recruiter Override Model
The recruiter should be able to review and correct factual employment/project mapping when extraction is weak. Overrides should:
- allow direct confirmation or change of project-role linkage
- allow correction of chronology, employer grouping, and role assignment
- be stored as first-class structured data, not only UI text edits
- record that the final value came from recruiter confirmation rather than pure model extraction

The corrected structured data should become the source of truth for later briefing composition and Word export.

### Report View Model
The Word renderer should not read directly from raw extracted text or the full canonical schema. Instead, the app should build a deterministic report view model such as:

```json
{
  "report_header": {
    "candidate_name": "",
    "role_title": "",
    "company": ""
  },
  "profile_section": {
    "location": "",
    "languages": [],
    "education": [],
    "certifications": []
  },
  "assessment_section": {
    "key_summary": "",
    "fit_summary": "",
    "potential_concerns": [],
    "recommended_next_step": ""
  },
  "work_experience_section": [],
  "selected_project_experience_section": []
}
```

This report view model is an adapter-owned, template-specific projection rather than a generic raw-placeholder bag. It should be built only from:
- the validated canonical candidate and JD schemas
- the approved fit assessment / recruiter-reviewed narrative assessment
- any recruiter-confirmed factual overrides

Bounded CV/JD extraction, including any future block-level LLM extraction, should populate the canonical model first rather than emitting template fields directly.

Deterministic report-payload construction must not call the LLM. If a client later changes the template structure materially, that should be treated as adapter-compatibility or new adapter-version work rather than assuming the old payload can be reused safely.

This keeps:
- the canonical schema stable
- Word-template mapping simple
- template-specific formatting decisions in code and template configuration rather than in LLM output

### Validation Expectations
Before the app renders the hiring-manager briefing or generates the Word document, it should validate:
- required candidate fields are present
- dates are internally consistent
- employers, titles, and profile facts are grounded in the source documents
- employment chronology is coherent
- project records are not misclassified as jobs
- project-role linkage is consistent with structure or timeline evidence
- unresolved project-role mapping is flagged rather than silently assumed
- fit claims are evidence-based rather than invented
- output can be mapped fully into the chosen summary template and Word template

Before the app presents `Candidate Summary Review`, it should validate:
- the recruiter summary follows the expected review template
- fit claims are evidence-based rather than invented
- unsupported information is surfaced as a gap rather than asserted as a fact
- factual ambiguities in employment/project mapping are surfaced for recruiter review before export

### Validation Severity And Export Policy
Validation should distinguish:
- blocking errors
  - export is not allowed
  - examples: missing candidate name, empty employment history, impossible chronology, unmappable required Word fields
- review-required warnings
  - export is allowed only after recruiter confirmation or explicit override
  - examples: unresolved project-role linkage, weak parser confidence on key roles, incomplete but partially grounded timeline data
- informational warnings
  - export may proceed, but the recruiter is reminded to review
  - examples: optional fields missing, standalone projects with low business importance, minor evidence sparsity in secondary sections

The blocking and override rules should be explicit so the app behaves consistently instead of treating all validation findings as equivalent warnings.

An initial severity matrix should make that policy concrete:

| Issue type | Example | Severity | Export allowed | Consultant override allowed | Expected action | STP impact |
| --- | --- | --- | --- | --- | --- | --- |
| `candidate_identity_invalid` | candidate name is missing, generic, or clearly wrong | `block` | no | no | fix the factual record before export/share | breaks STP |
| `role_identity_invalid` | role title is missing, generic, or conflicts with the JD | `block` | no | no | fix JD mapping before export/share | breaks STP |
| `employment_history_corrupt` | skills or project fragments are classified as jobs | `block` | no | no | correct extraction before export/share | breaks STP |
| `chronology_conflict` | impossible or contradictory employment dates | `block` | no | yes, after targeted correction | correct chronology, then regenerate/revalidate | breaks STP |
| `education_row_malformed` | education row contains project/employment content or broken delimiters | `block` | no | yes, after targeted correction | correct education rows, then regenerate/revalidate | breaks STP |
| `required_report_field_missing` | required report section or field cannot be mapped into the report payload | `block` | no | no | fix extraction or adapter/template contract | breaks STP |
| `template_incompatible` | template/adapter contract mismatch prevents reliable rendering | `block` | no | no | fix template compatibility before export/share | breaks STP |
| `post_render_invalid` | placeholder leakage or clearly malformed rendered report | `block` | no | no | fix rendering/template issue before export/share | breaks STP |
| `project_role_ambiguous` | project could belong to more than one role and linkage matters to the report | `review-required` | only after confirmation | yes | consultant confirms or corrects linkage | breaks STP, but can still produce a valid report after step-in |
| `low_confidence_key_section` | employment/project/education extraction is grounded but confidence is weak | `review-required` | only after confirmation | yes | consultant reviews only the flagged rows | breaks STP, but can still produce a valid report after step-in |
| `translation_factual_ambiguity` | translated display text may materially alter a factual meaning | `review-required` | only after confirmation | yes | consultant confirms translated factual wording | breaks STP, but can still produce a valid report after step-in |
| `optional_field_missing` | nationality, preferred location, or another optional field is absent | `informational` | yes | not needed | proceed, optionally review | does not break STP |
| `minor_evidence_sparsity` | non-core section has thin evidence but no factual contradiction | `informational` | yes | not needed | proceed, optionally review | does not break STP |
| `normalization_notice` | safe cleaning rules removed page markers or OCR junk | `informational` | yes | not needed | no action required | does not break STP |

The matrix should not be treated as static. It should be tuned over time using real fixture evidence and later STP/intervention metrics:
- some `block` cases may later be downgraded to `review-required` when the workflow and correction UX are proven safe
- some `review-required` cases may later become `informational` when the extraction and validation quality improves
- any downgrade should be driven by evidence that output quality remains trustworthy while STP improves

### Consultant Review Triggers
Consultant review should be exception-based, not a mandatory manual validation pass on every CV.

The default operating model should be:
- `Green`
  - no factual consultant review required
  - the app may continue through summary, briefing, and Word-report generation automatically
  - only normal business approval is required before external sharing
- `Amber`
  - targeted consultant review is required for flagged factual issues before final export/share
  - the app should show only the affected rows/sections, not ask the consultant to re-read the full CV
- `Red`
  - export/share is blocked until specific factual or template issues are corrected

The app should require consultant step-in only when one or more of these conditions occur:
- candidate identity is missing, generic, or conflicts with source evidence
- role title is missing, generic, or conflicts with the JD
- education rows are malformed, duplicated, or appear to contain employment/project content
- employment history is empty, chronologically impossible, or contains obvious section leakage such as skills/project fragments as roles
- project experiences are misclassified, fragmentary, or cannot be linked confidently where linkage is required by the report
- required report fields cannot be mapped into the report view model or template adapter payload
- translation/normalization has produced factual ambiguity that could materially change the report
- parser/LLM confidence on key factual sections falls below the configured threshold
- post-render validation detects placeholder leakage or obviously malformed report sections

The app should not require consultant step-in for:
- clean green-path cases where candidate identity, chronology, education, employment, and required report fields validate successfully
- missing optional demographics or low-value secondary metadata
- routine recruiter approval of narrative phrasing when factual sections are already validated

When consultant step-in is required, the UI should present:
- the reason code
- the affected factual section and rows
- the source evidence block(s)
- the allowed action:
  - confirm
  - correct
  - defer / block export

This keeps STP as the default operating mode while making exception handling explicit and auditable.

### Evidence Reference Contract
`evidence_refs` should not remain a loose placeholder. The contract should define:
- the source block ID referenced
- document type and section type
- page or source-position hint where available
- whether the evidence supports:
  - candidate facts
  - employment chronology
  - project-role linkage
  - fit/recommendation claims

Fit claims as well as factual candidate records should carry evidence references where practical so recruiter review can trace both facts and interpretation.

### Deterministic Rendering Rules
The report projection layer should define deterministic behavior for:
- one employer with multiple titles or promotions
- chronology sorting across employers and titles
- date formatting when month/day precision is missing
- rendering of linked projects under roles
- rendering of unresolved or standalone projects in a separate section
- empty optional sections in the Word template

These rules belong in the report view model and template-mapping layer, not in the LLM output contract.

### Word Reporting Fidelity, Translation Policy, And Regression Quality Gates
#### Source-Preserving Factual Sections
Factual sections in the report should be source-preserving once the canonical schema is approved. For employment history and project experience:
- the renderer may reformat for the template
- the renderer may reorder only according to deterministic chronology/grouping rules
- the renderer must not silently shorten, summarize, or selectively omit factual experience content for neatness
- the original CV remains authoritative for factual wording, while the report projection controls layout only

#### Translation Policy For Factual Sections
- translated display copy is the default report output when the recruiter selects a different report language
- the original source-derived factual text remains authoritative
- translation of factual sections should happen at bounded field or bullet level, not as one large free-form rewrite
- the product may optionally render the authoritative original text in an appendix or reviewer-facing trace when needed for auditability
- the renderer must not let translation introduce or remove factual employment/project records

#### Word Template Contract
The Word template integration should define:
- supported template ID and template version
- the adapter version that knows how to populate that template
- required placeholders
- optional placeholders
- repeatable section placeholders for employment and project sections
- compatible report-view-model version
- export-blocking behavior when required placeholders cannot be populated

The template contract should be explicit so template validation is based on a known interface rather than best-effort placeholder discovery only.

#### Template Adapter Layer
The app should not pass low-level factual atoms directly into Word templates and expect the template to compose display-safe lines. Instead, each supported hiring-manager template should have a dedicated template adapter layer that:
- accepts the validated canonical candidate schema plus approved narrative assessment
- builds a deterministic report view model for export
- projects that report view model into a template-specific payload
- emits display-safe composed fields for optional or mixed-content lines

Examples of adapter-owned display-safe fields include:
- `education_degree_line`
- `education_field_institution_line`
- `education_years_location_line`
- `employment_role_company_line`
- `employment_dates_line`
- `project_linked_role_company_line`
- `project_dates_line`

This keeps punctuation, separators, partial-field handling, and template-specific formatting in code rather than in Word placeholders.

#### Layout-Only Template Principle
Word templates should be layout-only presentation artifacts. They may control:
- layout
- styling
- branding
- section order
- repeat loops

Word templates should not be responsible for:
- joining optional fields with punctuation such as `|`
- deciding whether to suppress separators when one side is empty
- reconstructing chronology or grouping logic
- composing human-readable lines from raw factual atoms

Those responsibilities belong in the template adapter layer.

#### Template Versioning And Compatibility
The product should support explicit template versions such as `candidate-report-v1`, `candidate-report-v2`, or future client-specific variants. Each supported version should have:
- a known placeholder contract
- a specific adapter implementation
- regression coverage against representative fixtures
- an explicit compatibility decision when templates evolve

This is safer than treating every newly supplied template as a generic placeholder bag that the exporter should infer on the fly.

#### Pre-Render Report Quality Validation
Before `.docx` rendering, the app should validate that the report view model itself still makes factual sense. Severe failures should block export rather than generating a polished-looking but unreliable document.

Export-blocking quality checks should cover at least:
- candidate name and role title that look generic, file-derived, or section-derived
- malformed education rows such as merged separator characters, empty degree/institution pairs, or education entries that actually contain employment/project text
- employment rows that use skills headings or company names as role titles
- project sections that are clearly over-expanded or contain sentence fragments, section spillover, or skills-language text instead of project titles

This quality gate is distinct from template validation:
- template validation checks whether the template can consume the report view model
- report-quality validation checks whether the report view model itself is trustworthy enough to export

#### Template Compatibility Validation
Template compatibility validation should happen separately from report-quality validation. It should answer:
- is this template version supported by a known adapter
- does the configured template expose the placeholders required by that adapter
- are repeat blocks present where the adapter expects them
- does the template avoid unsupported placeholder composition patterns for that adapter version

Compatibility failures should be explained as template-configuration issues, not as CV-quality issues.

#### Post-Render Word Validation
After `.docx` rendering, the app should validate that:
- no unexpanded placeholders remain
- expected headings and repeated sections rendered correctly
- required employment/project sections appear in the final file
- anonymous mode, when selected, is reflected in the final document
- template/export metadata needed for support or audit is recorded

This validation is separate from pre-render schema validation and is intended to catch renderer/template failures rather than source-extraction failures.

#### Word-Report Regression Strategy
The release-quality regression strategy for Word reporting should include:
- canonical-schema correctness tests for employment and project extraction
- report-view-model projection tests
- template-adapter payload tests for each supported template version
- `.docx` structural assertions for placeholder expansion and repeated-section rendering
- negative export-path tests for unmappable required fields or broken templates
- template-version compatibility checks
- curated visual review packs for key templates where structural assertions are not enough

The release-hardening and future CI gates should treat Word-report correctness as its own quality domain, not only as a side effect of summary-generation tests.

Current implemented slice:
- the current implementation has reached the limit of a generic raw-field template contract, and the next hardening step should move to explicit versioned template adapters instead of relying on template-authored optional-field composition
- recruiter-facing `Review Checks` now uses the same deterministic factual report composition as Word export, so quality blockers are assessed against the actual export model rather than a looser generation-time briefing
- summary generation and draft translation now emit structured per-run timing records to a dedicated performance log so support review can compare provider wait, repair, review-assembly, and import timings across runs without exposing raw candidate content
- missing template values are now sanitized so literal `undefined` does not leak into generated Word reports
- post-render validation now checks that generated `.docx` output does not retain unexpanded placeholders and still contains core rendered report content such as candidate/role identity plus summary/experience text
- the current report projection now also supports richer revised report templates with repeatable education, match-requirement, employment-experience, and project-experience loops, so the Word template can evolve toward the canonical candidate schema without falling back to raw CV formatting
- employment-history extraction now recognizes inline `company | role | date` CV layouts and bounded OCR-recovered weak PDFs, which materially improves deterministic Word export coverage for image-heavy or stylized CVs such as the `CV4-3.pdf` fixture
- Word export now prefers fresh deterministic CV/JD-derived factual sections such as education, employment history, and project experience over previously generated structured-briefing fact rows, while still preserving the recruiter-reviewed narrative assessment fields for export
- Word export now also applies a first semantic quality gate before render, blocking reports whose factual sections look unreliable due to malformed education extraction, generic identity labels, misclassified employment rows, or clearly over-expanded project extraction
- the same report-quality blockers are now surfaced in the recruiter-facing `Review Checks` panel immediately after generation/translation, and Word export plus email handoff stay disabled until those issues are cleared
- deterministic CV parsing now also handles compact Chinese education rows like `date + university/field | degree`, recognizes project headings that embed `使用技术`, and stops project capture cleanly before later skills sections such as `技能/优势及其他`
- deterministic CV parsing now also infers delayed pre-heading `education`, `work experience`, and `projects` blocks from leading CV content, so layouts like `CV4-2.pdf` still preserve clean education rows, `company — role` employment entries, and dated project headings before the explicit section labels appear later in the file
- report-quality validation now treats large project sections as acceptable when the extracted project titles remain clean and plausible, and only escalates high project counts when they are paired with suspicious fragment-style names or section spillover
- the next Word-export redesign step is to replace raw-field template composition with adapter-owned display-safe lines and explicit template-version compatibility, so client template evolution no longer randomly breaks previously working CVs

### Why the LLM Should Not Generate the Word Document Directly
Direct LLM generation of the final Word document would weaken the parts of the system that need to stay deterministic.

Risks of direct LLM-to-Word generation:
- layout fidelity becomes unreliable
- template conformity becomes hard to enforce
- formatting regressions are harder to debug
- recruiter trust drops when the visual output is inconsistent
- automated testing becomes weaker because content and layout are entangled

The preferred model is:
- LLM for recruiter assessment and structured extraction
- deterministic template engine for final Word rendering
- workspace-scoped retrieval for long-document focus and evidence grounding

## Design Comparison
### Current Implemented Approach
- LLM generates the recruiter summary.
- Local heuristics extract most structured fields for Word export.
- Word template rendering is deterministic.

Tradeoffs:
- strong template fidelity
- simpler debugging
- weaker handling of diverse CV layouts
- higher risk that the recruiter summary and hiring-manager briefing diverge

### Target Structured-Briefing Approach
- LLM completes the recruiter-facing `Candidate Summary Review` from CV + JD.
- A canonical candidate schema is produced from CV + JD for exact candidate facts, employment history, and project experience.
- A separate assessment model is produced for fit analysis and recommendation narrative.
- The hiring-manager briefing combines the recruiter-reviewed key summary with the validated canonical candidate schema.
- The Word document is only created on explicit export or send from a deterministic report view model.
- Word layout remains deterministic through the template engine.

Tradeoffs:
- stronger handling of messy real-world CVs and nuanced role-fit interpretation
- better clarity between recruiter assessment and hiring-manager output
- better consistency between hiring-manager briefing and final Word document
- better basis for evidence tracing and future QA checks
- higher implementation complexity
- higher need for schema validation and hallucination safeguards

## Recommended Direction
The recommended next architecture step is:
- keep the existing Word-template rendering engine
- keep `Candidate Summary Review` as the recruiter-facing LLM assessment surface
- replace brittle rule-based profile extraction with LLM-assisted structured extraction for grounded candidate facts
- introduce a canonical candidate schema that separates employment history from project experience
- introduce explicit project-role mapping rules, confidence, and ambiguity flags instead of flattening projects into employment history
- add a deterministic report view model between the canonical schema and Word export
- make the in-app `Hiring Manager Briefing` a composed output built from recruiter-reviewed key summary plus validated canonical candidate data
- preserve deterministic Word templating instead of allowing the LLM to control final document layout
- create the final Word document only at explicit export / send time

## Incremental Delivery Plan
The goal is to ship only slices that are already useful to a headhunter. Each release should be deployable without breaking the existing workflow.

### Release 1: Single Candidate Draft MVP
Value:
- A headhunter can generate a first draft candidate summary for one CV and one JD.

Scope:
- Desktop app shell
- File picker for one CV and one JD
- Drag-and-drop for one CV and one JD
- Text extraction for PDF, DOCX, and TXT
- Built-in default summary template
- Named summary generation only
- In-app review and manual editing
- Copy-to-clipboard export

Why this should ship first:
- It creates the first real user value with the smallest viable workflow.
- It avoids delaying value on folder ingestion, email integration, or complex template libraries.

Acceptance criteria:
- User can import one CV and one JD.
- User can see import success and basic extracted text preview.
- User can generate a structured summary with the fixed template.
- User can edit the summary and copy it for manual use.
- The app remains usable if generation fails once.

### Release 2: Structured Briefing and Template-Guided Output
Value:
- The recruiter can assess the candidate in one review surface and validate a separate hiring-manager-facing briefing before generating the final Word document.

Scope:
- User can select a Markdown reference template file
- Selected Markdown guidance content is included in generation context
- Candidate Summary Review remains the recruiter-facing LLM-completed summary template
- Canonical grounded structured candidate briefing schema for exact candidate details and employment history
- LLM-assisted extraction of grounded candidate facts, employment history, and fit content into that schema
- In-app Hiring Manager Briefing tab composed from recruiter-reviewed key summary plus grounded structured model
- Output schema validation and repair
- Template selection persisted as a user preference
- Word document generation deferred until explicit export or send action

Acceptance criteria:
- User can choose a template reference from local storage.
- Recruiter can review `Candidate Summary Review` and `Hiring Manager Briefing` as distinct in-app outputs.
- `Hiring Manager Briefing` uses recruiter-reviewed key summary plus grounded structured candidate facts.
- Material candidate facts and fit claims can be traced back to source evidence.
- Final Word output follows the chosen Word template when explicitly exported or sent.
- Broken or incomplete model output is detected and repaired or rejected.

### Release 3: Approval Gate and Anonymous Mode
Value:
- The workflow becomes safe enough for client-facing use cases where recruiter review and anonymization matter.

Scope:
- Named / anonymous toggle
- PII masking rules for anonymous mode
- Residual-PII warning indicators
- Explicit approval step before sharing actions are enabled
- Draft status tracking

Acceptance criteria:
- User can review a named recruiter summary while switching hiring-manager-facing outputs between named and anonymous variants.
- Anonymous mode masks the defined core PII set in the hiring-manager briefing, email, and Word document outputs.
- User must explicitly approve a draft before share actions are available.
- User can still edit the output after generation and before approval.

### Release 4: Email Draft Handoff
Value:
- The recruiter can move from reviewed profile to outbound sharing with less manual formatting.

Scope:
- `Share by Email` action
- Open default email client with subject/body draft
- Optional attachment or exported summary file if supported
- Plain-text fallback and clipboard fallback

Acceptance criteria:
- Approved summaries can be sent to the system email composer.
- The app does not send mail automatically.
- Recruiter can review the email in their own client before sending.

### Release 5: Local Folder Intake and Job Workspace
Value:
- The recruiter spends less time repeatedly locating files and setting up each draft, while the app gains a stable role-level workspace model: one JD, many candidate CVs, resumable candidate-by-candidate drafting, and a cleaner source foundation for retrieval and validation.

Scope:
- Select a role workspace folder on local machine
- Treat the selected folder as one role workspace containing one active JD and many candidate CVs
- Browse supported files from that role workspace inside the app
- Choose the active JD for the role workspace
- Switch between candidate CVs within the same role workspace
- Save a simple local workspace snapshot containing:
  - selected role folder
  - active JD
  - current candidate CV
  - latest generated draft
- Show a recent work list so the recruiter can reopen saved role workspaces
- Rehydrate the saved role folder, active JD, current candidate CV, and latest draft when recent work is reopened
- Build a workspace-scoped normalized source model for the active JD, current candidate CV, and active Markdown guidance template
- Add ephemeral retrieval over the active role workspace inputs instead of a global cross-candidate store
- User-selectable English / Chinese output language
- Post-generation language switching by translating current derived outputs rather than rerunning full assessment
- Cached language variants so switching back to an already available language is immediate
- Keep raw CV/JD source views unchanged while allowing bilingual derived outputs
- Shared progress state for generation, translation, export, and email handoff
- File-backed bilingual regression coverage over real recruiter CV/JD fixtures, including Chinese-language documents
- Structured-briefing diagnostics and repair paths for mixed-language or malformed-output issues found in real fixtures

Current implemented slices inside Release 5:
- left rail centered on current candidate-in-role context instead of a generic intake stack
- tabbed context panel for:
  - role workspace
  - manual import
  - recent work
- always-visible equal-width context tabs instead of a horizontally clipped tab strip
- compact top-of-context settings for:
  - anonymous output
  - language
- conditional current-candidate summary card that appears only when a candidate is loaded
- current-candidate panel populated from deterministic CV/JD extraction immediately after source load
- in-session draft-variant caching across:
  - named / anonymous
  - English / Chinese
- deterministic named/anonymous hiring-manager output switching without rerunning full summary generation
- selector-based role workspace intake in the sidebar
- role-workspace selectors auto-load JD and candidate changes without separate load buttons
- switching to a different role workspace clears stale loaded JD/CV slots immediately when those files do not belong to the newly selected folder, so the review panes do not keep showing old workspace content during the handoff
- resumable local workspace snapshots and recent-work reopen flow
- dedicated reopen / rehydration regression coverage around saved role workspaces, including source-only and generated-draft resume state
- bilingual derived outputs with translation-only language switching and cached variants
- large draft translations split recruiter-summary text and structured-briefing translation into smaller requests so bilingual switching stays reliable on longer cases
- section-batched translation for large structured briefing sections, with employment history translated in bounded batches and merged back into the deterministic briefing model
- automatic post-generation briefing language normalization when the structured briefing returns in the wrong narrative language for the selected output
- expanded real-fixture regression coverage over English and Chinese recruiter test packs
- contract-based external fixture metadata for expected candidate names, role titles, and smoke-only invalid-pair cases so regression coverage validates semantic correctness instead of only non-empty outputs
- stronger fixture regressions that assert deterministic candidate/role extraction and rendered summary/briefing labels across the external test packs
- deterministic current-candidate extraction hardened for OCR-style spaced-letter names such as `C h e n h a o L i`
- workspace-scoped normalized source model for the active CV, JD, and active guidance template
- section-aware source blocks with metadata and lightweight lexical retrieval over the active role workspace
- retrieval-backed prompt construction for recruiter summary and structured briefing generation, with retrieval manifests persisted and surfaced as recruiter-review evidence traces

Implementation note:
- The current retrieval layer is intentionally lexical and local. It selects relevant source blocks from the active workspace without generating embeddings or persisting vectors.
- This keeps the design aligned with the current product reality: CVs and JDs are dynamic recruiter-session inputs, not a long-lived cross-candidate knowledge base.

Optional Release 5 follow-on polish:
- richer recruiter-facing evidence tracing on top of the retrieval manifests

Acceptance criteria:
- User can select a role workspace folder, choose one active JD, and review many candidate CVs against that same role context.
- User can resume recent role work without re-importing everything manually.
- The left rail makes it immediately clear which candidate is currently loaded for which role.
- The user can switch candidate context without losing visibility of the current active role/candidate state.
- Retrieval is limited to the active role workspace and does not mix unrelated candidate or role documents.
- Existing single-file workflow still works.
- Recruiter-facing and hiring-manager-facing derived outputs can be produced in English or Chinese.
- Switching between previously generated language variants does not re-trigger unnecessary LLM translation.
- Switching between previously available named/anonymous variants does not re-trigger unnecessary full summary generation.
- Mixed-language regression cases from real recruiter fixtures are covered by repeatable backend tests rather than only UI retesting.

### Release 6: Production Hardening
Value:
- The app becomes more reliable and meets the non-negotiable Tier 1 security baseline for handling candidate data and LLM-provider access.

Scope:
- Tier 1 security remediation from the security design reference
- OS credential-store-only API key handling
- privacy-safe structured logging with no raw candidate content
- explicit Electron hardening and renderer/browser guardrails
- in-memory workspace clear behavior for sensitive source content
- Better extraction diagnostics
- Error handling and recovery paths
- Logging suitable for support
- Output quality checks
- Product-level telemetry and observability are deferred to a separate dedicated release

Current implemented slices inside Release 6:
- explicit Electron `BrowserWindow` hardening with:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true`
  - `webSecurity: true`
  - blocked insecure content
- blocked unexpected in-window navigation and denied new window creation from the main app surface
- renderer Content Security Policy restricted to local scripts and blocked embedded/remote frame paths
- privacy-safe summary/export diagnostics that record metadata, counts, and digests instead of raw CV/JD text, generated summaries, or full structured briefing content
- deterministic Playwright Electron end-to-end coverage for the current recruiter workflow using a local mock-generation mode so generation, translation, recent-work reopen, and role-workspace switching can be tested without live provider dependencies
- deterministic Playwright Electron coverage now also exercises approved Word export and email handoff through test-only mock paths so the shipped end-to-end workflow can be regression-tested without native save-dialog or mail-client side effects
- Release 6 now includes a single `npm run test:release-hardening` smoke command that runs the shipped unit and deterministic Playwright workflow suites together as the release gate
- GitHub Actions now runs that same release-hardening suite on `main`, pull requests, and Windows release builds so shipped workflow regressions are checked automatically instead of only manually
- a dedicated headed observe mode for Playwright so important workbench flows can run at slower, human-readable speed during review sessions
- settings persistence no longer writes plaintext API keys; saving now requires secure OS-backed encryption availability, and legacy plaintext key records are scrubbed from disk on load
- when secure storage cannot persist the API key, the app now saves non-secret configuration and keeps the key in session memory only, with explicit support-code messaging instead of silent failure or plaintext fallback
- secure-storage load failures now distinguish unavailable storage, policy/profile blocking, and saved-key read failures so the recruiter can report the right support code
- deterministic Playwright coverage now exercises both session-only save behavior and saved-key read-failure behavior through the real settings UI
- when a new candidate CV or role JD begins loading, the previous source slot and derived workspace draft state are cleared immediately so old source content does not linger in renderer memory while the replacement file imports
- higher-risk preload/IPC operations now validate payloads in the main process before side effects occur, including:
  - `cv` / `jd` slot selection
  - absolute local file and folder paths
  - recent-work workspace IDs
  - draft generation / translation / render payload shape
  - clipboard text bounds
  - local shell open / reveal targets
- the workbench now surfaces a shared structured failure panel with recruiter-facing retry actions for the main recoverable operations:
  - source import
  - role-workspace reopen / refresh
  - summary generation
  - draft translation
  - email handoff
  - Word export
  - open / reveal saved draft
- unsupported source files are rejected early in the workbench and surfaced as an explicit import issue instead of failing silently during manual or drag-and-drop intake
- generated drafts now surface recruiter-facing review checks for missing summary sections, weak requirement evidence, generic candidate/role labels, incomplete source evidence, and overconfident unsupported-claim language before approval or sharing
- deterministic Playwright coverage now proves both the healthy hidden state and the surfaced weak-draft state of the `Review Checks` panel through the real workbench UI
- import results and summary/translation diagnostics now record basic timing metrics so support reviews can see import, extraction, and generation/translation duration without exposing raw candidate content
- privacy-safe diagnostics now include operation run IDs and normalized error categories for summary generation, translation, export, and email support traces
- settings load/save and template/output-folder picker failures now surface a dedicated settings issue panel with retry/dismiss actions instead of only passive status text
- hiring-manager briefing review refresh failures now surface a retryable workbench issue instead of being silently swallowed during tab changes or summary edits
- weak image-based PDFs now attempt a bounded local OCR fallback during import when `pdftoppm` and `tesseract` are available, so CV/JD review and downstream extraction can recover content that is missing from the embedded PDF text layer
- switching back to a previously generated candidate inside the same role workspace now restores that saved draft automatically instead of forcing a blank state and manual reopen from `Recent Work`
- role-workspace auto-restore now only revives snapshots that actually contain a saved draft, so source-only selector changes do not unexpectedly restore or overwrite blank workspace state
- overlapping role-workspace CV and JD imports are now guarded per slot so a quick selector correction cannot let an older async import overwrite the latest chosen source file
- preload now exposes a frozen production API surface and keeps E2E test-mode signaling on a separate test-only bridge instead of the main renderer API

Acceptance criteria:
- The app no longer persists raw CV/JD text or generated candidate content to debug logs by default.
- The LLM API key is not stored in plaintext files or file-based fallback config.
- Legacy plaintext API key records are removed from disk the next time settings load.
- If secure storage is unavailable or blocked, the app does not fall back to plaintext; it either uses a session-only key or asks the recruiter to re-enter the key with a clear support code.
- Electron window security settings and renderer guardrails match the security baseline.
- Main-process IPC handlers reject malformed or unexpectedly broad payloads before touching the filesystem, shell integration, or generation flows.
- Primary workbench failures expose a structured recruiter-facing state and a retry path instead of only a raw error string.
- Secondary settings and review-refresh failures also expose a recruiter-facing state and retry path instead of being silently swallowed or reduced to passive status text.
- Common user-facing failures are recoverable.
- Release hardening can be verified from one command that reruns the current shipped unit and deterministic Electron workflow regressions together.
- The same release-hardening suite is suitable for CI/release gating, not only local smoke verification.
- Logs help diagnose extraction or generation problems.
- Existing workflows remain stable under failure conditions.
- Recruiter review highlights clearly signal when a generated draft is structurally incomplete or may be overstating evidence.

### Release 7A: Source Normalization Foundation
Value:
- CV and JD inputs become cleaner, more stable, and more explainable before any LLM extraction or report generation work occurs.

Scope:
- Raw extracted source preservation
- Safe artifact stripping and normalization rules
- Section-aware normalized source blocks
- Original-language source lineage and parser metadata
- English working layer for bounded downstream processing

Current implemented slice (`7A.3`):
- a standalone source-normalization service now exists between raw extraction and workspace retrieval
- workspace source documents now preserve `rawSource`, `cleaningManifest`, and normalized retrieval blocks together
- the first safe cleaning rules are in place for:
  - standalone page markers
  - opaque PDF artifact lines
  - decoration-only lines
  - bullet-marker normalization
- section classification now extends beyond explicit headings using conservative structural precedence from real fixture evidence
- wrapped-line repair now occurs only after section classification is known, including same-section wrapped block repair where the section stays stable
- bounded English working text now exists per normalized CV/JD block for internal processing
- original-language normalized text remains authoritative for review and evidence surfaces
- source refs, section keys, and cleaning metadata remain stable across the original-language and English-working layers
- retrieval and downstream generation contracts remain unchanged unless a caller explicitly opts into the English working text
- the existing retrieval contract stays stable while source normalization becomes explicit and testable

Release 7A is complete. Canonical schema extraction changes remain deferred to Release 7B.

Acceptance criteria:
- The app preserves raw extracted source separately from normalized content.
- Known safe artifacts such as standalone page markers, repeated headers/footers, OCR junk, and broken wrapping can be removed or normalized without losing source traceability.
- Normalized source blocks exist for CV and JD with section metadata and source references.
- The English working layer is bounded and does not overwrite the original-language evidence.

### Release 7B: Canonical Schema Extraction And Validation
Value:
- Summary, briefing, and export stop depending on ad hoc mixed parsing and move onto one deterministic factual foundation.

Scope:
- Canonical candidate schema
- Canonical JD schema
- Section-specific extraction for education, employment, projects, profile facts, and JD requirements
- Deterministic reconciliation and validation rules

Approved first implementation slice (`7B.1`) boundary:
- define the first canonical candidate schema and canonical JD schema contracts
- extract only:
  - education
  - employment history
  - project experiences
  - JD requirements
- keep the first canonical model minimal, with entry-level confidence, validation flags, and source references where required for traceability
- use normalized source blocks from `7A` as the input boundary
- add only minimal deterministic reconciliation for:
  - dedupe
  - chronology ordering
  - section leakage detection
  - conservative project-role linkage
- emit a minimal validation summary with normalized issue codes and a provisional `green|amber|red` state
- defer recruiter correction UI, English working layer usage, narrative-generation redesign, and Word adapter changes

Approved next implementation slice (`7B.2`) boundary:
- add a deterministic adapter from the canonical candidate and JD schemas into the existing fallback briefing contract
- make fallback briefing / export preparation consume canonical candidate facts, education, employment history, project experiences, and JD requirements instead of `extractDocumentDerivedProfile(...)`
- preserve the current recruiter-summary generation flow and structured-briefing merge behavior
- thread canonical validation summary metadata alongside the fallback path for later `7C` handling without introducing UI or export gating yet
- defer recruiter correction UI, green/amber/red UI surfacing, narrative-generation redesign, and Word adapter changes

Clarified remaining architecture boundary after `7B.2`:
- any later bounded block/section-level LLM extraction belongs on the factual extraction side before canonical reconciliation
- the extraction output should remain template-independent canonical data rather than template fields
- fit assessment generation should remain separate from factual extraction
- deterministic report-payload build remains a later pure-adapter step and should not call the LLM

Approved next implementation slice (`7B.3`) boundary:
- add explicit per-section factual extraction outputs for identity, education, employment history, project experiences, and JD requirements before canonical reconciliation
- keep the extraction output source-traceable and template-independent, whether the extraction remains deterministic first or later adopts bounded block/section-level LLM help
- reconcile those section outputs into canonical candidate and JD schemas with deterministic validation and normalized issue codes
- write latest-run fixture review artifacts under `debug/CV_blocks/<fixture-id>/` for source-model, section-extraction, canonical-schema, validation-summary, and run-metadata inspection
- ensure ambiguous linkage issues surface the competing candidate rows and date ranges needed for reviewer action, not just a generic amber code
- add regression coverage over a fixed CV/JD fixture pack with expected canonical outputs and validation states
- defer fit-assessment pipeline redesign, recruiter correction UI, and Word adapter changes

Acceptance criteria:
- Candidate and JD facts can be represented as explicit canonical JSON artifacts.
- Section-specific extraction is preferred over one broad CV-to-JSON call for the core factual sections.
- Validation can detect malformed education, chronology conflicts, section leakage, and unresolved project-role ambiguity before downstream generation.
- The validated canonical model can be reused across summary, briefing, email, and Word-report flows.

Release 7B is complete. Exception-based review and quality-gate behavior remain deferred to Release 7C.

### Release 7C: Exception-Based Review And Quality Gates
Value:
- STP remains the default while consultant step-in becomes explicit, targeted, and auditable.
- Release 7C remains downstream of the factual spine; it is not considered complete while stage 2 and stage 3 still leave avoidable parser-caused red states across the representative supported corpus.

Scope:
- Green/amber/red operating states
- Explicit consultant review trigger rules and reason codes
- Targeted factual review/correction UI for flagged rows only
- Export-blocking versus override-required policy

Acceptance criteria:
- Green-path cases can proceed without consultant factual validation.
- Amber/red cases surface only the affected sections, evidence refs, and allowed actions.
- The app can distinguish routine business approval from factual data-correction review.
- Report-quality blockers, template-compatibility issues, and low-confidence extraction states are represented consistently.

Approved first implementation slice (`7C.1`) boundary:
- define a deterministic severity matrix that maps canonical validation issues and report-quality blockers into `green`, `amber`, and `red`
- build one normalized review-state payload with issue code, affected section, evidence refs, recommended action, and export posture (`allowed`, `review-required`, or `blocked`)
- thread that review-state payload through generation results, renderer state, and recent-work persistence
- add a read-only recruiter-facing review surface that shows only the flagged sections and reasons for amber/red cases
- extend the factual stage-2/3 regression pack with a curated `Test10` corpus from `/Users/jack/Dev/Test/AtomicGroup/Test10`
- split `Test10` coverage into:
  - exact curated cases with stable expected canonical outputs and validation states
  - broader smoke cases with lighter assertions focused on import, per-section extraction, canonical reconciliation, and validation explainability
- write latest-run `Test10` artifacts under `debug/CV_blocks/Test10/<fixture-id>/`
- exclude obvious non-CV/noise files from tracked regression expectations
- defer factual correction editing and the full override workflow to later `7C` slices

Approved next implementation slice (`7C.2`) boundary:
- treat regression runs as engineering triage input, not just pass/fail output
- generate a latest-run triage summary for `Test10`-style fixture packs that highlights:
  - validation-state counts
  - dominant issue-code families
  - the specific CVs whose outputs define the next parser or severity fixes
- add identity-specific review and validation issue codes for:
  - role or banner text embedded in candidate name
  - section-heading or table-header names
  - inline demographic or profile metadata appended to candidate name
- harden deterministic candidate-name extraction so clean names survive recruiter banners, file-title wrappers, section headings, and inline metadata suffixes
- tighten severity rules so contaminated identity cannot remain `green`, even if the rest of the canonical structure passes
- anchor the slice on explicit `Test10` regression cases including:
  - `【Devops数据中心云专家_深圳_30-45K】戴海军_21年.pdf`
  - `Resume - Pengcheng Zhao.pdf`
  - `【资深sre工程师（外资行，甲方，稳定）_西安 30-60K】王翔 10年以上.pdf`
  - `【高级全栈开发工程师_西安 25-50K】赖锦有 10年以上.pdf`
  - `Atomic CV-SRE总监-胡晓亮.pdf`
- defer employment/education parser redesign, recruiter correction UI, and final override workflow

Approved following implementation slice (`7C.3`) boundary:
- harden deterministic employment-history parsing for compressed, table-like, and date-led CV layouts before introducing reviewer correction actions
- reject banner rows, profile summaries, and table headers such as `TIME EMPLOYER ROLE` from identity and employment extraction
- add deterministic row parsers for common date/company/title/responsibility patterns while keeping section leakage conservative
- tighten education extraction so certifications, credentials, languages, and adjacent summary text do not become malformed education rows
- promote the highest-signal `Test10` failures into stronger curated regression assertions for employment and education cleanup
- defer recruiter correction UI and final override workflow

Approved later implementation slice (`7C.4`) boundary:
- enforce the existing review-state export posture on Word export and email handoff
- add bounded recruiter actions only on flagged factual rows, such as:
  - confirming an ambiguity
  - keeping a project intentionally unlinked
  - marking an amber issue reviewed and allowed to proceed
- persist those targeted review decisions with generated drafts and recent-work snapshots
- keep red cases blocked until the required factual issue is resolved or an explicit allowed action exists
- defer free-form schema editing

Approved next implementation slice (`7C.5`) boundary:
- support legacy `.doc` CV intake at the import boundary
- convert legacy `.doc` files into the same text and normalized-source contract used by `.pdf`, `.docx`, and `.txt`
- move the current legacy `.doc` `Test10` cases from unsupported smoke into the stage-2/3 factual regression path where conversion succeeds
- keep downstream canonical extraction, validation, and artifact generation format-agnostic and unchanged
- preserve fixture review artifacts and triage outputs for converted legacy CVs under the existing `debug/CV_blocks/` structure
- defer additional UI work and Word adapter work

Approved later factual-completion boundary before `Release 7C` is considered closed:
- continue deterministic stage-2/3 hardening until the supported regression corpus no longer carries avoidable parser-caused `red` states for employment and education extraction
- explicitly separate pure education facts from adjacent study, lab, software, certification, or credential experience text in education sections such as `CV_Zhaihui_ZHANG_EN_202512.pdf`
- continue deterministic employment-history cleanup for the remaining supported `Test10` parser outliers before treating the canonical candidate model as reliable enough for final Word-fidelity work
- add a final identity sanity pass for likely false-green mismatches surfaced by fixture evidence, so clean filename/header name conflicts are surfaced or corrected before the canonical candidate model is treated as trustworthy
- keep fixture review artifacts and triage outputs as the review mechanism for stage-2/3 closure
- defer further UI workflow expansion until the factual spine is stable enough to support Word-output quality as the primary metric

### Release 7D: Word Report Adapter MVP
Value:
- The hiring-manager Word document becomes a stable product surface with its own explicit adapter contract instead of being a brittle side effect of generic placeholder export.
- This release begins only after the factual stage-2/3 pipeline is stable enough that Word-fidelity work is improving the final report rather than compensating for unresolved parser-caused red states.

Scope:
- Versioned template adapter for the active hiring-manager report template
- Template-specific report payload projection from the validated canonical candidate and JD schemas plus approved narrative assessment
- Code-owned display-safe composed lines for optional factual sections
- Clear separation between template-compatibility validation and factual report-quality validation
- Post-render `.docx` validation for placeholders, repeated sections, required headings, and anonymous-mode correctness

Acceptance criteria:
- The active hiring-manager report template is exported through an explicit versioned adapter rather than generic raw-field placeholder inference.
- Word templates are layout-only and do not need to compose optional field joins or suppress separators.
- Export failures can distinguish template incompatibility from factual extraction problems.
- The release ships a stable MVP path for the active report template without requiring the broader artifact-registry work to be finished first.

### Release 7E: Word Fidelity Expansion
Value:
- The first stable Word-report adapter grows into broader fixture coverage, stronger bilingual fidelity, and safer expansion to additional report variants.

Scope:
- Regression coverage at canonical-schema, report-view-model, template-adapter-payload, and final `.docx` levels
- Larger fixture packs for representative CV/JD families
- Bilingual rendering refinements and optional original-text appendix handling where required
- Additional supported template versions only after the MVP adapter path is stable

Acceptance criteria:
- Representative CV/JD fixtures can be validated at the adapter payload level before `.docx` rendering smoke tests.
- Green/amber/red report-quality behavior remains stable across the supported fixture families.
- The app can expand Word fidelity without regressing the already-supported template path.

### Release 8: LLM Ops Artifact Registry and Promotion
Value:
- Prompt, guidance, and template behavior becomes governable, versioned, and auditable without requiring full app redeploys for every artifact update.

Scope:
- App-managed artifact registry for prompts, Markdown guidance templates, and Word templates
- Approved artifact selection instead of free-form consultant prompt editing
- Artifact metadata including IDs, versions, hashes, and approval status
- Artifact bundle import path for dev-authored prompt/template updates
- Run-level provenance artifacts for summary, briefing, and email generation
- Promotion design for moving approved artifacts from development into production user installs
- Rollback support for prior approved prompt/template artifacts

Acceptance criteria:
- Consultants can select only approved artifact versions for prompts and templates.
- The app can import newer approved prompt/template artifacts without a full app redeploy.
- Each generation run stores enough provenance to identify which artifacts, inputs, and runtime settings produced the result.
- Artifact promotion from development to production is documented and operationally clear.
- If artifact sync or remote bundle download exists, it enforces:
  - HTTPS-only fetches
  - hardcoded manifest endpoints
  - trusted-domain validation
  - SHA-256 bundle verification before activation

### Release 9: AI Observability and STP Analytics
Value:
- Product, support, and AI-ops teams can measure how the workflow is actually being used, where straight-through processing breaks down, how long AI steps take, and what token/cost footprint the workflow creates.

Scope:
- Privacy-safe observability event contract for recruiter workflow events
- External observability collection path outside the desktop app
- STP metrics for Word-report generation and outward sharing readiness
- Normalized intervention reason codes
- Latency metrics for import, assessment, translation, export, and email handoff
- Token usage and cost capture, including provider-authoritative vs estimated values
- Correlation of observability events with run IDs, source hashes, and artifact/template versions

Acceptance criteria:
- The app can emit privacy-safe structured events for the main workflow stages without leaking raw CV/JD or generated candidate content.
- The event contract is versioned and stable enough for downstream dashboards and alerting.
- Straight-through Word-report metrics can be computed without parsing ad hoc debug logs.
- Intervention reasons for non-STP flows are normalized and analysable over time.
- Latency, token, and cost metrics can be aggregated per workflow stage.
- Observability storage, aggregation, dashboards, and alerts remain outside the recruiter-facing desktop app.

### Placeholder: Future Artifact Ops Design Review
This section is intentionally a placeholder for a later deeper design review. The current goal is to capture the main recommendation areas so artifact governance is treated as a product and operational capability, not just an implementation detail.

Topics to review later:
- artifact bundle format for prompts, Markdown guidance templates, and Word templates
- artifact metadata contract, including IDs, versions, hashes, approval state, and compatibility rules
- authoring workflow outside the consultant app
- review and approval workflow before an artifact becomes selectable by end users
- promotion model from development to production user installs
- distribution options:
  - manual artifact import
  - managed sync
  - installer-delivered artifact packs
- rollback strategy for prior approved artifact versions
- signature or integrity verification for imported artifacts
- environment strategy, such as dev, test, staging, and production artifact channels
- how run artifacts should reference prompt/template versions and future retrieval manifests
- whether the app should snapshot imported artifact content locally for full audit replay
- how artifact lifecycle changes should be exposed in the UI without overwhelming consultants
- offline and enterprise-managed deployment considerations
- retention, privacy, and support expectations for run artifacts and audit records

## Feature Decomposition by Capability
This epic can also be viewed as a set of smaller feature tracks that can be implemented in sequence.

### A. Intake
- File picker
- Drag-and-drop
- File type validation
- CV vs JD assignment
- Folder-based intake later

### B. Parsing
- Extract text from supported files
- Preview extracted text
- Show parsing failures and warnings

### C. Generation
- Prompt assembly from CV + JD + Markdown guidance template
- Workspace-scoped retrieval over normalized source blocks
- Structured output generation
- Grounding and hallucination controls

### D. Review
- Rich text or plain text editor
- Draft state management
- Approval gate

### E. Privacy
- Named mode
- Anonymous mode
- PII detection and masking

### F. Distribution
- Export / copy
- Open default email client
- Attach or paste summary where possible

### G. Template Intelligence
- Built-in Markdown guidance template
- Local Markdown guidance template selection
- Separate Word presentation template for hiring-manager export
- Schema validation and Word-template compatibility checks

### H. Artifact Ops
- Versioned prompt artifacts
- App-managed artifact registry
- Import and approval flow for artifact bundles
- Run provenance and audit records
- Artifact rollback and promotion

## Suggested Technical Boundaries
To keep implementation incremental, the app should separate these modules early:
- File intake and parsing
- Workspace-scoped document normalization and retrieval preparation
- Summary generation
- Structured briefing generation and validation
- Prompt/template artifact registry and run provenance
- Redaction / anonymization
- Draft review state
- Word rendering and distribution / email handoff

This separation reduces rework when the model provider, template system, or email strategy changes later.

## Risks
- Poor text extraction from scanned CVs can undermine summary quality.
- Anonymous mode may miss identifiers unless there is both automated masking and human review.
- Model output may drift from the desired format without schema enforcement.
- Opening default email clients behaves differently across operating systems.
- Over-automation may reduce recruiter trust if evidence for the summary is not clear.

## Assumptions
- The first production version is desktop-first, not browser-first.
- Users work from local files on their laptops.
- Users are comfortable with a manual review and manual send step.
- The model provider can be swapped later behind a stable summarization interface.
- A built-in Markdown guidance template is acceptable before a richer guidance-library workflow is introduced.

## Open Questions
- Which AI model/provider should be used in the first implementation?
- Must the first release support image-only scanned PDFs, or only text-based documents?
- Should anonymous mode also remove employer names, school names, and location references, or only direct identifiers?
- Should the email draft be plain text, HTML, or both?
- Should the first release export a shareable file such as PDF, HTML, or Markdown in addition to copy-to-clipboard?
- How much local history should be stored by default?
- Do we need evidence citations or source traceability in the review UI from the start, or can that wait until later?
- How should prompt/template artifacts be authored, approved, and promoted from development into production user apps?
- Should artifact distribution happen by manual import, managed sync, or app-upgrade bundles?

## Recommended Build Order
1. Release 1: Single Candidate Draft MVP
2. Release 2: Structured Briefing and Template-Guided Output
3. Release 3: Approval Gate and Anonymous Mode
4. Release 4: Email Draft Handoff
5. Release 5: Local Folder Intake and Job Workspace
6. Release 6: Production Hardening
7. Release 7A: Source Normalization Foundation
8. Release 7B: Canonical Schema Extraction And Validation
9. Release 7C: Exception-Based Review And Quality Gates
10. Release 7D: Word Report Adapter MVP
11. Release 7E: Word Fidelity Expansion
12. Release 8: LLM Ops Artifact Registry and Promotion
13. Release 9: AI Observability and STP Analytics

This order keeps the first shipped version simple, usable, and recruiter-visible while deferring higher-risk platform work until the core drafting loop is already working.

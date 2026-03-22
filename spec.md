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
1. Extract raw text from CV and JD locally.
2. Normalize and segment the source text into stable source blocks for prompting, validation, and retrieval.
3. Build an ephemeral workspace-level retrieval set over the active CV, JD, and optional Markdown guidance template.
4. Ask the LLM to complete the recruiter-facing `Candidate Summary Review` template using relevant workspace-scoped source material.
5. Ask the LLM and/or extraction layer to produce a strict grounded structured briefing object from CV + JD + template guidance.
6. Require evidence or source-grounding for material facts and fit claims.
7. Validate the structured output before any rendering step.
8. Show `Candidate Summary Review` to the consultant for editing and approval.
9. Compose the in-app `Hiring Manager Briefing` from:
   - the key summary / fit summary from `Candidate Summary Review`
   - the validated structured briefing object
10. Only when the consultant explicitly exports or sends the briefing:
   - render the hiring-manager Word document through the configured Word template
11. Keep recruiter review and approval as a mandatory human step before sharing.

### Recommended Structured Briefing Schema
The exact field set can evolve, but the data model should be explicit and stable. A representative structure is:

```json
{
  "candidate": {
    "name": "",
    "location": "",
    "nationality": "",
    "languages": [],
    "notice_period": "",
    "education": []
  },
  "role": {
    "title": "",
    "company": ""
  },
  "key_summary": "",
  "fit_summary": "",
  "relevant_experience": "",
  "match_requirements": [],
  "potential_concerns": [],
  "recommended_next_step": "",
  "employment_history": [
    {
      "job_title": "",
      "company_name": "",
      "start_date": "",
      "end_date": "",
      "responsibilities": [],
      "evidence_refs": []
    }
  ],
  "evidence_refs": []
}
```

Notes:
- `fit_summary` / `key_summary` is the narrative bridge from recruiter assessment into the hiring-manager briefing.
- Exact candidate profile values such as name, nationality, education, notice period, and employment history should come from grounded CV/JD extraction, not from unconstrained narrative generation.
- The Word template controls how these values are laid out in the final document, but it is not the source of truth for the values themselves.
- The same structured briefing object should drive both the in-app `Hiring Manager Briefing` review and the final Word export.

### Validation Expectations
Before the app renders the hiring-manager briefing or generates the Word document, it should validate:
- required fields are present
- dates are internally consistent
- employers, titles, and profile facts are grounded in the source documents
- fit claims are evidence-based rather than invented
- output can be mapped fully into the chosen summary template and Word template

Before the app presents `Candidate Summary Review`, it should validate:
- the recruiter summary follows the expected review template
- fit claims are evidence-based rather than invented
- unsupported information is surfaced as a gap rather than asserted as a fact

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
- A grounded structured candidate briefing model is produced from CV + JD for exact candidate facts and employment history.
- The hiring-manager briefing combines the recruiter-reviewed key summary with the grounded structured model.
- The Word document is only created on explicit export or send.
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
- make the in-app `Hiring Manager Briefing` a composed output built from recruiter-reviewed key summary plus grounded structured data
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
- Basic usage telemetry if approved by product/privacy policy

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
- a dedicated headed observe mode for Playwright so important workbench flows can run at slower, human-readable speed during review sessions
- settings persistence no longer writes plaintext API keys; saving now requires secure OS-backed encryption availability, and legacy plaintext key records are scrubbed from disk on load
- when a new candidate CV or role JD begins loading, the previous source slot and derived workspace draft state are cleared immediately so old source content does not linger in renderer memory while the replacement file imports

Acceptance criteria:
- The app no longer persists raw CV/JD text or generated candidate content to debug logs by default.
- The LLM API key is not stored in plaintext files or file-based fallback config.
- Legacy plaintext API key records are removed from disk the next time settings load.
- Electron window security settings and renderer guardrails match the security baseline.
- Common user-facing failures are recoverable.
- Logs help diagnose extraction or generation problems.
- Existing workflows remain stable under failure conditions.

### Release 7: LLM Ops Artifact Registry and Promotion
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
7. Release 7: LLM Ops Artifact Registry and Promotion

This order keeps the first shipped version simple, usable, and recruiter-visible while deferring higher-risk platform work until the core drafting loop is already working.

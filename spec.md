# AI-Enabled Recruitment Intelligence

## Document Status
- Owner: Product / Founding Team
- Status: Draft v0.1
- Last updated: 2026-03-17
- Product surface: Desktop app (Electron)

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

The output must follow a consistent template, with template guidance grounded by a reference document or template library that can later be used as RAG input.

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
- Support named and anonymous outputs.
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
2. User adds one CV and one JD via:
   - file picker, or
   - drag and drop.
3. The app extracts the document text and shows the imported files.
4. User selects:
   - named or anonymous output
   - a profile template or template set
5. User clicks `Generate Summary`.
6. The app produces a structured candidate summary based on:
   - CV content
   - JD content
   - the reference template
7. User reviews and edits the draft in the app.
8. User marks the draft as approved.
9. User clicks `Share by Email`.
10. The app opens the system's default email client with a prepared draft.
11. User performs the final send manually.

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

### 2. Text Extraction and Validation
- The app extracts raw text from the uploaded CV and JD.
- The app surfaces extraction failures clearly.
- The user can preview extracted text or a shortened preview before generation.
- The app warns when a file appears empty, image-only, or low-quality.

### 3. Summary Generation
- The app generates a structured candidate profile summary from the CV and JD.
- The draft should explain why the candidate may fit the role based on evidence from the CV against the JD.
- The draft should not present unsupported claims as facts.
- The draft should follow a fixed output structure.
- The draft should include both strengths and gaps / risks.

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
- The app should later support a user-provided reference template or template library.
- The generation system should ground output formatting and phrasing using the chosen template guidance.
- If the model output breaks the expected structure, the app should reject or repair the output before review.

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

### Release 2: Approval Gate and Anonymous Mode
Value:
- The workflow becomes safe enough for client-facing use cases where recruiter review and anonymization matter.

Scope:
- Named / anonymous toggle
- PII masking rules for anonymous mode
- Residual-PII warning indicators
- Explicit approval step before sharing actions are enabled
- Draft status tracking

Acceptance criteria:
- User can generate both named and anonymous versions.
- Anonymous mode masks the defined core PII set.
- User must explicitly approve a draft before share actions are available.
- User can still edit the output after generation and before approval.

### Release 3: Template-Guided Consistency with Reference Inputs
Value:
- The output becomes closer to how a real search firm wants profiles formatted.

Scope:
- User can select a reference template file or template folder
- Retrieval of relevant template content to guide generation
- Output schema validation and repair
- Template selection persisted as a user preference

Acceptance criteria:
- User can choose a template reference from local storage.
- Output follows the chosen structure with consistent section ordering.
- Broken or incomplete model output is detected and repaired or rejected.

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
- The recruiter spends less time repeatedly locating files and setting up each draft.

Scope:
- Select a source folder on local machine
- Browse imported files within the app
- Save a simple workspace containing:
  - chosen CV
  - chosen JD
  - selected template
  - latest generated draft
- Re-open recent work

Acceptance criteria:
- User can select a folder and pick files from it.
- User can resume recent work without re-importing everything manually.
- Existing single-file workflow still works.

### Release 6: Production Hardening
Value:
- The app becomes more reliable for real recruiter usage.

Scope:
- Better extraction diagnostics
- Error handling and recovery paths
- Logging suitable for support
- Output quality checks
- Basic usage telemetry if approved by product/privacy policy

Acceptance criteria:
- Common user-facing failures are recoverable.
- Logs help diagnose extraction or generation problems.
- Existing workflows remain stable under failure conditions.

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
- Prompt assembly from CV + JD + template guidance
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
- Default template
- Local template selection
- RAG over template references
- Schema validation

## Suggested Technical Boundaries
To keep implementation incremental, the app should separate these modules early:
- File intake and parsing
- Prompt / retrieval preparation
- Summary generation
- Redaction / anonymization
- Draft review state
- Distribution / email handoff

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
- A built-in template is acceptable before a richer template library is introduced.

## Open Questions
- Which AI model/provider should be used in the first implementation?
- Must the first release support image-only scanned PDFs, or only text-based documents?
- Should anonymous mode also remove employer names, school names, and location references, or only direct identifiers?
- Should the email draft be plain text, HTML, or both?
- Should the first release export a shareable file such as PDF, HTML, or Markdown in addition to copy-to-clipboard?
- How much local history should be stored by default?
- Do we need evidence citations or source traceability in the review UI from the start, or can that wait until later?

## Recommended Build Order
1. Release 1: Single Candidate Draft MVP
2. Release 2: Approval Gate and Anonymous Mode
3. Release 3: Template-Guided Consistency with Reference Inputs
4. Release 4: Email Draft Handoff
5. Release 5: Local Folder Intake and Job Workspace
6. Release 6: Production Hardening

This order keeps the first shipped version simple, usable, and recruiter-visible while deferring higher-risk platform work until the core drafting loop is already working.

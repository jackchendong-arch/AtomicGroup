# AtomicGroup Recruitment Intelligence

AtomicGroup Recruitment Intelligence is an Electron desktop app for executive search and headhunter workflows.

It helps a recruiter turn a candidate CV and a role JD into:
- a recruiter-facing candidate summary for review and editing
- a hiring-manager-facing briefing for validation
- a Word draft and email handoff path for sharing

This repository contains the desktop application, local document-processing logic, template/rendering logic, and automated test coverage.

## Problem Statement

Recruiters and headhunters spend too much time on repetitive document work:
- reading long CVs and JDs manually
- comparing candidate evidence against role requirements
- rewriting candidate summaries into a consistent format
- anonymizing material when needed
- packaging the result for a hiring manager

The challenge is not just generation. It is building a controlled workflow that keeps:
- recruiter judgment in the loop
- outputs consistent
- client-facing material grounded
- review and approval explicit
- sharing practical inside a desktop workflow

## What The App Does

At a high level, the app supports this flow:

1. Load a role workspace or import a CV and JD directly.
2. Extract text from local source files such as PDF, DOCX, and TXT.
3. Generate a recruiter-facing `Candidate Summary Review`.
4. Generate a grounded `Hiring Manager Briefing`.
5. Let the recruiter review, edit, approve, and optionally anonymize hiring-manager-facing outputs.
6. Export a Word draft through a configured Word template.
7. Prepare an email handoff draft for the recruiter to send manually.

The app currently supports:
- role workspace folders with one JD and multiple CVs
- recent work and workspace reopen
- English and Chinese derived outputs
- language switching with cached draft variants
- surfaced source evidence for recruiter review
- deterministic Word rendering through a business template

## Primary Users

### Recruiter / Headhunter Consultant
This is the main user of the app.

They need:
- a fast way to review candidate-role fit
- an editable recruiter summary
- a grounded hiring-manager briefing
- approval control before sharing
- a workflow that fits local files and real desktop usage

### Hiring Manager
This is the downstream audience for the final output.

They need:
- a clean, readable briefing
- grounded candidate details
- a trusted format

## Process Flow

### 1. Establish Context
The recruiter either:
- opens a role workspace folder containing one role JD and multiple candidate CVs
- or imports a CV and JD manually

### 2. Generate Drafts
The app creates:
- `Candidate Summary Review` for recruiter assessment
- `Hiring Manager Briefing` for recruiter validation before export/share

### 3. Review and Refine
The recruiter can:
- edit the recruiter summary
- switch output language
- choose whether hiring-manager-facing output should be anonymous
- review source evidence supporting the generated draft

### 4. Approve and Share
After approval, the recruiter can:
- save a Word draft
- prepare an email handoff

## Key Product Design Ideas

### Separate Surfaces By Audience
The recruiter summary and hiring-manager briefing are not the same output.

The app treats them as separate surfaces because:
- recruiters need an evaluative working draft
- hiring managers need a clearer and more stable briefing

### Separate Reasoning From Rendering
The app does not treat the Word template as the source of truth.

Instead:
- the LLM helps generate recruiter-facing content
- the app builds a grounded structured briefing model
- the Word template controls final presentation only

### Treat Templates and Evidence Differently
The app distinguishes between:
- static templates
- dynamic workspace inputs

Examples:
- Markdown guidance templates shape recruiter-summary structure
- Word templates control final document presentation
- CVs and JDs are transient evidence inputs for the active workspace

### Use Workspace-Scoped Retrieval, Not Global Candidate Memory
The app does not assume a single giant candidate knowledge base.

Instead, it uses the active workspace:
- one current candidate CV
- one current role JD
- optional guidance template content

The current retrieval direction is intentionally:
- local
- ephemeral
- workspace-scoped
- privacy-aware

That is enough to improve prompt focus and evidence tracing without forcing a persistent vector-database design too early.

## High-Level Architecture

### Source Handling
- import CV and JD from local files
- extract text
- normalize content into section-aware source blocks

### Retrieval and Grounding
- retrieve relevant blocks only from the active workspace
- use those blocks to ground summary and briefing generation
- surface source evidence back to the recruiter

### Generated Outputs
- `Candidate Summary Review` is recruiter-facing and editable
- `Hiring Manager Briefing` is a validated client-facing review surface

### Deterministic Presentation
- final Word output is rendered through a configured Word template
- sharing remains recruiter-controlled

## Current And Future State

### Current State
The current product direction includes:
- role-workspace-based intake
- bilingual English/Chinese outputs
- recruiter review and approval
- surfaced source evidence
- deterministic Word export
- email handoff preparation
- growing security hardening and regression coverage

### Future State Direction
The broader direction is:
- stronger production hardening
- prompt/template governance through managed artifacts
- better run traceability for LLM Ops
- auditable provenance for prompts, retrieval context, and outputs

The app is intentionally being shaped as a controlled recruiter workflow, not just a generic “upload documents and generate text” tool.

## Testing

The repo includes:
- unit tests for extraction, briefing, translation, anonymization, workspace state, security, and Word export logic
- Playwright Electron end-to-end tests for key recruiter workflows

Useful commands:

```bash
npm run test:unit
npm run test:e2e
npm run test:e2e:observe
```

`test:e2e:observe` runs the Playwright flow headed and slowed down so the interaction can be watched by a human reviewer.

## Local Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Build a local Windows installer:

```bash
npm run dist
```

Output files are written to `dist/`.

## Release Workflow

Windows installer publishing is tag-based.

- Ordinary branch pushes do not publish installers.
- Pushing a version tag like `v1.0.0` triggers the GitHub Actions release workflow.
- The workflow builds a Windows `.exe` installer and uploads it to the matching GitHub Release.
- A manual `workflow_dispatch` path is also available for a specific release tag.

Release the current version:

```bash
git push origin main
git tag v1.0.0
git push origin v1.0.0
```

Important:
- the release tag must match the version in `package.json`
- if Windows signing secrets are not configured, the workflow still builds an unsigned installer

## Additional Documentation

For deeper detail:
- [spec.md](spec.md) for the working product/design record
- [TODO.md](TODO.md) for release-by-release delivery status
- [UserGuide.md](UserGuide.md) for end-user workflow guidance

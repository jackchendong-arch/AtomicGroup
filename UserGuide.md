# AtomicGroup User Guide

This guide describes how a recruiter uses the current desktop application workflow.

## What The App Does
- Load a candidate CV and job description.
- Generate a recruiter-facing candidate summary.
- Generate a hiring-manager briefing review.
- Support named or anonymous hiring-manager outputs.
- Support English or Chinese derived outputs.
- Save a Word draft for hiring-manager sharing.
- Prepare an email draft for the hiring manager.

## Main Workflow
The app is designed around one question:

`Which candidate am I currently working on for which role?`

The primary workflow is:
1. Open a role workspace folder.
2. Choose the active JD for the role.
3. Choose the current candidate CV.
4. Generate the summary.
5. Review, edit, and approve.
6. Save the Word draft and/or share by email.

## Left Rail Overview
The left rail is organized around the current candidate in the current role.

It contains:
- a `Current Candidate` panel that appears once a candidate is loaded
- a tabbed `Context` panel with:
  - `Role Workspace`
  - `Import Manually`
  - `Recent Work`
- compact `Draft Options`
- the main `Generate Summary` action

This means the active candidate and role stay visible, while loading and reopening actions are kept in a separate navigation panel.

The `Current Candidate` panel is populated from the loaded CV and JD as soon as those documents are imported. It does not wait for summary generation.

## Recommended Way To Start
Use a role workspace folder when possible.

A role workspace folder should normally contain:
- one primary JD for the role
- multiple candidate CVs for that same role

This lets you keep the role context stable while switching candidates.

## Open A Role Workspace
1. In the `Context` panel, stay on the `Role Workspace` tab.
2. Click `Choose Folder`.
2. Select the folder for the role you are working on.
3. Choose the active JD in `Workspace JD`.
4. Choose the current candidate in `Candidate CV`.
5. Click `Load JD` and `Load CV`.

The loaded JD and CV should then appear in the left rail as the current active files.

## Manual Import Fallback
If you are not using a role workspace folder, open the `Import Manually` tab.

Then you can:
- drag and drop files into the intake area
- click `Choose CV`
- click `Choose JD`

This is useful for one-off testing or quick review, but the role-workspace flow is the preferred working model.

## Generate A Draft
1. Confirm the correct CV and JD are loaded.
2. Choose:
   - `Named` or `Anonymous`
   - `English` or `中文`
3. Click `Generate Summary`.

The app generates:
- `Candidate Summary Review`
- `Hiring Manager Briefing`

`Named / Anonymous` affects the hiring-manager-facing outputs. The recruiter-facing candidate summary and the `Current Candidate` panel stay named for consultant review.

## Review And Edit
Use the tabs in the main panel to review:
- `Candidate Summary`
- `Hiring Manager Briefing`
- `Candidate CV`
- `Job Description`

The recruiter summary and briefing can be edited and reviewed before approval.

Use the `Source Evidence` section in the summary review panel when you want to see which retrieved CV/JD blocks grounded:
- the recruiter summary
- the hiring-manager briefing

Each evidence item shows the source file, section, retrieval score, and a short excerpt from the selected source block.

## Switch Language
After a draft has been generated:
- switching `English / 中文` translates the current derived outputs
- it does not rerun the whole CV/JD assessment
- if that language version already exists, the app reuses the cached version

The raw `Candidate CV` and `Job Description` views do not change language.

## Switch Identity Mode
After a draft has been generated:
- switching between `Named` and `Anonymous` first checks whether that draft variant is already available for the current candidate and role
- if the variant already exists in the current session, the app restores it without rerunning full generation
- if the variant is not already cached, the app re-renders the hiring-manager-facing output from the current draft without rerunning full summary generation
- the recruiter-facing candidate summary remains named in both modes

This keeps identity switching lighter than a full re-run in the common case.

## Approval
Before sharing actions are available:
1. review the generated draft
2. make any needed edits
3. click `Approve Draft`

Approval is required before:
- `Copy Summary`
- `Save Word Draft`
- `Share by Email`

If you edit an approved draft, it moves back to an editable state and must be approved again.

## Save Word Draft
`Save Word Draft` creates the hiring-manager Word document from:
- the reviewed briefing content
- the configured hiring-manager Word template

The Word document is only created when explicitly requested. It is not automatically created every time summary generation runs.

## Share By Email
`Share by Email`:
- prepares a hiring-manager-facing recommendation email
- opens the default mail client
- generates the briefing Word document for attachment

Because desktop mail clients do not support reliable cross-client automatic file attachment through `mailto:`, you may need to attach the generated Word document manually.

## Anonymous Mode
`Anonymous` mode is for outward hiring-manager sharing where candidate identity should be masked.

In anonymous mode:
- the `Hiring Manager Briefing`, email content, and exported Word document are masked
- the recruiter-facing `Candidate Summary` stays named
- the `Current Candidate` panel stays named
- the raw source CV view remains unchanged

Always review anonymous outputs before sharing.

## Recent Work
Open the `Recent Work` tab to reopen prior role/candidate workspaces.

When reopened, the app restores:
- source folder
- active JD
- active candidate CV
- latest saved draft context

Recent work labels prefer:
- job role name
- candidate name

If a saved case has not yet generated a draft, the app may fall back to file labels.

## Role Workspace Best Practice
For a live recruiter workflow, the recommended structure is:
- one folder per role
- one JD in that folder
- many candidate CVs in that same folder

Then work candidate by candidate inside that one role workspace.

## Current Limits
- The app does not batch-generate all CVs in a folder at once.
- Email sending is not automated; the user still reviews and sends from their own client.
- The app currently uses workspace-scoped local retrieval rather than a persistent vector database.

## Troubleshooting
If something looks wrong:
- confirm the correct JD and CV are loaded
- confirm you are in the expected language mode
- regenerate after switching to a different candidate
- reopen the case from `Recent Work` if needed

For technical debugging, the app may also write local diagnostics used during development.

# AGENTS.md

## Workflow Source of Truth
- Use `TODO.md` as the ordered source of truth for UI/UX follow-up work.
- Use `spec.md` as the source of truth for approved design, architecture, contracts, and release intent.
- Always start from the top incomplete release in `TODO.md`.
- Propose that top incomplete release first before starting implementation.
- Treat the task bullets inside that release as the required scope for the active work.
- When scope changes, new product requirements are introduced, or additional follow-up work is discovered, update `TODO.md` first before implementation continues.
- When design, architecture, data contracts, validation policy, or slice boundaries change, update both `spec.md` and `TODO.md` before implementation begins.
- Keep `TODO.md` current so future work remains TODO-driven instead of drifting into undocumented scope.

## Design Review Rule
- During design review, do not update `spec.md` or `TODO.md` until the user explicitly approves the proposed design change.
- Treat design discussion as proposal-only until that approval is given.
- Once the user approves the slice design, update `spec.md` and `TODO.md` before starting implementation.
- Keep design and backlog changes user-gated for now: proposed `spec.md` / `TODO.md` updates must be reviewed and approved by the user before they are applied.

## Start Rule
- Do not begin implementation until the user confirms to start the proposed release.
- Do not begin implementation until the approved slice design is reflected in `spec.md` and `TODO.md`.
- Once the user confirms, mark that release with `[-]` in `TODO.md` before implementation begins.

## Completion Rule
- Implement and test the active release before moving on.
- After testing succeeds, wait for the user to confirm with `works`.
- Only after the user says `works`:
  - commit the changes
  - mark the release with `[x]` in `TODO.md`
  - move to the next release

## Sequencing Rule
- Work in `TODO.md` order unless the user explicitly reprioritizes.
- Keep the software in a working state after each completed item.
- Use release-level status markers only:
  - `[ ]` not started
  - `[-]` in progress
  - `[x]` completed after user confirmation
- Do not mark individual task bullets with status markers unless the user explicitly asks for that.
- For future changes, add or revise TODO items as needed before implementing the change so the backlog stays authoritative.

## Testing Rule
- Prefer fast isolated unit/service tests first for parser, extraction, templating, and Word export logic.
- Use Playwright primarily for visible Electron UI behavior, navigation, and end-to-end workflow regression coverage.
- When a fix is in backend or document-processing code, avoid relying only on e2e runs if a direct service-level test or smoke script can validate it faster.
- Prefer Playwright for automated UI and workflow validation as the app evolves.
- For work that changes navigation, import flows, summary review, or other visible Electron behavior, add or maintain Playwright coverage where practical.
- Keep the Playwright smoke suite runnable during active development so UI regressions are caught early.

## Regression Review Rule
- When running regression suites or reviewing generated test artifacts, inspect the outputs directly instead of asking the user to discover problems from raw files.
- Summarize the concrete findings first: failing or degraded cases, dominant issue families, and whether the result is a true regression, an expected existing gap, or a false positive from new logic.
- Highlight the highest-signal cases that define the next engineering work and include the recommended fix direction or next slice proposal.
- Treat generated manifests, debug folders, and triage summaries as supporting evidence for the review, not as a substitute for the review itself.
- Ask the user to inspect raw regression artifacts only when product intent is ambiguous or a human judgment call is genuinely required.
- Before regenerating regression artifacts, clear the relevant `debug/CV_blocks` scope for that run so reviewers only see latest-run output.
- If rerunning only one fixture pack such as `Test10`, clear only that corresponding debug scope first; if rerunning broader packs, clear each relevant fixture scope before writing fresh artifacts.

## Dual-Role Delivery Rule
- Use a two-pass workflow for regression-driven development:
  - Pass 1: act as a senior experienced tester and drive automated regression coverage, inspect the outputs, triage the problems, and identify the highest-signal failures.
  - Pass 2: act as a senior technical lead/developer and propose the fix design, slice boundary, and implementation plan based on that regression review.
- Do not move straight from raw regression output into code changes without first summarizing the reviewed findings and the recommended fix direction.
- When the reviewed findings imply design, architecture, scope, or backlog changes, propose the `spec.md` / `TODO.md` updates and wait for user approval before applying them.
- Once the design impact is approved and reflected in `spec.md` / `TODO.md`, proceed with implementation and re-run regression coverage to confirm the fix.

## UI Rule
- Prefer UI choices that are neat, clean, and useful over decorative or repetitive chrome.
- Remove or collapse metadata, helper copy, and controls that do not materially help the recruiter complete the current task.

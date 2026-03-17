# AGENTS.md

## Workflow Source of Truth
- Use `TODO.md` as the ordered source of truth for UI/UX follow-up work.
- Always start from the top incomplete release in `TODO.md`.
- Propose that top incomplete release first before starting implementation.
- Treat the task bullets inside that release as the required scope for the active work.
- When scope changes, new product requirements are introduced, or additional follow-up work is discovered, update `TODO.md` first before implementation continues.
- Keep `TODO.md` current so future work remains TODO-driven instead of drifting into undocumented scope.

## Start Rule
- Do not begin implementation until the user confirms to start the proposed release.
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

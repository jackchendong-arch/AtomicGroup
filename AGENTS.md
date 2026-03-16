# AGENTS.md

## Workflow Source of Truth
- Use `TODO.md` as the ordered source of truth for UI/UX follow-up work.
- Always start from the top incomplete item in `TODO.md`.
- Propose that top incomplete item first before starting implementation.

## Start Rule
- Do not begin implementation until the user confirms to start the proposed item.
- Once the user confirms, mark that item with `-` in `TODO.md` to show it is in progress before implementation begins.

## Completion Rule
- Implement and test the active item before moving on.
- After testing succeeds, wait for the user to confirm with `works`.
- Only after the user says `works`:
  - commit the changes
  - mark the item with `x` in `TODO.md`
  - move to the next item

## Sequencing Rule
- Work in `TODO.md` order unless the user explicitly reprioritizes.
- Keep the software in a working state after each completed item.
- Use the release-level checkbox only when the full release is completed and tested.

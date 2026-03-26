# Doc Generation Lessons

This document captures implementation and testing lessons from the hiring-manager Word report pipeline.

It is not the product spec.
Use [spec.md](/Users/jack/Dev/Repo/AtomicGroup/spec.md) for target architecture and [TODO.md](/Users/jack/Dev/Repo/AtomicGroup/TODO.md) for backlog state.
Use this file for practical engineering guidance when a new CV/JD format breaks report generation.

## Core Rule

The original CV is evidence, not report structure.

The correct pipeline is:

`source import -> normalized source blocks -> canonical candidate/profile data -> deterministic report view model -> Word template render`

Do not debug Word output by jumping straight to the template.
First determine which layer is wrong:

1. source extraction
2. canonical profile extraction
3. report view model projection
4. template structure
5. post-render Word output

## Common Failure Types

### 1. Parser Failures

Symptoms:
- education rows explode into many entries
- employment rows become company-only or role-only
- project names become sentence fragments
- section headings leak into bullets
- skills or languages become fake projects

Examples already seen:
- `CV4-1.pdf`
  - compact Chinese education rows
  - project section followed by `技能/优势及其他`
- `CV4-2.pdf`
  - delayed section headings
  - `company — role` employment rows
  - wrapped project bullets promoted into fake project titles
- `CV4-3.pdf`
  - weak embedded PDF text requiring OCR fallback
- `CV4-4.pdf`
  - generic candidate identity / section-derived label issues

### 2. Projection Failures

Symptoms:
- clean canonical data, but wrong template payload
- `field_of_study` duplicated from `degree_name`
- stale generated employment/project facts override fresh deterministic source facts
- narrative fields and factual fields get blended

### 3. Template Failures

Symptoms:
- repeated sentences
- duplicated bullets
- correct payload rendered incorrectly

Most common causes:
- same leaf placeholder repeated multiple times inside one loop
- wrong loop boundaries
- template drift ahead of the supported report view model

### 4. Quality-Gate Failures

Symptoms:
- export blocked for truly bad data
- or export blocked for valid but large project sections

Rule:
- do not use crude count-only blockers when the extracted names are clean
- block on suspicious content, not just volume

## Validation Rules We Should Keep

Before allowing export, verify:

1. identity is correct
- candidate name matches the CV
- role title matches the JD

2. education is plausible
- correct number of rows
- no empty degree/institution pair
- no employment/project text inside education

3. employment is plausible
- each row has a real role title
- company/role split is sensible
- chronology is coherent

4. project experience is plausible
- project titles are real project titles, not fragments
- no section headings inside bullets
- no skills/language spillover

5. rendering hygiene is clean
- no `undefined`
- no raw `{{...}}`
- no PDF artifacts / page markers / opaque OCR tokens

## What To Test First When A New CV Breaks

Do not start with full `.docx` generation.

Test in this order:

1. imported raw text
- are the right lines present?

2. canonical extraction
- `educationEntries`
- `employmentHistory`
- `projectExperiences`

3. report view model / template data
- `education_entries`
- `employment_experience_entries`
- `project_experience_entries`

4. only then render `.docx`

This catches parser and projection problems earlier and faster.

## Minimum Assertion Set For New CV Fixture Regressions

When a new CV format causes a bug, add unit tests for:

1. education
- expected row count
- expected degree/institution values

2. employment
- expected company
- expected role title
- expected date range

3. projects
- expected project names
- expected absence of fragment names
- expected absence of section-heading spillover in bullets

4. report view model
- no `undefined`
- no duplicated degree/field mapping unless intentional
- correct loop arrays populated

5. quality gate
- passes for clean output
- blocks only for real unreliability

## Unit Test Design Guidance

Prefer these test layers:

### Parser-level tests

Target:
- `extractDocumentDerivedProfile(...)`

Use when:
- source structure is the problem

Assert:
- parsed education
- parsed employment
- parsed projects
- no section spillover

### Projection-level tests

Target:
- `buildTemplateDataFromBriefing(...)`
- `prepareHiringManagerBriefingOutput(...)`

Use when:
- canonical facts are correct but Word fields are wrong

Assert:
- field mapping
- `field_of_study`
- date formatting
- loop arrays

### Word-render tests

Target:
- `renderHiringManagerWordDocument(...)`

Use when:
- template structure or post-render output is the problem

Assert:
- no placeholders
- no `undefined`
- key identity fields present
- repeated sections render once per item

## Triage Questions

When a report looks wrong, answer these in order:

1. Is the raw CV text actually present after import?
2. Is the canonical profile already wrong?
3. Is the report view model wrong even when the profile is correct?
4. Is the template repeating or misplacing correct fields?
5. Is the output blocked for the right reason, or is the quality gate too naive?

## Current Practical Lessons

1. Delayed headings are common.
- Do not assume `Education`, `Work Experience`, and `Projects` appear before their content.

2. Wrapped bullets are dangerous.
- Lowercase continuation lines should usually extend the previous bullet, not start a new project.

3. `company — role` is common and must split deterministically.

4. Compact education lines need special parsing.
- especially `date + institution | degree`

5. Large project sections are not automatically bad.
- high count alone is not a blocker if titles are clean

6. Fresh deterministic factual sections should win at export.
- do not trust stale generated fact rows over current source-derived facts

7. Template bugs and code bugs often coexist.
- fix both layers separately

## When To Update This File

Update this document when:
- a new CV/JD format introduces a new parser failure pattern
- a Word template issue reveals a new validation rule
- a quality gate blocks a valid report or misses an invalid one
- a new unit-test pattern should become standard

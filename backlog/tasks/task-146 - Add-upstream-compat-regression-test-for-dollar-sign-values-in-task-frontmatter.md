---
id: TASK-146
title: Add upstream-compat regression test for dollar-sign values in task frontmatter
status: Done
assignee: []
created_date: '2026-02-22 21:01'
updated_date: '2026-02-22 21:40'
labels:
  - compatibility
  - parser
  - tests
dependencies: []
references:
  - /workspace/tmp/mrlesk-Backlog.md-src/src/markdown/parser.ts
  - /workspace/src/core/BacklogParser.ts
  - /workspace/src/core/BacklogWriter.ts
  - /workspace/src/test/unit/upstreamCompat.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a targeted regression test to ensure task parsing/writing does not corrupt frontmatter values containing dollar-sign digit sequences (e.g. "$15,000"), mirroring upstream fix rationale from commit 3933eaf. Expected implementation is likely test-only if current parser already passes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New test fixture includes frontmatter/title (or other frontmatter scalar) with dollar-sign digit pattern such as `$15,000`.
- [x] #2 Parsing succeeds and preserves intended string value without token-expansion/corruption.
- [x] #3 If writer round-trip is in scope, serialize->parse round-trip preserves the same value.
- [x] #4 If test exposes a bug, minimal code fix is implemented with focused regression coverage; if no bug exists, task closes as test-only with explicit note.
- [x] #5 Test suite remains green for affected parser/writer tests.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added targeted compatibility regression coverage for dollar-sign numeric strings in task frontmatter (e.g., "$15,000"). Added an upstream-compat parser test confirming frontmatter parsing preserves the exact string value, and added a BacklogWriter round-trip test confirming parse->write->parse keeps the same title value. No parser/writer code changes were required because current behavior already preserves these values correctly.
<!-- SECTION:FINAL_SUMMARY:END -->

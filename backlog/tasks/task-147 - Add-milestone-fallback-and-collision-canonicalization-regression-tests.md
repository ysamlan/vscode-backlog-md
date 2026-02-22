---
id: TASK-147
title: Add milestone fallback and collision canonicalization regression tests
status: Done
assignee: []
created_date: '2026-02-22 21:44'
updated_date: '2026-02-22 21:45'
labels:
  - tests
  - compatibility
  - milestones
dependencies: []
references:
  - /workspace/src/core/BacklogParser.ts
  - /workspace/src/test/unit/BacklogParser.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add explicit parser regression tests for milestone behavior after TASK-144: (1) getMilestones() fallback to config string-array milestones when milestone files are absent, and (2) ambiguous title collisions should not canonicalize task milestone values to an ID.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added explicit regression coverage for milestone fallback and ambiguous title collisions. New tests verify: (1) getMilestones() falls back to config string-array milestones when milestone files are absent, and (2) task milestone canonicalization does not rewrite values when multiple milestone IDs share the same title. This closes the remaining coverage gap from TASK-144 without code changes.
<!-- SECTION:FINAL_SUMMARY:END -->

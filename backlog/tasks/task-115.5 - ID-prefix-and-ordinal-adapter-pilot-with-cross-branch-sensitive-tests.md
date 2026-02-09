---
id: TASK-115.5
title: ID-prefix and ordinal adapter pilot with cross-branch-sensitive tests
status: To Do
assignee: []
created_date: '2026-02-09 03:29'
labels:
  - upstream
  - ordering
  - testing
dependencies:
  - TASK-115.4
references:
  - /workspace/src/core/ordinalUtils.ts
  - /workspace/src/core/BacklogWriter.ts
  - /workspace/src/test/unit/CrossBranchTaskLoader.test.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/utils/prefix-config.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/core/reorder.ts
parent_task_id: TASK-115
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate upstream-derived ID/prefix normalization and ordinal/reorder semantics through adapters and prove parity in ordering and identity scenarios, including cross-branch duplicate-ID datasets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Integrate adapterized ID/prefix logic and ordinal calculation logic without breaking existing extension message/API behavior.
- [ ] #2 Add parity and regression coverage for zero-padded/custom-prefix IDs, subtask notation, and ordinal drop/rebalance behaviors.
- [ ] #3 Include cross-branch duplicate-ID and source-aware ordering scenarios in test coverage where relevant.
- [ ] #4 Verify full project validation suite passes after this migration slice (test, lint, typecheck).
<!-- AC:END -->

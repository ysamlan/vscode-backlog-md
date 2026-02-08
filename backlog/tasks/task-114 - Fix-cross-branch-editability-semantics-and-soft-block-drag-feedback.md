---
id: TASK-114
title: Fix cross-branch editability semantics and soft-block drag feedback
status: Done
assignee:
  - '@codex'
created_date: '2026-02-08 22:23'
updated_date: '2026-02-08 22:38'
labels:
  - bug
  - ux
  - cross-branch
  - safety
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align read-only behavior with upstream semantics so local tasks remain editable even when branch metadata is present, and provide explicit soft-block UX for blocked drag attempts on non-local tasks. Keep provider-level mutation guards as hard safety net.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Local tasks (source=local) remain editable even when branch is present.
- [x] #2 Only source=local-branch or source=remote tasks are treated as read-only.
- [x] #3 List and kanban drag attempts on read-only tasks show explicit feedback (soft block) without silent failure.
- [x] #4 Task detail remains hard read-only for non-local tasks and editable for local tasks.
- [x] #5 Provider mutation guards continue blocking non-local writes and allow local writes.
- [x] #6 Regression tests cover local+branch editability and read-only drag feedback paths.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated read-only semantics to be source-based so local tasks remain editable even with branch metadata. Added explicit soft-block drag feedback in list and kanban via toast messaging on read-only drag attempts while keeping provider-level mutation guards as the hard safety net. Added regression coverage for local+branch editability and read-only drag feedback in unit tests and Playwright, then verified with `bun run test && bun run lint && bun run typecheck`.
<!-- SECTION:FINAL_SUMMARY:END -->

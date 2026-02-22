---
id: TASK-144
title: Align milestone sourcing and resolution with upstream milestone-file model
status: Done
assignee: []
created_date: '2026-02-22 21:01'
updated_date: '2026-02-22 21:36'
labels:
  - compatibility
  - milestones
  - upstream
dependencies: []
references:
  - /workspace/tmp/mrlesk-Backlog.md-src/src/file-system/operations.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/core/milestones.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/mcp/tools/tasks/handlers.ts
  - '/workspace/src/core/BacklogParser.ts:339'
  - '/workspace/src/providers/TaskDetailProvider.ts:327'
  - '/workspace/src/webview/components/kanban/KanbanBoard.svelte:72'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring extension milestone behavior in line with upstream changes introduced after 4cb4a2b (notably c1fea74 and 9108486): milestone files under backlog/milestones should be the source of truth, and task milestone values should resolve/canonicalize against known milestone IDs/titles. Current extension behavior still treats config.milestones as canonical in parser/provider paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backlog parser/provider stack can load milestones from milestone files (`backlog/milestones/m-*.md`) and represent both ID and display title in extension types.
- [x] #2 Task detail milestone dropdown/options use milestone-file data as primary source, with task-derived fallback values only for unknown/unconfigured milestones.
- [x] #3 Milestone grouping/sorting in Kanban and related views no longer assumes `config.milestones` as source-of-truth; behavior is covered for ID/title display consistency.
- [x] #4 When task milestone values contain recognized title aliases, extension resolves/persists canonical milestone ID (or explicitly documents and tests any intentional divergence).
- [x] #5 Unit tests added/updated for parser milestone loading, provider option construction, and ID/title rendering edge cases (including archived/duplicate title collisions if supported scope includes them).
- [x] #6 README or compatibility notes are updated to reflect milestone-file sourcing behavior and any known limits.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented milestone-file-first compatibility with upstream behavior: parser now sources milestones from backlog/milestones before config fallback, task milestone values are canonicalized against known milestone IDs/titles when unambiguous, task detail milestone options now carry id+label with unknown-value fallback, and kanban/list milestone grouping/filtering use milestone IDs for stable behavior while displaying labels. Added/updated unit tests for parser loading/canonicalization and task-detail milestone option/update behavior, updated webview types/components for id+label milestone options, and documented milestone-file sourcing in README.
<!-- SECTION:FINAL_SUMMARY:END -->

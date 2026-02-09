---
id: TASK-118
title: Allow opening cross-branch task detail via source-aware task identity
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 02:20'
updated_date: '2026-02-09 02:29'
labels:
  - bug
  - cross-branch
  - task-detail
  - ux
dependencies: []
references:
  - src/providers/TaskDetailProvider.ts
  - src/providers/TasksViewProvider.ts
  - src/webview/components/tasks/Tasks.svelte
  - src/core/BacklogParser.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix task detail opening for cross-branch tasks that do not exist locally by threading source identity metadata from list/kanban click events and resolving the exact task variant in TaskDetailProvider. Preserve backward compatibility for legacy openTask(taskId) callers and keep non-local tasks read-only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 openTask message includes enough identity metadata (filePath/source/branch) from list and kanban interactions to disambiguate duplicate IDs.
- [x] #2 TaskDetailProvider can resolve and open cross-branch task variants when parser.getTask(taskId) misses or returns a different local variant.
- [x] #3 Detail opening remains backward compatible for existing taskId-only callers.
- [x] #4 Cross-branch tasks open in detail as read-only with existing read-only messaging; local tasks remain editable.
- [x] #5 Unit and Playwright tests cover metadata threading and cross-branch detail resolution paths, including duplicate-ID scenarios.
- [x] #6 `bun run test && bun run lint && bun run typecheck` pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented source-aware task identity for detail opening by threading openTask metadata (filePath/source/branch) from list/kanban UI through TasksViewProvider and command handling to TaskDetailProvider. Added identity-based resolution in TaskDetailProvider that prefers exact filePath matches from cross-branch task loading, while preserving taskId-only compatibility and local editability. Added unit coverage for duplicate-ID cross-branch resolution and Playwright expectations for enriched openTask payloads. Verified with bun run test && bun run lint && bun run typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->

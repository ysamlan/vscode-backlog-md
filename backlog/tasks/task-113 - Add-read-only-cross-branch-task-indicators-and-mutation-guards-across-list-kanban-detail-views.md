---
id: TASK-113
title: >-
  Add read-only cross-branch task indicators and mutation guards across
  list/kanban/detail views
status: Done
assignee:
  - '@codex'
created_date: '2026-02-08 22:02'
updated_date: '2026-02-08 22:11'
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
Cross-branch/remote tasks should be clearly view-only and protected from all mutating actions in the VS Code extension UI. Implement upstream-aligned behavior with enhanced UX: visible branch/source indicators in list/kanban/detail, disabled mutating controls, and explicit inline error/toast feedback when mutation is attempted. Add provider-level guardrails so writes are blocked even if UI is bypassed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Non-local tasks (source remote/local-branch or branch present) are visually marked read-only in list and kanban views.
- [x] #2 List rows include a compact branch/source indicator icon and label.
- [x] #3 Task detail view shows a read-only banner with explicit branch/source context.
- [x] #4 Mutating actions are blocked for read-only tasks (status change, drag/reorder, complete/archive/delete/restore/promote/discard, checklist toggles, inline metadata/description updates).
- [x] #5 Blocked mutation attempts show explicit inline error/toast or provider-surfaced error messaging; no silent failures.
- [x] #6 Local tasks remain fully editable with existing behavior unchanged.
- [x] #7 Regression tests cover read-only blocking and local-task happy paths in provider unit tests and Playwright UI tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add core helper `isReadOnlyTask(task)` to centralize non-local editability logic based on `source` and `branch`.
2. Add failing tests first: provider unit tests for mutation blocking and Playwright tests for read-only indicators/blocked interactions.
3. Add provider-level guardrails in `TasksViewProvider` and `TaskDetailProvider` to reject all mutating actions for read-only tasks with explicit user-facing error messages.
4. Update list/kanban UI to show read-only branch/source indicators and disable mutating affordances for read-only tasks while keeping open/view interactions intact.
5. Update task-detail webview payload and components to show read-only banner and disable/hide mutating controls and actions.
6. Run full validation: `bun run test && bun run lint && bun run typecheck`.
7. Update backlog notes/final summary, check acceptance criteria, set task Done, and commit with task reference.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shared read-only helpers (`isReadOnlyTask`, `getReadOnlyTaskContext`) and used them in both providers and webview components.

Added provider-level mutation guards in `TasksViewProvider` and `TaskDetailProvider` with explicit read-only messaging.

Added list/kanban read-only source indicators and disabled drag/reorder affordances for non-local tasks.

Added task-detail read-only banner and disabled/hid all mutating controls while preserving view/open/filter interactions.

Added/updated unit and Playwright coverage for read-only metadata, mutation blocking, indicators, and disabled controls.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented full read-only UX and mutation safety for cross-branch/remote tasks across list, kanban, and task-detail views. Non-local tasks are now visually labeled with source/branch context, all mutating affordances are disabled in the webview, and provider-side guardrails block mutation attempts with explicit user-facing errors. Added regression coverage in unit tests (both providers) and Playwright tests (tasks + task-detail) and verified with full test/lint/typecheck validation.
<!-- SECTION:FINAL_SUMMARY:END -->

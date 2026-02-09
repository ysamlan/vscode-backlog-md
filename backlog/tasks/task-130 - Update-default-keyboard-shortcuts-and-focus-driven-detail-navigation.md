---
id: TASK-130
title: Update default keyboard shortcuts and focus-driven detail navigation
status: Done
assignee: []
created_date: '2026-02-09 21:47'
updated_date: '2026-02-09 21:47'
labels:
  - ui
  - ux
  - keyboard
dependencies:
  - TASK-84
references:
  - src/webview/components/tasks/Tasks.svelte
  - src/webview/components/shared/TaskCard.svelte
  - src/webview/components/list/ListView.svelte
  - src/webview/components/shared/KeyboardShortcutsPopup.svelte
  - src/providers/TasksViewProvider.ts
  - src/core/types.ts
  - e2e/keyboard-shortcuts.spec.ts
  - e2e/tasks.spec.ts
  - e2e/docs-decisions.spec.ts
  - src/test/unit/TasksViewProvider.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply keyboard UX adjustments in the Tasks webview: remove default shortcuts for dashboard/documents/decisions, add `e` to open full edit view, auto-select tasks when keyboard focus moves between cards/rows, and make Enter move focus to the detail panel instead of opening the task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Default keyboard shortcuts no longer include `d` (dashboard), `b` (documents), or `m` (decisions).
- [x] #2 Pressing `e` opens the currently focused task in full edit/detail view.
- [x] #3 When keyboard focus moves to a different task card/list row, that task is selected immediately for the detail preview.
- [x] #4 Pressing Enter while a task card/list row is focused sends focus to the details panel rather than opening/selecting the task.
- [x] #5 Keyboard shortcuts help text and automated tests reflect the updated behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the default shortcut/nav behavior update as a separate task from configurable shortcut settings. Removed hardcoded d/b/m tab shortcuts, added `e` for opening the focused task in full edit view, made keyboard focus movement auto-select tasks for detail preview, and changed Enter to send a dedicated focusTaskPreview action. Updated shortcut help copy plus unit/e2e coverage. Validation completed with `bun run test && bun run lint && bun run typecheck`.
<!-- SECTION:FINAL_SUMMARY:END -->

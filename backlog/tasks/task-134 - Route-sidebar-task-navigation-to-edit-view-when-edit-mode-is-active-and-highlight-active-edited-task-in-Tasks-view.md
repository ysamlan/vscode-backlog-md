---
id: TASK-134
title: >-
  Route sidebar task navigation to edit view when edit mode is active and
  highlight active edited task in Tasks view
status: To Do
assignee: []
created_date: '2026-02-09 23:34'
labels:
  - feature
  - navigation
  - task-detail
  - tasks-view
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve task navigation UX by making sidebar selection behavior mode-aware and visually synchronized with the currently open edit/detail editor.

Problem:
- Today, selecting tasks from the Tasks sidebar generally drives the compact/readonly preview flow.
- When a user is already working in full task edit/detail windows, selecting another task in the sidebar should continue that workflow by replacing/focusing the full edit view with the selected task.
- The sidebar should also clearly indicate which task is currently open in the active full edit view, across both kanban cards and list rows.

Desired behavior:
1) If a task is currently open in full Task Detail edit view, selecting another task from sidebar list/kanban should open/focus that task in full Task Detail edit view (rather than only routing to compact preview behavior).
2) Tasks view should visually highlight any task card/row that corresponds to the task currently open in the active full edit/detail editor.

Scope notes:
- Preserve existing lightweight preview behavior when user is not in edit/detail mode.
- Work for both list and kanban interactions.
- Ensure behavior remains correct with cross-branch/read-only contexts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When no Task Detail edit view is active, sidebar task selection keeps existing preview-oriented behavior (no regression).
- [ ] #2 When a Task Detail edit view is active, clicking or keyboard-selecting a task in sidebar list/kanban opens or retargets the full Task Detail editor to that selected task.
- [ ] #3 If a full Task Detail editor is already open, navigating tasks from sidebar reuses/focuses the edit flow consistently instead of falling back to preview-only navigation.
- [ ] #4 Tasks sidebar visually highlights the task currently open in the active full edit/detail view in both kanban card and list row renderings.
- [ ] #5 Active-task highlight updates when the active editor changes (including switching between tasks, closing detail editor, and focusing non-task editors).
- [ ] #6 Cross-branch/read-only task contexts preserve correct routing and highlight behavior without enabling forbidden edits.
- [ ] #7 Unit tests cover routing decision logic (preview vs full edit) and active-editor state propagation.
- [ ] #8 Playwright webview tests cover highlight rendering in list and kanban, and message-driven state updates for active edited task.
<!-- AC:END -->

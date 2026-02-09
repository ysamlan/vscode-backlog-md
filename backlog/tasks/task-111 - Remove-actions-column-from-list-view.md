---
id: TASK-111
title: Remove actions column from list view
status: Done
assignee: []
created_date: '2026-02-08'
updated_date: '2026-02-09 02:35'
labels:
  - ui
  - list-view
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The "actions" column in the list view takes up horizontal space for minimal benefit. It contains contextual action buttons (complete, promote, restore, delete) that appear only in certain view states, and is often empty for regular tasks.

**Current behavior:**
- Regular tasks (non-Done): empty cell
- Done-status tasks: "Move to Completed" button (checkmark icon)
- Drafts view: "Promote to Task" button (arrow-up icon)
- Archived view: "Restore" and "Delete Permanently" buttons

**Proposed change:**
Remove the actions column entirely. These actions can be accessed through the task detail view instead, where the action buttons are already available in the header.

**Key files:**
- `src/webview/components/list/ListView.svelte` — actions column header (around line 386) and action cells (lines 613-664)
- `src/webview/styles.css` — `.actions-header` and `.actions-cell` styles (lines 841-877)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Actions column is removed from all list view variants (tasks, drafts, archived)
- [x] #2 Associated CSS is cleaned up
- [x] #3 Complete/promote/restore/delete actions remain accessible via task detail view
- [x] #4 List view table renders correctly without the extra column
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the list-view actions column and all row-level action buttons across tasks, drafts, and archived list variants. Cleaned up the now-unused list action CSS and removed list action wiring from Tasks -> ListView props/handlers. Added Playwright coverage to assert there is no actions header or action buttons in list views, including the custom-status list scenario. Ran required validation: bun run test && bun run lint && bun run typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->

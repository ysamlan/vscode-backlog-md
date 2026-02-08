---
id: TASK-111
title: Remove actions column from list view
status: To Do
priority: medium
created_date: 2026-02-08
labels: [ui, list-view]
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
- [ ] #1 Actions column is removed from all list view variants (tasks, drafts, archived)
- [ ] #2 Associated CSS is cleaned up
- [ ] #3 Complete/promote/restore/delete actions remain accessible via task detail view
- [ ] #4 List view table renders correctly without the extra column
<!-- AC:END -->

---
id: TASK-80
title: Add drag-and-drop reordering to list view
status: Done
assignee: []
created_date: '2026-02-05'
updated_date: '2026-02-05 19:38'
labels:
  - feature
  - ui
dependencies:
  - TASK-79
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The kanban view supports drag-and-drop reordering of tasks within columns (updating ordinals via `calculateOrdinalsForDrop`). The list view has no drag-and-drop support.

Add drag-and-drop row reordering to the list view so users can manually order tasks. This should use the same ordinal system as kanban — dragging a row recalculates ordinals and sends `reorderTasks` messages.

**Acceptance criteria:**
- Users can drag table rows to reorder tasks in the list view
- Reordering sends `reorderTasks` messages with updated ordinals (same as kanban)
- Visual drag feedback (drag handle, drop indicator line)
- Drag-and-drop only available when sorted by status (ordinal-based sorting)
- When sorted by other fields (title, priority), drag reordering is disabled
- Reordering persists across view switches (kanban shows same order)
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented in commit 5e29c1d. List view supports drag-and-drop reordering with ordinal-based ordering.
<!-- SECTION:FINAL_SUMMARY:END -->

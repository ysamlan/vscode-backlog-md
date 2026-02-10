---
id: TASK-65
title: Support drag-and-drop reordering within Kanban columns
status: Done
assignee: []
created_date: '2026-02-04 01:26'
updated_date: '2026-02-04 20:50'
labels:
  - 'epic:kanban-board'
  - enhancement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to drag cards within the same column to reorder them. This requires persisting sort order in the task file (e.g., a `sort_order` or `position` field in frontmatter) so the custom order is preserved across sessions.

Currently dragging between columns changes status, but reordering within a column is not supported.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dragging a card within the same column reorders it
- [x] #2 Order is persisted to task file frontmatter
- [x] #3 Order survives extension reload
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Already implemented. Verified all acceptance criteria:
- Same-column drag reordering with fractional ordinal calculation (TasksViewProvider.ts:276-296, 322-345)
- Order persisted to `ordinal` frontmatter field via BacklogWriter (TasksViewProvider.ts:779-792)
- Ordinal survives reload as it's stored in task YAML frontmatter
<!-- SECTION:FINAL_SUMMARY:END -->

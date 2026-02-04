---
id: TASK-65
title: Support drag-and-drop reordering within Kanban columns
status: To Do
assignee: []
created_date: '2026-02-04 01:26'
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
- [ ] #1 Dragging a card within the same column reorders it
- [ ] #2 Order is persisted to task file frontmatter
- [ ] #3 Order survives extension reload
<!-- AC:END -->

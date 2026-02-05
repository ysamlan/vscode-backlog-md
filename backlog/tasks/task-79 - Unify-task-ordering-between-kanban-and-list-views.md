---
id: TASK-79
title: Unify task ordering between kanban and list views
status: To Do
assignee: []
created_date: '2026-02-05'
labels: [feature, ui]
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The kanban view uses ordinals (`sortCardsByOrdinal`) to order tasks within columns — tasks with ordinals come first (sorted ascending), then tasks without ordinals (sorted by ID). The list view ignores ordinals entirely and sorts by user-selected fields (title, status, priority).

When the list view sorts by status (its default), tasks within each status group should respect ordinal ordering to match the kanban view. This ensures a consistent experience: if a user reorders tasks in kanban, they see the same order when switching to list view (when sorted by status).

**Acceptance criteria:**
- List view default sort (by status) respects ordinal ordering within each status group
- Tasks with ordinals appear before tasks without ordinals within each group
- Sorting by other fields (title, priority) still uses alphabetical/priority ordering
- Existing sort direction toggle (asc/desc) still works
<!-- SECTION:DESCRIPTION:END -->

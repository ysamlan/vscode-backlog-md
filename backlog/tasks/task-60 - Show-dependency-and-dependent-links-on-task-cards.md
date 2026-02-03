---
id: TASK-60
title: Show dependency and dependent links on task cards
status: To Do
assignee: []
created_date: '2026-02-03 16:28'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task cards in the Kanban and Task List views should display clickable links to both:

1. **Dependencies** - tasks this task depends on (already tracked in frontmatter `dependencies` field)
2. **Dependents** - tasks that depend on this task (computed by scanning other tasks' dependencies)

This helps users understand the task graph and navigate between related tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task cards show dependency links (tasks this depends on)
- [ ] #2 Task cards show dependent links (tasks depending on this)
- [ ] #3 Links are clickable and navigate to the linked task
- [ ] #4 Works in both Kanban and Task List views
<!-- AC:END -->

---
id: TASK-54
title: Implement task creation in BacklogWriter
status: To Do
assignee: []
created_date: '2026-02-03 03:14'
labels: []
dependencies:
  - TASK-53
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add createTask(task: Partial<Task>) method. Generate ID from config task_prefix and next available number. Generate filename: task-N - Title-Slug.md. Write frontmatter + sections using template.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createTask method exists
- [ ] #2 ID generated from config task_prefix
- [ ] #3 Filename uses task-N - Title-Slug.md format
- [ ] #4 New task has proper frontmatter and sections
<!-- AC:END -->

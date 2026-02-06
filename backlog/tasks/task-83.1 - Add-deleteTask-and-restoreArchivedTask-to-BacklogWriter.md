---
id: TASK-83.1
title: Add deleteTask and restoreArchivedTask to BacklogWriter
status: Done
assignee: []
created_date: '2026-02-06 02:26'
updated_date: '2026-02-06 17:57'
labels:
  - backend
dependencies: []
parent_task_id: TASK-83
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement two new methods in BacklogWriter:
- `deleteTask(taskId, parser)` — permanently deletes the task file
- `restoreArchivedTask(taskId, parser)` — moves from archive/tasks/ back to tasks/
<!-- SECTION:DESCRIPTION:END -->

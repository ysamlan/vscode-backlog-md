---
id: TASK-29
title: Implement task creation form
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-03 17:32'
labels:
  - 'epic:task-crud'
  - 'phase:7'
milestone: MVP Release
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a form/dialog for creating new tasks with title, description, status, priority, labels, milestone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create task button in views
- [x] #2 Form with title (required)
- [x] #3 Optional: description, priority, labels, milestone
- [x] #4 Creates new .md file in backlog/tasks/
- [x] #5 Auto-generates task ID
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

- Added createTask() method to BacklogWriter with full test coverage
- Auto-generates task ID based on highest existing ID
- Sanitizes title for safe filename generation
- Creates proper YAML frontmatter with all fields
- Added VS Code command 'backlog.createTask' with input dialogs
- Added + button to Kanban and Task List view titles
- Creates task file and opens it in task detail view
<!-- SECTION:NOTES:END -->

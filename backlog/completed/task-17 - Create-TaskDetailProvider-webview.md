---
id: TASK-17
title: Create TaskDetailProvider webview
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-03 16:50'
labels:
  - 'epic:task-detail'
  - 'phase:5'
milestone: MVP Release
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a webview panel that shows full task details when a task is selected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Open as panel or editor
- [x] #2 Show task title, status, priority
- [x] #3 Show description
- [x] #4 Show labels and assignees
- [x] #5 Show milestone and dependencies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

- Created TaskDetailProvider as a WebviewPanel (opens in editor area)
- Shows task title, ID, status badge, priority badge
- Shows description in styled container
- Displays labels, assignees, milestone, dependencies in metadata grid
- Renders acceptance criteria and definition of done as checklists
- Dependency links are clickable to navigate to other tasks
- "Open Raw Markdown" button to view the source file
- Kanban and TaskList now use backlog.openTaskDetail command
<!-- SECTION:NOTES:END -->

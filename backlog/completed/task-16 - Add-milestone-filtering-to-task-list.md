---
id: TASK-16
title: Add milestone filtering to task list
status: Done
assignee: []
created_date: '2026-02-02 23:21'
updated_date: '2026-02-04 20:26'
labels:
  - 'epic:task-list-view'
  - 'phase:4'
milestone: MVP Release
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add dropdown or filter to show only tasks from a specific milestone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestone dropdown/filter
- [x] #2 Show all milestones from tasks
- [x] #3 Filter tasks by selected milestone
- [x] #4 Clear milestone filter option
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented milestone filtering in the task list view:

- Added milestone dropdown to filter buttons section in list view
- Dropdown populates from both config milestones and milestones found on tasks
- Selection filters the task list to show only matching tasks
- "All Milestones" option clears the filter
- Filter state persists during session

Files modified:
- src/providers/TasksViewProvider.ts - Added dropdown UI, state management, filter logic, and milestone message handling
- src/webview/styles.css - Added .milestone-filter styling

Also enhanced test workspace with milestones and additional test tasks.
<!-- SECTION:FINAL_SUMMARY:END -->

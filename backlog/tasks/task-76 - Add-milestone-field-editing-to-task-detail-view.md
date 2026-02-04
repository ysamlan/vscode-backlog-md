---
id: TASK-76
title: Add milestone field editing to task detail view
status: To Do
assignee: []
created_date: '2026-02-04 20:20'
labels:
  - feature
  - ui
dependencies: []
references:
  - src/providers/TaskDetailProvider.ts
  - src/providers/TasksViewProvider.ts (milestone dropdown implementation)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the ability to view and edit the milestone field in the TaskDetailProvider webview.

Currently the task detail view shows various metadata fields (status, priority, labels, assignees) but does not display or allow editing the milestone field. Users should be able to:

1. See the current milestone (if set) in the task metadata section
2. Select from existing milestones defined in config.yml
3. Select from milestones used by other tasks (not in config)
4. Clear the milestone (set to none)

This mirrors the milestone filtering feature in the list view (TASK-16) but provides editing capability in the detail view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Milestone field appears in task detail metadata section
- [ ] #2 Dropdown shows all milestones from config + milestones used by tasks
- [ ] #3 User can select a milestone to assign it to the task
- [ ] #4 User can clear the milestone ("None" option)
- [ ] #5 Changes are saved to the task markdown file
<!-- AC:END -->

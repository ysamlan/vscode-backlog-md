---
id: TASK-68
title: Replace multi-dialog task creation with single-screen webview
status: To Do
assignee: []
created_date: '2026-02-04 01:57'
labels:
  - enhancement
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current "Create Task" flow (`backlog.createTask` command) uses a series of VS Code dialogs (showInputBox for title, showInputBox for description, showQuickPick for priority, showInputBox for labels). This is clunky and requires multiple interactions.

**Goal:** Replace with a single webview panel similar to the task detail view, but focused on creation with minimal fields.

**Design:**
- Single webview panel with:
  - Title field (required)
  - Description field (optional, markdown textarea)
  - "Create Task" button
- Default values (not shown in UI):
  - Priority: medium
  - Status: To Do
- On save:
  - Create the task file
  - Close the creation panel
  - Open the TaskDetailProvider with the new task (so user can add labels, change priority, etc.)

**Reference:** Look at `TaskDetailProvider.ts` for webview patterns. The creation panel should reuse similar styling but with a simpler, focused layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Create Task command opens a webview panel instead of dialogs
- [ ] #2 Panel has title input field (required) and description textarea (optional)
- [ ] #3 Panel has a Create Task button that saves and redirects to detail view
- [ ] #4 New tasks default to medium priority and To Do status
- [ ] #5 After creation, TaskDetailProvider opens with the new task
- [ ] #6 Existing styling/theming from TaskDetailProvider is reused
<!-- AC:END -->

---
id: TASK-83
title: Add archive and delete actions to task detail view
status: To Do
assignee: []
created_date: '2026-02-06 02:12'
updated_date: '2026-02-06 02:12'
labels:
  - ui
  - archive
dependencies:
  - TASK-82
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the task detail webview to support archive and delete actions with appropriate UX for each task state.

**For regular (non-archived) tasks:**
- Add "Archive" button — moves task to archive immediately, no confirmation needed
- Add "Delete" button — permanently deletes the task file, requires confirmation modal

**For archived tasks (viewed from the Archived tab):**
- Add "Restore" button — moves task back from archive to tasks/, no confirmation
- Add "Delete Permanently" button — deletes the file, requires confirmation modal

**For draft tasks:**
- Keep existing "Discard Draft" and "Promote to Task" buttons as-is

**Current state:**
- TaskDetailProvider already handles `archiveTask` message (line 377) with confirmation
- TaskDetailProvider handles `discardDraft` (line 352) with confirmation
- BacklogWriter has `archiveTask()` method
- No `deleteTask()` or `restoreArchivedTask()` methods exist yet

**Changes needed:**
- Add `deleteTask(taskId, parser)` to BacklogWriter — deletes the file permanently
- Add `restoreArchivedTask(taskId, parser)` to BacklogWriter — moves from archive/tasks/ back to tasks/
- TaskDetailProvider: handle new message types (deleteTask, restoreTask)
- ActionButtons.svelte: conditionally show archive/delete/restore based on task state
- Remove confirmation for archive action (keep for delete)
- TaskDetail.svelte: detect if task is archived (by file path or status)

**Files:** src/core/BacklogWriter.ts, src/providers/TaskDetailProvider.ts, src/webview/components/task-detail/ActionButtons.svelte, src/webview/components/task-detail/TaskDetail.svelte, src/webview/lib/types.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regular tasks show Archive (no confirm) and Delete (with confirm) buttons
- [ ] #2 Archived tasks show Restore (no confirm) and Delete Permanently (with confirm) buttons
- [ ] #3 Draft tasks keep existing Discard/Promote buttons
- [ ] #4 Archive moves task to backlog/archive/tasks/
- [ ] #5 Restore moves task from archive back to tasks/
- [ ] #6 Delete permanently removes the file
- [ ] #7 Unit tests for deleteTask and restoreArchivedTask in BacklogWriter
- [ ] #8 Unit tests for new message handlers in TaskDetailProvider
<!-- AC:END -->

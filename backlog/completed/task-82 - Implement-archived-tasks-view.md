---
id: TASK-82
title: Implement archived tasks view
status: Done
assignee: []
created_date: '2026-02-06 02:12'
updated_date: '2026-02-06 17:57'
labels:
  - ui
  - archive
dependencies:
  - TASK-81
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an "Archived" view mode that displays archived tasks in the same webview, accessible via the new tab control.

**Current state:**
- BacklogParser has no `getArchivedTasks()` method — archived tasks live in `backlog/archive/tasks/`
- TasksViewProvider.refresh() only loads tasks or drafts, not archived
- ListView component could be reused with an `isArchivedView` flag (similar to `isDraftsView`)

**Changes needed:**
- Add `getArchivedTasks()` to BacklogParser (scan `backlog/archive/tasks/*.md`)
- Add `'archived'` to the ViewMode type union
- TasksViewProvider.setViewMode('archived') loads archived tasks via parser
- TasksViewProvider.refresh() handles archived mode
- ListView gets `isArchivedView` prop — shows restore/delete actions instead of filters
- Tasks.svelte handles the archived view mode (shows ListView with archived flag)

**Files:** src/core/BacklogParser.ts, src/providers/TasksViewProvider.ts, src/webview/components/tasks/Tasks.svelte, src/webview/components/list/ListView.svelte, src/core/types.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Archived tab loads tasks from backlog/archive/tasks/
- [ ] #2 Archived tasks display in list format with restore and delete actions
- [ ] #3 Empty state shown when no archived tasks exist
- [ ] #4 Unit tests for getArchivedTasks and archived view mode
<!-- AC:END -->

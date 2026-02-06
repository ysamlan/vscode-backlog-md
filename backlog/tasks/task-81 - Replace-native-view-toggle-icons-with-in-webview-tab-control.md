---
id: TASK-81
title: Replace native view toggle icons with in-webview tab control
status: Done
assignee: []
created_date: '2026-02-06 02:12'
updated_date: '2026-02-06 17:57'
labels:
  - ui
  - navigation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current kanban/list/drafts view switching uses VS Code native title bar icons with `when` clause visibility toggling. This is confusing — buttons appear/disappear unpredictably and there's no visual indication of which view is active.

Replace with a proper tab bar rendered inside the webview (Tasks.svelte) at the top of the view. Four tabs: **Kanban | List | Drafts | Archived**. The active tab should be visually distinct (bold text + accent underline or background). Clicking a tab sends a message to the extension to switch view mode.

**Current state:**
- 3 commands registered in package.json (backlog.showListView, showKanbanView, showDraftsView)
- Commands shown in view/title menu with conditional `when` clauses
- extension.ts registers command handlers that call tasksProvider.setViewMode()
- TasksViewProvider.setViewMode() persists state and sends viewModeChanged/draftsModeChanged messages
- Tasks.svelte conditionally shows KanbanBoard or ListView based on viewMode/draftsMode state

**Changes needed:**
- Add a TabBar component in src/webview/components/shared/ (or inline in Tasks.svelte)
- Tab bar renders 4 buttons: Kanban, List, Drafts, Archived
- Active tab has distinct styling (bold + accent color or underline)
- Clicking sends `{ type: 'setViewMode', mode: 'kanban' | 'list' | 'drafts' | 'archived' }` to extension
- TasksViewProvider handles the new message type (reuses existing setViewMode logic)
- Remove the 3 native commands from package.json menus (keep commands registered for keybinding use)
- Tasks.svelte receives viewMode from extension and passes it to TabBar for active state

**Files:** package.json, src/extension.ts, src/providers/TasksViewProvider.ts, src/webview/components/tasks/Tasks.svelte, src/core/types.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tab bar visible at top of tasks webview with 4 tabs
- [ ] #2 Active tab is visually distinct (bold/colored/underlined)
- [ ] #3 Clicking inactive tab switches view correctly
- [ ] #4 View mode persists across extension restarts
- [ ] #5 Native title bar toggle icons removed from menu
- [ ] #6 Unit tests for new message handling in TasksViewProvider
<!-- AC:END -->

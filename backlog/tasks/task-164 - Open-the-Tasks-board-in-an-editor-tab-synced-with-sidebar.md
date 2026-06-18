---
id: TASK-164
title: Open the Tasks board in an editor tab (synced with sidebar)
status: To Do
assignee: []
created_date: '2026-06-18 16:28'
updated_date: '2026-06-18 17:00'
labels:
  - feature
  - ui
dependencies: []
references:
  - 'https://github.com/ysamlan/vscode-backlog-md/issues/28'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let users open the Tasks board (kanban/list/etc.) as a full-width VS Code **editor tab**, not only in the narrow activity-bar sidebar. The board — especially kanban — is cramped in the sidebar; the editor area gives it room to breathe. Requested in GitHub issue #28.

This is an umbrella task, delivered via two subtasks (see children). It tracks the maintainer-agreed design so the implementing agents share the same decisions:

**Agreed design decisions:**
- **Independent + disk-synced:** the editor-tab board and the sidebar board are separate webview instances. Both always reflect the same tasks and live-update on file changes, but each keeps its **own view state** (active tab/view mode, filters, collapsed columns). Their view modes are NOT mirrored — the whole point of having both is to view different things (e.g. kanban in the tab, a filtered list in the sidebar).
- **Click UX uses editor groups, not embedded panes:** clicking a task in the editor-tab board opens the task detail in a `ViewColumn.Beside` editor group (reusing the existing `TaskDetailProvider`), NOT a pane rendered inside the Tasks webview. Single-click opens/updates the detail beside with focus retained on the board (peek/browse); double-click moves focus into the detail. This avoids building and maintaining a second task-detail renderer.
- **Sidebar behavior unchanged:** sidebar single-click still drives the existing Details preview pane.

Subtask breakdown: (1) refactor the Tasks view into a host-agnostic controller (no behavior change); (2) add the editor-tab panel, command, click UX, and sync wiring on top of that controller.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delivered on one branch (feat/issue-28-tasks-editor-tab), one PR, two commits — one per subtask.

Sequencing:
1. TASK-164.1 — extract host-agnostic `TasksController` from `TasksViewProvider` (no behavior change). `TasksViewProvider` becomes a thin `WebviewViewProvider` adapter delegating to the controller. Shared `getTasksWebviewHtml()` helper for the webview HTML (identical for sidebar + editor hosts). Host interface kept minimal: `{ kind: 'sidebar' | 'editor'; postMessage(); isReady() }`.
2. TASK-164.2 — add `TasksPanelProvider` (singleton WebviewPanel, host kind 'editor') reusing the controller; `backlog.openTasksInEditor` command + affordance; thread a `ViewColumn.Beside` hint into `TaskDetailProvider.openTask()`; fan out extension.ts wiring (file-watch refresh, switchActiveBacklog, parser/workspaceRoot/dataSource/integration/active-task) to the panel when open. Click UX: single-click = peek beside (focus stays on board), double-click = open beside + focus. Per-host runtime view state.

Existing src/test/unit/TasksViewProvider.test.ts is the regression net for step 1 (it black-box-tests the provider's public API + message handling, which must stay identical).
<!-- SECTION:PLAN:END -->

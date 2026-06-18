---
id: TASK-164.2
title: >-
  Add editor-tab Tasks board: command, panel, peek-beside click UX, and sidebar
  sync
status: To Do
assignee: []
created_date: '2026-06-18 16:29'
labels:
  - feature
  - ui
dependencies:
  - TASK-164.1
parent_task_id: TASK-164
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build on the host-agnostic `TasksController` (TASK-164.1) to let users open the Tasks board as a full-width editor tab, synced with the sidebar. Implements the maintainer-agreed UX from parent TASK-164.

**Agreed behavior (restated for an independent implementer):**
- **Independent + disk-synced:** the editor-tab board and the sidebar board are separate webview instances. Both reflect the same tasks and live-update on file changes, but each keeps its OWN view state (active tab/view mode, filters, collapsed columns). Do NOT mirror view modes between them.
- **Click UX (editor groups, not embedded panes):** single-click a card/row → open/update the task detail in a `ViewColumn.Beside` editor group, keeping focus on the board (peek/browse); double-click → open beside AND move focus into the detail. Reuse the existing `TaskDetailProvider` — do not render a detail pane inside the Tasks webview.
- **Sidebar unchanged:** sidebar single-click still drives the Details preview pane.

Local context for the implementer:
- Mirror the singleton `WebviewPanel` pattern in `src/providers/TaskDetailProvider.ts` and `src/providers/TaskCreatePanel.ts`. Add a `TasksPanelProvider` that creates/reveals one panel via `vscode.window.createWebviewPanel` and binds a `TasksController` with host `kind: 'editor'`; reuse the same HTML that loads `dist/webview/tasks.js`.
- `TaskDetailProvider.openTask()` currently hardcodes `const column = vscode.ViewColumn.One`. Thread an optional view-column / `beside` hint so the editor-tab board can request the detail open beside it, while the sidebar path keeps current behavior.
- Wire the panel into the existing `extension.ts` fan-out so it stays synced when open: the debounced file-watcher refresh and `switchActiveBacklog()` must also refresh the panel; `setParser`/`setWorkspaceRoot`/`setDataSourceMode`, integration-state, and `TaskDetailProvider.onActiveTaskChanged` (active-task highlighting) must reach the panel too. Relevant spots: `src/extension.ts` ~142–199 (switchActiveBacklog) and ~684–696 (file watcher).
- Add a discoverable affordance: a `backlog.openTasksInEditor` command (registered in `package.json` `contributes.commands`) at minimum, plus ideally a `view/title` button on the `backlog.kanban` view (note: `package.json` currently has no `view/title` menus) or a button in the in-webview tab bar (`src/webview/components/tasks/Tasks.svelte` / `src/webview/components/shared/TabBar.svelte`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A command opens the Tasks board in an editor tab; re-invoking it reveals the existing tab instead of spawning duplicates.
- [ ] #2 The editor-tab board supports the same views and interactions as the sidebar: kanban/list/drafts/archived/dashboard/docs/decisions, drag-and-drop, status change, reorder, column collapse, and milestone grouping.
- [ ] #3 Editing a task (on disk, via either board, or via the detail editor) live-updates BOTH the sidebar board and the editor-tab board when both are open.
- [ ] #4 Each board independently remembers its own view mode, filters, and collapsed columns; changing one does not change the other.
- [ ] #5 Single-click in the editor-tab board opens/updates the task detail in an editor group beside the board with focus retained on the board; double-click opens beside and moves focus into the detail.
- [ ] #6 Sidebar board single-click behavior (Details preview pane) is unchanged.
- [ ] #7 There is a discoverable way to open the editor tab (command palette entry at minimum).
- [ ] #8 Tests cover the new panel/controller wiring and cross-view sync: unit coverage where possible, plus a CDP cross-view test for sidebar↔tab↔disk sync per the project testing strategy.
- [ ] #9 README/user-facing docs mention opening the board in an editor tab.
<!-- AC:END -->

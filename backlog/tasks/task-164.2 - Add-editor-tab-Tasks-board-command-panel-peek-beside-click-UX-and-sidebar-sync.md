---
id: TASK-164.2
title: >-
  Add editor-tab Tasks board: command, panel, peek-beside click UX, and sidebar
  sync
status: Done
assignee:
  - '@claude-opus'
created_date: '2026-06-18 16:29'
updated_date: '2026-06-18 17:18'
labels:
  - feature
  - ui
dependencies:
  - TASK-164.1
modified_files:
  - src/providers/TaskDetailProvider.ts
  - src/providers/TasksController.ts
  - src/providers/TasksPanelProvider.ts
  - src/providers/tasksWebviewHtml.ts
  - src/extension.ts
  - package.json
  - src/test/unit/TasksController.test.ts
  - src/test/unit/TasksPanelProvider.test.ts
  - src/test/cdp/lib/webview-helpers.ts
  - src/test/cdp/cross-view.test.ts
  - README.md
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
- [x] #1 A command opens the Tasks board in an editor tab; re-invoking it reveals the existing tab instead of spawning duplicates.
- [x] #2 The editor-tab board supports the same views and interactions as the sidebar: kanban/list/drafts/archived/dashboard/docs/decisions, drag-and-drop, status change, reorder, column collapse, and milestone grouping.
- [x] #3 Editing a task (on disk, via either board, or via the detail editor) live-updates BOTH the sidebar board and the editor-tab board when both are open.
- [x] #4 Each board independently remembers its own view mode, filters, and collapsed columns; changing one does not change the other.
- [x] #5 Single-click in the editor-tab board opens/updates the task detail in an editor group beside the board with focus retained on the board; double-click opens beside and moves focus into the detail.
- [x] #6 Sidebar board single-click behavior (Details preview pane) is unchanged.
- [x] #7 There is a discoverable way to open the editor tab (command palette entry at minimum).
- [x] #8 Tests cover the new panel/controller wiring and cross-view sync: unit coverage where possible, plus a CDP cross-view test for sidebar↔tab↔disk sync per the project testing strategy.
- [x] #9 README/user-facing docs mention opening the board in an editor tab.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Builds on TASK-164.1's TasksController. Findings: the webview already emits selectTask on single-click and openTask on double-click for BOTH kanban (shared TaskCard.svelte) and list (ListView.svelte), and Tasks.svelte posts {type:'refresh'} on mount. So no webview changes are needed — click semantics are interpreted extension-side by branching on host.kind, and the panel self-heals its first paint via the mount refresh.

Steps:
1. TaskDetailProvider.openTask(): add options `{ preserveFocus?, beside? }`. column = beside ? ViewColumn.Beside : ViewColumn.One (default One = unchanged sidebar behavior). When revealing an existing panel, reveal at `currentPanel.viewColumn ?? column` so a peek doesn't yank it around.
2. Widen the `backlog.openTaskDetail` command options to accept `beside`.
3. TasksController.handleMessage: branch on this.host.kind.
   - editor + selectTask → executeCommand('backlog.openTaskDetail', ref, { preserveFocus: true, beside: true }) (peek, focus stays on board). Do NOT call onSelectTask.
   - editor + openTask → executeCommand('backlog.openTaskDetail', ref, { beside: true }) (open + focus).
   - sidebar → unchanged.
4. New src/providers/TasksPanelProvider.ts: holds a singleton WebviewPanel + an editor-kind TasksController; remembers parser/workspaceRoot/dataSourceMode so they apply when (re)opened. reveal() creates/reveals; forwards setParser/setWorkspaceRoot/setDataSourceMode/setActiveEditedTaskId/checkAndSendIntegrationState/refresh (no-op when closed). onDidDispose clears the panel+controller. Reuses getTasksWebviewHtml.
5. extension.ts: instantiate TasksPanelProvider; register backlog.openTasksInEditor → reveal(); fan out to the panel in switchActiveBacklog, both debounced file-watch refreshers, TaskDetailProvider.onActiveTaskChanged, checkCrossBranchConfig (setDataSourceMode), and the taskIdDisplay config-change refresh.
6. package.json: add backlog.openTasksInEditor command (icon $(link-external)) + a view/title navigation button on backlog.kanban (first view/title menu entry).
7. Tests: extend TasksController.test.ts (editor-host select=peek-beside, open=focus-beside; sidebar select still calls onSelectTask) + new TasksPanelProvider unit test (mock createWebviewPanel) + a CDP cross-view test for sidebar↔tab↔disk sync (assess harness; may require the CDP env to run). Update README.

Per-host view state is satisfied at runtime: sidebar and panel controllers each hold their own viewMode/filters/collapsed in memory (globalState is shared as the initial default, last-writer-wins on restart) — runtime independence holds since neither broadcasts to the other.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the editor-tab board on top of TASK-164.1's controller.

- New `src/providers/TasksPanelProvider.ts`: singleton WebviewPanel hosting an editor-kind TasksController. Remembers parser/workspaceRoot/dataSourceMode so a later open starts from current state; reveal() creates-or-reveals (no duplicate tabs); onDidDispose clears panel+controller; fan-out forwarders (refresh/setParser/setWorkspaceRoot/setDataSourceMode/setActiveEditedTaskId/checkAndSendIntegrationState) no-op when closed.
- Click UX: `TasksController.handleMessage` now branches on `host.kind`. editor + selectTask → openTaskDetail { preserveFocus:true, beside:true } (peek, focus stays on board); editor + openTask → openTaskDetail { beside:true } (open + focus). Sidebar behavior unchanged.
- `TaskDetailProvider.openTask` gained `{ beside? }`: column = beside ? ViewColumn.Beside : ViewColumn.One; an existing panel reveals at `currentPanel.viewColumn ?? column` so peeks don't yank it around. `backlog.openTaskDetail` command widened to accept `beside`.
- `backlog.openTasksInEditor` command + a view/title navigation button on `backlog.kanban` (first view/title menu) + README entry.
- extension.ts fans refresh/parser/workspaceRoot/dataSource/integration/active-task out to the panel from switchActiveBacklog, both debounced file-watch refreshers, TaskDetailProvider.onActiveTaskChanged, checkCrossBranchConfig, and the taskIdDisplay config-change.
- Editor host webview carries an exclusive `tasks-editor-page` body marker (via getTasksWebviewHtml extraBodyClass) so the two identical boards are distinguishable.

Per-host view state: sidebar and panel are separate controller instances with their own in-memory viewMode/filters/collapsed; globalState is the shared initial default (last-writer-wins on restart). No broadcast between them, so changing one does not change the other at runtime.

Tests: extended TasksController.test.ts (editor peek-beside, editor open-beside-focus, sidebar select still drives preview, sidebar open without beside); new TasksPanelProvider.test.ts (singleton reveal, html marker, message routing, dispose, closed-panel no-ops, active-task forwarding); CDP webview-helpers gained a `tasksEditor` role with an exclude-class so `tasks` resolves to the sidebar only; two new CDP cross-view tests (editor tab opens + syncs with sidebar+disk; single-click peeks detail beside).

VERIFICATION GAP — read before merge: unit suite (919) + lint + typecheck + esbuild compile all pass locally. The two new CDP tests are written to the existing harness patterns but were NOT executed locally: this machine has no VS Code binary and `test:cdp` launches a real VS Code (Darwin, no xvfb), so CDP must be validated in CI / the dedicated CDP environment. AC#8 is checked on the basis that the test artifacts exist and unit coverage is green; the CDP portion is pending a real run.
<!-- SECTION:NOTES:END -->

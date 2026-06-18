---
id: TASK-164.1
title: Refactor the Tasks view into a host-agnostic TasksController
status: Done
assignee:
  - '@claude-opus'
created_date: '2026-06-18 16:29'
updated_date: '2026-06-18 17:04'
labels:
  - refactor
dependencies: []
modified_files:
  - src/providers/TasksController.ts
  - src/providers/TasksViewProvider.ts
  - src/providers/tasksWebviewHtml.ts
  - src/test/unit/TasksController.test.ts
parent_task_id: TASK-164
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extract all Tasks-board logic out of the sidebar webview provider into a host-agnostic controller, so the same logic can later drive either a sidebar `WebviewView` or an editor-area `WebviewPanel`. **This task is a pure refactor with NO user-facing behavior change** — the existing sidebar Tasks view must behave identically before and after. It unblocks the editor-tab feature (parent TASK-164).

Local context for the implementer:
- Today, `src/providers/TasksViewProvider.ts` (extends `src/providers/BaseViewProvider.ts`, a `WebviewViewProvider`) holds the board state and all logic: view state fields (viewMode, milestoneGrouping, dataSourceMode, collapsedColumns, collapsedMilestones, activeEditedTaskId, workspaceRoot) plus `refresh()`, `handleMessage()`, `setViewMode()`, `setFilter()`, `setLabelFilter()`, `setDataSourceMode()`, `setActiveEditedTaskId()`, `checkAndSendIntegrationState()`, `refreshDashboard/refreshDocuments/refreshDecisions`, `computeStatistics`, and the `onSelectTask` selection handler.
- Goal: move that into a host-agnostic `TasksController` that talks to its host through a small injected interface — at minimum `postMessage(msg)`, a way to resolve webview resource URIs (`asWebviewUri`), and a host `kind: 'sidebar' | 'editor'` discriminator (so the follow-up task can vary select/open policy per host without further refactoring). `TasksViewProvider` becomes a thin `WebviewViewProvider` adapter that owns a controller bound to the sidebar webview and forwards lifecycle/wiring calls from `extension.ts`.
- The webview bundle is unchanged (`src/webview/entries/tasks.ts` mounts `Tasks.svelte`); this is extension-host-side only.
- Keep the existing `extension.ts` integration points working: `switchActiveBacklog()`, the debounced file-watcher refresh, `setParser`/`setWorkspaceRoot`, `TaskDetailProvider.onActiveTaskChanged` → `setActiveEditedTaskId`, cross-branch `setDataSourceMode`, and the integration banner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A host-agnostic controller encapsulates all Tasks-board data loading and message handling, with no direct dependency on VS Code WebviewView vs WebviewPanel (it communicates only through an injected host interface).
- [x] #2 The controller exposes a host `kind` ('sidebar' | 'editor') so later work can vary select/open behavior per host.
- [x] #3 TasksViewProvider delegates to the controller, and the sidebar Tasks view behaves identically to before: kanban/list/drafts/archived/dashboard/docs/decisions, drag-and-drop, status changes, reorder, column collapse, milestone grouping, integration banner, active-task highlighting, and cross-branch mode all work as they did.
- [x] #4 All existing extension.ts wiring (backlog switch, debounced file-watch refresh, parser/workspace-root updates, active-task highlighting, cross-branch data source) continues to update the sidebar view through the controller.
- [x] #5 No change to the meaning of persisted globalState keys; no new user-facing behavior.
- [x] #6 Controller logic has direct unit-test coverage using a mock host, and all existing unit/integration tests pass unchanged (run bun run test && bun run lint && bun run typecheck).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Goal: extract all Tasks-board logic into a host-agnostic `TasksController`, with `TasksViewProvider` as a thin adapter. Zero user-facing behavior change. `src/test/unit/TasksViewProvider.test.ts` must stay green unchanged (it drives the provider's public API + onDidReceiveMessage path).

Steps:
1. Add `src/providers/TasksController.ts`:
   - `export interface TasksHost { readonly kind: 'sidebar' | 'editor'; postMessage(message: ExtensionMessage): void; isReady(): boolean; }`
   - `export class TasksController` holding all state (viewMode, milestoneGrouping, dataSourceMode, dataSourceReason, collapsedColumns, collapsedMilestones, activeEditedTaskId, workspaceRoot, onSelectTask, parser, writer, context) and all logic moved verbatim from TasksViewProvider: refresh(), handleMessage(), setViewMode(), setFilter(), setLabelFilter(), setDataSourceMode(), getDataSourceMode(), setActiveEditedTaskId(), setWorkspaceRoot(), setParser(), setTaskSelectionHandler(), checkAndSendIntegrationState(), refreshDashboard/Documents/Decisions(), computeStatistics(), getTasksViewSettings(). Replace `this.postMessage(...)` → `this.host.postMessage(...)` and `if (!this._view)` → `if (!this.host.isReady())`.
   - `loadPersistedState()` method that reads globalState (the block currently inside resolveWebviewView).
2. Add `src/providers/tasksWebviewHtml.ts`: `getTasksWebviewHtml(webview, extensionUri)` — the exact current getHtmlContent markup.
3. Rewrite `src/providers/TasksViewProvider.ts` as a standalone `vscode.WebviewViewProvider` (no longer extends BaseViewProvider): holds `_view`, `extensionUri`, and a `TasksController` whose host lazily reads `this._view` (kind 'sidebar'). Forward all public methods to the controller. resolveWebviewView: set _view + options + html (shared helper), wire onDidReceiveMessage → controller.handleMessage, controller.loadPersistedState(), controller.refresh().
4. Add `src/test/unit/TasksController.test.ts`: direct unit tests against the controller with a mock host (postMessage spy, isReady=true).
5. Run bun run test && bun run lint && bun run typecheck; confirm TasksViewProvider.test.ts passes unchanged.

Note: host kept minimal (no asWebviewUri) because HTML lives in the shared helper, not the controller — still satisfies AC#1 (controller's data/message logic talks only through the host). `kind` discriminator added now for TASK-164.2 to branch select/open policy; in this task both kinds behave identically.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extracted the host-agnostic core into `src/providers/TasksController.ts` (class `TasksController` + `TasksHost` interface `{ kind: 'sidebar' | 'editor'; postMessage(); isReady() }`, plus exported `TasksViewMode` and `TaskSelectionRef` types). All board state + logic moved verbatim from `TasksViewProvider`; `this.postMessage(...)` → `this.host.postMessage(...)` and `if (!this._view)` guards → `if (!this.host.isReady())`. Added `loadPersistedState()` (the globalState-reading block formerly inline in resolveWebviewView).

`src/providers/TasksViewProvider.ts` is now a thin `vscode.WebviewViewProvider` (no longer extends BaseViewProvider) that owns a `TasksController` whose sidebar host lazily reads `this._view`, and forwards its public methods. Webview HTML moved to shared `src/providers/tasksWebviewHtml.ts` (`getTasksWebviewHtml`) — identical markup for both hosts.

Design note: kept `TasksHost` minimal (no `asWebviewUri`) since HTML lives in the shared helper rather than the controller; AC#1 still holds (the controller's data/message logic talks only through the host). The `kind` discriminator is unused for now — both kinds behave identically; TASK-164.2 will branch select/open policy on it.

Verification: existing `src/test/unit/TasksViewProvider.test.ts` (60 tests) passes unchanged = sidebar behavior identical. Added `src/test/unit/TasksController.test.ts` (11 tests) driving the controller through a mock host (no VS Code webview). Full suite 909 passed; lint, typecheck, and esbuild compile all clean.
<!-- SECTION:NOTES:END -->

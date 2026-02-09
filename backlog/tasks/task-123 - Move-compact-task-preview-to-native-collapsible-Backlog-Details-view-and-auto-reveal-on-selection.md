---
id: TASK-123
title: >-
  Move compact task preview to native collapsible Backlog Details view and
  auto-reveal on selection
status: Done
assignee: []
created_date: '2026-02-09 15:28'
updated_date: '2026-02-09 15:33'
labels:
  - ui
  - webview
  - vscode-views
  - task-detail
  - testing
dependencies: []
references:
  - tmp/beads-vscode-screenshot.png
  - package.json
  - src/extension.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the inline compact details pane in Tasks webview with a dedicated VS Code webview view section (Details) under the Backlog container. Clicking a task card/row should select and push task preview data into that view and auto-reveal/expand it. Keep full detail/edit flow available from the preview.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backlog container contributes a dedicated webview view for task preview/details below Tasks.
- [x] #2 Clicking a task card/list row sends selection to extension and auto-reveals the Details view section.
- [x] #3 Details view renders selected task compact preview with status/priority quick edits and Open Full Details action.
- [x] #4 Tasks webview no longer renders embedded compact details pane.
- [x] #5 Read-only task guard behavior remains enforced for quick edits.
- [x] #6 Tests updated to cover selection message flow and no regression in task interaction behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add native Backlog Details webview view contribution and provider registration in extension activation.
2. Build a dedicated task-preview webview entry/provider using compact details UI and messaging.
3. Change Tasks webview click flow to emit selection messages to extension (instead of inline pane).
4. Auto-reveal/focus Details view on selection and keep full-detail handoff + quick edit actions.
5. Update Playwright/Unit tests and run required validation commands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reworked compact details from an embedded pane to a dedicated VS Code webview view (`backlog.taskPreview`) in the Backlog container. Added `TaskPreviewViewProvider` and `task-preview` webview entry/component that render compact task preview with status/priority quick edits and Open Full Details handoff. Tasks list/kanban click actions now emit `selectTask` messages to extension host; `TasksViewProvider` forwards selection to preview provider, which auto-reveals the Details view (`view.show(true)` / `backlog.taskPreview.focus`) and refreshes selected task data. Inline compact pane was removed from `Tasks.svelte`. Updated Playwright card/row click tests to verify `selectTask` message flow and kept keyboard Enter open-full behavior coverage. Added unit coverage for `selectTask` message forwarding in `TasksViewProvider`.
<!-- SECTION:NOTES:END -->

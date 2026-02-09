---
id: TASK-121
title: >-
  Add split-pane compact task details to Tasks view with quick edits and
  full-detail handoff
status: Done
assignee: []
created_date: '2026-02-09 15:03'
updated_date: '2026-02-09 15:09'
labels:
  - ui
  - webview
  - task-detail
  - testing
dependencies: []
references:
  - tmp/beads-vscode-screenshot.png
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a Beads-style compact details panel in the Backlog Tasks webview. The Tasks panel should show a lower compact details pane for the selected task, support quick edits for status and priority only, and provide a clear action to open the full Task Detail view for complete editing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tasks webview shows a compact details pane below main content when a task is selected.
- [x] #2 Compact details pane allows quick editing of status and priority only and persists updates to markdown via extension message handlers.
- [x] #3 Compact pane includes an explicit action to open the full task detail panel for the selected task.
- [x] #4 Read-only tasks (cross-branch/task source restrictions) display read-only messaging and block quick edits.
- [x] #5 Keyboard/focus behavior remains usable and existing tab/list/kanban interactions continue to work.
- [x] #6 Playwright tests cover selection sync, quick edit persistence, read-only blocking, and full-detail handoff from compact pane.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add compact details pane component and wire task selection state in Tasks.svelte.
2. Extend TasksViewProvider/webview message contracts for selection sync and quick status/priority updates.
3. Implement full-detail handoff action from compact pane.
4. Add read-only enforcement and user feedback for compact quick edits.
5. Add/adjust Playwright tests for compact pane behavior and run full validation commands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a new compact split-pane details experience in the Tasks webview. List/Kanban clicks now select tasks into the compact pane by default, while keyboard Enter and explicit CTA still open full Task Detail view. Added quick-edit controls for status/priority with optimistic local updates and read-only guards in both UI and provider handling. Extended TasksViewProvider to process updateTask messages with strict allowed fields (status/priority). Added Playwright coverage for compact selection, full-detail handoff, quick edits, and read-only behavior; all updated task-view tests pass.
<!-- SECTION:NOTES:END -->

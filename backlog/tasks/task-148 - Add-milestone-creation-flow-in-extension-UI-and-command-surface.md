---
id: TASK-148
title: Add milestone creation flow in extension UI and command surface
status: Done
assignee: []
created_date: '2026-02-22 22:09'
updated_date: '2026-02-22 22:14'
labels: []
dependencies: []
references:
  - src/extension.ts
  - src/core/BacklogWriter.ts
  - src/core/types.ts
  - src/providers/TasksViewProvider.ts
  - src/providers/TaskDetailProvider.ts
  - src/providers/TaskCreatePanel.ts
  - src/webview/components/Tasks.svelte
  - src/webview/components/task-detail/MetaSection.svelte
  - /workspace/tmp/mrlesk-Backlog.md-src/src/file-system/operations.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/web/components/MilestonesPage.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement milestone creation in vscode-backlog-md so users can create milestones without leaving the extension, while matching upstream Backlog.md behavior and keeping compatibility with existing milestone parsing/writing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Extension contributes and registers a milestone creation command callable from command palette.
- [x] #2 Tasks webview provides a clear create-milestone entry point when grouped by milestone and dispatches a typed webview message.
- [x] #3 Task detail view provides an inline create-milestone action that creates the milestone and applies it to the active task.
- [x] #4 Task create panel supports setting/creating a milestone during task creation flow.
- [x] #5 Milestone creation logic matches upstream semantics for id allocation and duplicate handling (including archived milestones scanning).
- [x] #6 Automated tests cover writer behavior and UI/provider message handling for milestone creation paths.
- [x] #7 Project checks pass: bun run test && bun run lint && bun run typecheck.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented milestone creation across command/UI surfaces with upstream-compatible writer semantics. Added `backlog.createMilestone` command, tasks-view create action in milestone-grouped Kanban, inline task-detail create-and-assign flow, and task-create-panel milestone create/set support. Added unit coverage for milestone writer ID allocation+duplicate handling and provider/panel message routing. Verified with `bun run test && bun run lint && bun run typecheck`.
<!-- SECTION:FINAL_SUMMARY:END -->

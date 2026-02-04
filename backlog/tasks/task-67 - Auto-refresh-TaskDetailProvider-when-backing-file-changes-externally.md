---
id: TASK-67
title: Auto-refresh TaskDetailProvider when backing file changes externally
status: Done
assignee: []
created_date: '2026-02-04 01:54'
updated_date: '2026-02-04 19:44'
labels:
  - enhancement
  - task-detail
dependencies: []
references:
  - /Users/ysamlan/sandbox/vscode-backlog.md/src/providers/TaskDetailProvider.ts
  - /Users/ysamlan/sandbox/vscode-backlog.md/src/extension.ts
  - /Users/ysamlan/sandbox/vscode-backlog.md/src/core/FileWatcher.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a task file is modified externally (by another tool, git pull, MCP server, etc.) while the TaskDetailProvider panel is open, the view should auto-refresh to show the latest content.

Currently, the FileWatcher refreshes Kanban and TaskList views but TaskDetailProvider is not subscribed. The view becomes stale until the user tries to save (triggering conflict detection) or manually closes/reopens.

**Implementation:**
1. Add `currentFilePath` static property to TaskDetailProvider
2. Add `onFileChanged(uri)` static method that checks if the changed file matches and reloads
3. Subscribe to FileWatcher in extension.ts to call `TaskDetailProvider.onFileChanged(uri)`
4. Handle file deletion gracefully (show warning, close panel)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TaskDetailProvider auto-refreshes when backing file is modified externally
- [ ] #2 File changes to unrelated files do not trigger refresh
- [ ] #3 Deleted files show warning notification and close the panel
- [ ] #4 File hash is updated after refresh (no false conflicts on subsequent saves)
<!-- AC:END -->

---
id: TASK-64
title: Prevent overwriting externally modified task files
status: To Do
assignee: []
created_date: '2026-02-03 21:27'
labels:
  - enhancement
  - data-safety
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When saving changes from the task detail webview, detect if the task file has been modified on disk (or moved/deleted) since it was loaded or last saved. If a conflict is detected, show a useful error and let the user choose to:
1. Overwrite the file with their changes anyway
2. Reload the changes from disk (discarding their edits)
3. View a diff in a separate editor window to compare changes

This prevents accidental data loss when files are edited externally or by other tools while the webview is open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Detect when a task file has changed on disk since it was loaded
- [ ] #2 Show a conflict dialog with clear options when saving to a modified file
- [ ] #3 Allow user to force overwrite their changes
- [ ] #4 Allow user to reload from disk (discarding edits)
- [ ] #5 Allow user to view a diff between their version and the disk version
- [ ] #6 Handle the case where the file was deleted or moved
<!-- AC:END -->

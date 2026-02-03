---
id: TASK-64
title: Prevent overwriting externally modified task files
status: Done
assignee: []
created_date: '2026-02-03 21:27'
updated_date: '2026-02-03 21:46'
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
- [x] #1 Detect when a task file has changed on disk since it was loaded
- [x] #2 Show a conflict dialog with clear options when saving to a modified file
- [x] #3 Allow user to force overwrite their changes
- [x] #4 Allow user to reload from disk (discarding edits)
- [x] #5 Allow user to view a diff between their version and the disk version
- [x] #6 Handle the case where the file was deleted or moved
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Implemented conflict detection when saving task changes from the webview. If the file has been modified externally since it was loaded, a dialog is shown with options to:
- **Reload from Disk** - Refreshes the view with current file content (discards pending changes)
- **Overwrite Anyway** - Force writes the changes, ignoring external modifications
- **View Diff** - Opens the file in VS Code's editor to see current state

### Implementation Details

**BacklogWriter.ts changes:**
- Added `computeContentHash()` function using MD5 to generate content hashes
- Added `FileConflictError` class with `code: 'CONFLICT'` and `currentContent` properties
- Modified `updateTask()` to accept optional `expectedHash` parameter for conflict detection

**TaskDetailProvider.ts changes:**
- Added `currentFileHash` static property to track file state when opening a task
- Captures file hash in `openTask()` when loading a task
- Checks if file exists before save attempts (handles deleted/moved files)
- Passes `expectedHash` to `updateTask()` for conflict detection
- Added `handleConflict()` method to show conflict resolution dialog with three options
- Updates stored hash after successful writes

### Tests Added
- `computeContentHash()` tests: consistency, different hashes for different content, MD5 format, empty/unicode content
- `updateTask with expectedHash` tests: success when hash matches, throws FileConflictError on mismatch, includes current content in error, skips check when no hash provided, detects whitespace-only changes
<!-- SECTION:FINAL_SUMMARY:END -->

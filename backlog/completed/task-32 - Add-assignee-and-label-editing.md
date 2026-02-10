---
id: TASK-32
title: Add assignee and label editing
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-03 21:29'
labels:
  - 'epic:task-crud'
  - 'phase:7'
milestone: MVP Release
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Edit assignees and labels with autocomplete from existing values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add/remove assignees
- [x] #2 Add/remove labels
- [x] #3 Autocomplete from existing assignees/labels
- [x] #4 Save changes to file
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

Added assignee and label editing with autocomplete suggestions in the task detail webview.

### Changes Made

**BacklogParser.ts:**
- Added `getUniqueLabels()` - returns merged labels from config and all tasks, sorted alphabetically
- Added `getUniqueAssignees()` - returns unique assignees from all tasks, sorted alphabetically

**TaskDetailProvider.ts:**
- Made assignees editable with add/remove functionality (matching existing label editing behavior)
- Added HTML5 datalists for autocomplete suggestions on both labels and assignees
- Added CSS styles for assignee input and container
- Added JavaScript handlers for assignee add/remove operations
- Wired up existing label input to the datalist for autocomplete

**BacklogParser.test.ts:**
- Added `readdirSync` to the fs mock
- Added tests for `getUniqueLabels()` - merging config and task labels
- Added tests for `getUniqueAssignees()` - collecting unique assignees

### How It Works

1. When opening a task, the provider fetches all unique labels and assignees
2. These are rendered as HTML5 `<datalist>` elements for native browser autocomplete
3. Users type in the input field and see suggestions from existing values
4. Adding a new label/assignee sends an `updateField` message to the backend
5. The `BacklogWriter.updateTask()` method persists changes to the file
<!-- SECTION:FINAL_SUMMARY:END -->

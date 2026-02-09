---
id: TASK-129
title: Fix sidebar preview relationship links for blocks and parent
status: Done
assignee: []
created_date: '2026-02-09 21:19'
updated_date: '2026-02-09 21:21'
labels:
  - navigation
  - task-preview
  - ui
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure the sidebar task preview panel (compact details view) shows and navigates relationship links for Blocks and Subtask of/parent task, matching navigation clarity in detail view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sidebar preview shows a clickable `Subtask of` link when selected task has parent_task_id.
- [x] #2 Sidebar preview shows clickable `Blocks` links when other tasks depend on the selected task.
- [x] #3 Clicking those links navigates in-place within the sidebar preview (not full edit view).
- [x] #4 Unit tests verify task preview payload includes reverse dependency links used by sidebar `Blocks` row.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated TaskPreviewViewProvider to resolve selected task from shared context, compute reverse dependencies (`blocksTaskIds`), and send enriched preview payload. Added compact preview `Subtask of` row using in-place related-task navigation handler. Added unit coverage for reverse dependency payload in TaskPreviewViewProvider tests. Extended shared Task type with optional `blocksTaskIds` for provider/webview type-safety.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sidebar task preview now supports two-way relationship navigation links consistently: `Subtask of`, `Blocked by`, and `Blocks` all navigate in-place within the preview panel. Reverse dependency data is computed in preview provider context and covered by unit tests.
<!-- SECTION:FINAL_SUMMARY:END -->

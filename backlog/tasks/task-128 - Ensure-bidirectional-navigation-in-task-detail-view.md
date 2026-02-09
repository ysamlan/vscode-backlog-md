---
id: TASK-128
title: Ensure bidirectional navigation in task detail view
status: Done
assignee: []
created_date: '2026-02-09 21:09'
updated_date: '2026-02-09 21:12'
labels:
  - navigation
  - task-detail
  - cross-branch
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make task detail navigation reliably two-way so opening a subtask exposes parent navigation and opening blocked-by links exposes reciprocal blocks links in the same detail panel context, including cross-branch task contexts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a subtask from task detail shows a clickable parent task link when parent exists in the same task context.
- [x] #2 Opening a blocked-by task from task detail shows reciprocal blocks links back to the originating task when applicable.
- [x] #3 Bidirectional relationship resolution works for cross-branch read-only tasks as well as local tasks.
- [x] #4 Unit tests cover parent and blocks resolution in both local and cross-branch detail contexts.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactored TaskDetailProvider.sendTaskData to derive relationship metadata from a single context task collection: local tasks for local detail views, cross-branch task set for read-only cross-branch views. Parent task resolution now prefers same source/branch context and falls back to parser.getTask for legacy local behavior. Reverse dependency links (blocksTaskIds) are now computed from the same context collection, enabling reciprocal blocked-by/blocks navigation in read-only cross-branch detail flows.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task detail now supports reliable two-way navigation: subtask->parent links and blocked-by->blocks reciprocity resolve within the same context (including cross-branch read-only tasks). Added unit tests proving cross-branch parent resolution and reciprocal blocksTaskIds generation, while preserving existing local parent fallback behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

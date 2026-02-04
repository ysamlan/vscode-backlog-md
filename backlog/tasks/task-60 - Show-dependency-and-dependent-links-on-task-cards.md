---
id: TASK-60
title: Show dependency and dependent links on task cards
status: Done
assignee: []
created_date: '2026-02-03 16:28'
updated_date: '2026-02-04 19:50'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task cards in the Kanban and Task List views should display clickable links to both:

1. **Dependencies** - tasks this task depends on (already tracked in frontmatter `dependencies` field)
2. **Dependents** - tasks that depend on this task (computed by scanning other tasks' dependencies)

This helps users understand the task graph and navigate between related tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task cards show dependency links (tasks this depends on)
- [x] #2 Task cards show dependent links (tasks depending on this)
- [x] #3 Links are clickable and navigate to the linked task
- [x] #4 Works in both Kanban and Task List views
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Implemented dependency and dependent links on task cards in both Kanban and List views.

### Changes Made

**src/providers/TasksViewProvider.ts:**
- Added arrow icon SVGs for dependency indicators (arrowLeftIcon, arrowRightIcon)
- Updated `renderTaskCard()` to show dependency links (arrow-left + task IDs for "blocked by") and blocks links (arrow-right + task IDs for "blocks")
- Updated `renderTaskRow()` to show compact count indicators with arrows and counts
- Modified click handler to detect clicks on `.dep-link` elements and navigate to the linked task
- Updated `refresh()` to compute `blocksTaskIds` for each task using `parser.getBlockedByThisTask()`

**src/webview/styles.css:**
- Added `.task-card-deps` container with border separator
- Added `.task-deps` for inline display with icons
- Added `.dep-link` styling with hover underline
- Added `.dep-overflow` for "+N" overflow indicator
- Added `.deps-indicator` for compact list view display

### Features
- Shows up to 2 dependency/block links with "+N" overflow for more
- Clickable links navigate to the dependent/blocked task
- Arrow-left indicates dependencies (tasks this task depends on)
- Arrow-right indicates blocks (tasks that depend on this task)
- List view shows compact count indicators with tooltip
<!-- SECTION:FINAL_SUMMARY:END -->

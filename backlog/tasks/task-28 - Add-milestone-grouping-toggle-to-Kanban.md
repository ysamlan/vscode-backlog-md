---
id: TASK-28
title: Add milestone grouping toggle to Kanban
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-04 20:55'
labels:
  - 'epic:kanban-board'
  - 'phase:6'
milestone: MVP Release
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Option to group tasks by milestone in the Kanban view, matching the main Backlog.md UI.

When "Milestone" view is selected:
- Tasks are grouped under collapsible milestone headers
- Each milestone shows task count and progress bar (% done)
- Kanban columns (To Do, In Progress, Done) appear within each milestone section
- Tasks without a milestone go into an "Uncategorized" section
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Toggle button to switch between 'All Tasks' and 'Milestone' views
- [x] #2 Collapsible milestone sections with task count badge
- [x] #3 Progress bar showing % of tasks completed per milestone
- [x] #4 Kanban columns within each milestone section
- [x] #5 Uncategorized section for tasks without milestone
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added milestone grouping toggle to Kanban view:

**Changes:**
- `src/providers/TasksViewProvider.ts`:
  - Added `milestoneGrouping` and `collapsedMilestones` state variables
  - Added toolbar with "All Tasks" / "By Milestone" toggle buttons
  - Implemented `renderKanbanByMilestone()` function with collapsible milestone sections
  - Added message handlers for `toggleMilestoneGrouping` and `toggleMilestoneCollapse`
  - State persisted to `globalState`
- `src/webview/styles.css`:
  - Added `.kanban-toolbar` and `.grouping-btn` styles
  - Added `.milestone-section`, `.milestone-header`, `.milestone-content` styles
  - Added `.progress-bar`, `.progress-fill`, `.progress-text` for progress visualization
  - Added `.column-header-mini` for nested kanban headers
- `src/core/types.ts`: Added new message types

**Features:**
- Toggle between flat and milestone-grouped Kanban views
- Collapsible milestone sections with task count badge
- Progress bar showing % of done tasks per milestone
- Nested Kanban columns within each milestone section
- "Uncategorized" section for tasks without milestone
- Milestones sorted by config order first, then alphabetically
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-34
title: Show task counts by status on dashboard
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-05 19:35'
labels:
  - 'epic:dashboard'
  - 'phase:8'
milestone: MVP Release
dependencies:
  - TASK-33
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Display task counts for each status (To Do, In Progress, Done) prominently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Count for each status
- [x] #2 Visual cards or badges
- [x] #3 Click to filter task list by status
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Already implemented during Svelte 5 migration. StatsGrid.svelte shows clickable status count cards (To Do, In Progress, Done) with filterByStatus command. StatusBreakdown.svelte shows bar chart. Full unit and Playwright e2e test coverage exists.
<!-- SECTION:FINAL_SUMMARY:END -->

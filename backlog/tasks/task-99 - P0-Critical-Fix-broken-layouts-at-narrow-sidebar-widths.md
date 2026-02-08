---
id: TASK-99
title: 'P0 Critical: Fix broken layouts at narrow sidebar widths'
status: Done
assignee: []
created_date: '2026-02-08 02:29'
updated_date: '2026-02-08 03:49'
labels:
  - ui
  - design
dependencies:
  - TASK-88
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Critical usability fixes for views that are broken at narrow sidebar widths (300-500px). Identified in TASK-88 UX review.\n\nP0-1 and P0-2 completed. P0-3 (list view) still outstanding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 P0-1: Kanban columns don't force horizontal scroll — remove min-width: 200px / max-width: 300px, use flex: 1 1 0% with min-width: 0 (styles.css:271-274)
- [x] #2 P0-2: Tab bar doesn't overflow at 300px — implemented overflow menu with 3 primary tabs + More dropdown (TabBar.svelte)
- [x] #3 P0-3: List view columns don't clip at 300px — hide Actions column and move buttons to context menu, use color-only dots for priority at narrow widths (styles.css:626+)
<!-- AC:END -->

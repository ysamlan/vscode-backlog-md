---
id: TASK-101
title: 'P2 Medium: Polish and consistency improvements'
status: To Do
assignee: []
created_date: '2026-02-08 02:29'
updated_date: '2026-02-08 02:34'
labels:
  - ui
  - design
dependencies:
  - TASK-88
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Medium-priority polish and consistency fixes identified in TASK-88 UX review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 P2-1: Dashboard stat card values reduced from 28px to ~22px or use clamp() for sidebar context (styles.css:1427-1432)
- [ ] #2 P2-2: Minimum font size of 11px for all readable text — increase 9px draft-badge and dep-overflow to 10-11px (styles.css:572, 806, 331, 415, 541, 560, 581)
- [ ] #3 P2-3: Milestone grouped kanban usable at narrow widths — consider summary row or vertical collapse for nested columns (styles.css:253-268)
- [ ] #4 P2-4: No Backlog Found empty state icon centered properly with flex column + align-items center (styles.css:766-783)
- [ ] #5 P2-5: Consistent badge styling across all views — unified base badge class with semantic color variants and consistent sizing
<!-- AC:END -->

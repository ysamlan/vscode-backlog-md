---
id: TASK-100
title: 'P1 High: Fix significant visual quality issues'
status: To Do
assignee: []
created_date: '2026-02-08 02:29'
updated_date: '2026-02-08 02:34'
labels:
  - ui
  - design
dependencies:
  - TASK-88
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
High-priority visual quality fixes identified in TASK-88 UX review. These don't break functionality but significantly impact visual quality.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 P1-1: Task detail title uses 18px font with auto-resizing textarea so long titles wrap instead of truncating (styles.css:1023-1034)
- [x] #2 P1-2: Task detail padding reduced from 20px to 12px for narrow sidebar context (styles.css:906, 769)
- [ ] #3 P1-3: Collapsed kanban column has overflow: hidden to prevent text bleeding from adjacent cards (styles.css:285-289)
- [ ] #4 P1-4: Content detail view has proper HTML/markdown styling for headings, code blocks, tables, lists (ContentDetail.svelte, content-detail.html fixture)
- [ ] #5 P1-5: Content detail tags render with proper spacing and badge styling instead of concatenated plain text (ContentDetail.svelte)
<!-- AC:END -->

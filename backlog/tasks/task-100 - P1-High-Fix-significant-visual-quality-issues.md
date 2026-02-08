---
id: TASK-100
title: 'P1 High: Fix significant visual quality issues'
status: Done
assignee: []
created_date: '2026-02-08 02:29'
updated_date: '2026-02-08 13:19'
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
- [x] #3 P1-3: Collapsed kanban column has overflow: hidden to prevent text bleeding from adjacent cards (styles.css:285-289)
- [x] #4 P1-4: Content detail view has proper HTML/markdown styling for headings, code blocks, tables, lists (ContentDetail.svelte, content-detail.html fixture)
- [x] #5 P1-5: Content detail tags render with proper spacing and badge styling instead of concatenated plain text (ContentDetail.svelte)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed remaining P1 visual quality issues:\n\n- **P1-3**: Added `overflow: hidden` to `.kanban-column.collapsed` in `styles.css` to prevent text bleeding from collapsed columns\n- **P1-4**: Added table, blockquote, horizontal rule, code, pre, and link styles to both `.detail-body` and `.section-content` scoped selectors in `ContentDetail.svelte` for proper markdown rendering\n- **P1-5**: Already correctly implemented — tags render as individual `.tag-badge` spans with proper spacing (no changes needed)\n\nAdded Playwright test verifying table rendering with border styling in the document body view.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-106
title: Replace priority text badges with chevron icons in kanban/list views
status: Done
assignee: []
created_date: '2026-02-08 13:58'
updated_date: '2026-02-08 17:30'
labels:
  - ui
  - design
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the "HIGH", "MEDIUM", "LOW" text badges on kanban cards and list view rows with compact chevron icons similar to Jira's priority indicators. This saves horizontal space on narrow cards and improves visual density.

- **Kanban cards and list view rows**: Show only the chevron icon (no text). Add a title attribute for hover tooltip showing full priority text.
- **Task detail view**: Show chevron icon + full text label side by side.
- Use Lucide icons (inline SVG) for the chevrons — e.g. chevrons-up for high, chevron-up for medium, chevron-down for low.
- Keep the existing priority colors (red for high, yellow/amber for medium, green for low).
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced priority text badges (HIGH/MEDIUM/LOW) with compact Lucide chevron icons across kanban cards, list view rows, and task detail header. Created shared PriorityIcon.svelte component, simplified CSS from badge styles to color-only classes, and added 7 Playwright e2e tests covering all three views.
<!-- SECTION:FINAL_SUMMARY:END -->

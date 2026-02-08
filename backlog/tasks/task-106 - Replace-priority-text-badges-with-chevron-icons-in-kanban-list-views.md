---
id: TASK-106
title: Replace priority text badges with chevron icons in kanban/list views
status: To Do
assignee: []
created_date: '2026-02-08 13:58'
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

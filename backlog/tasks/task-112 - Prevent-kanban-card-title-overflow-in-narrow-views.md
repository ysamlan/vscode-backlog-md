---
id: TASK-112
title: Prevent kanban card title overflow in narrow views
status: To Do
assignee: []
created_date: '2026-02-08 22:01'
updated_date: '2026-02-08 22:02'
labels:
  - web-ui
  - enhancement
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In narrow webview widths, long task titles (including long unbroken words) can overflow and clip in kanban columns. Improve card title rendering so text remains contained within the card and card heights stay predictable, while still allowing full task details to be viewed by opening the task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kanban card title text never overflows horizontally outside the card boundary at narrow sidebar-like widths.
- [ ] #2 Long unbroken words/segments are wrapped or broken so they remain contained in the card.
- [ ] #3 Card title display is line-clamped to a maximum of 3 lines with ellipsis/truncation behavior.
- [ ] #4 Three-line clamping prevents unusually tall cards while preserving click-through to task details for full content.
- [ ] #5 A Playwright webview test covers narrow viewport behavior for long titles and verifies no horizontal overflow plus 3-line clamped title rendering.
<!-- AC:END -->

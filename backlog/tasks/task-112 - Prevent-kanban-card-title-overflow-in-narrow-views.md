---
id: TASK-112
title: Prevent kanban card title overflow in narrow views
status: Done
assignee: []
created_date: '2026-02-08 22:01'
updated_date: '2026-02-09 02:37'
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
- [x] #1 Kanban card title text never overflows horizontally outside the card boundary at narrow sidebar-like widths.
- [x] #2 Long unbroken words/segments are wrapped or broken so they remain contained in the card.
- [x] #3 Card title display is line-clamped to a maximum of 3 lines with ellipsis/truncation behavior.
- [x] #4 Three-line clamping prevents unusually tall cards while preserving click-through to task details for full content.
- [x] #5 A Playwright webview test covers narrow viewport behavior for long titles and verifies no horizontal overflow plus 3-line clamped title rendering.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Playwright coverage in kanban view for narrow width behavior with a long mixed title (including an unbroken segment). The test verifies horizontal containment and 3-line clamping on `.task-card-title`. Updated kanban card title styling to wrap long words and clamp to 3 lines using `overflow-wrap: anywhere`, `word-break: break-word`, and `-webkit-line-clamp: 3` with hidden overflow. Rebuilt webview bundles and ran required validation: bun run test && bun run lint && bun run typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->

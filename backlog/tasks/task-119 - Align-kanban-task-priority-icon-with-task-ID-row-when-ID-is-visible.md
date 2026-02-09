---
id: TASK-119
title: Align kanban task priority icon with task ID row when ID is visible
status: Done
assignee: []
created_date: '2026-02-09 02:59'
updated_date: '2026-02-09 03:00'
labels: []
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In kanban task cards, when task ID display is enabled (full or number), render the priority icon on the same top metadata row as the displayed task ID (e.g. TASK-123). Preserve current metadata layout behavior when task ID display is hidden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In kanban task cards with taskIdDisplay set to full or number, priority icon renders on the same row as the displayed task ID.
- [x] #2 When taskIdDisplay is hidden, priority icon remains visible in the card metadata area as before.
- [x] #3 Card layout remains readable for tasks with labels and without priority.
- [x] #4 Tests cover the visible-ID and hidden-ID behaviors.
<!-- AC:END -->

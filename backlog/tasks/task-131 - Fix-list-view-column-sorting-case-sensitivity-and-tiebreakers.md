---
id: TASK-131
title: Fix list view column sorting case sensitivity and tiebreakers
status: To Do
assignee: []
created_date: '2026-02-09 22:19'
labels:
  - bug
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sorting by clicking column headers (title, priority) in the list view doesn't produce correct results due to two root causes:

1. **Title sort uses `<`/`>` operators** (ListView.svelte ~line 171-172) which are case-sensitive — uppercase sorts before lowercase, so "Setup" comes before "add".
2. **No tiebreaker on non-status sorts** — when two tasks have equal priority, order is arbitrary. The status sort already has an ordinal tiebreaker (line 175-178 in ListView.svelte) but title and priority sorts don't.

Fix: use `localeCompare` with `{ sensitivity: 'base' }` for string fields; add title then ID as secondary/tertiary sort keys.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Title sort uses `localeCompare` with `{ sensitivity: 'base' }` for case-insensitive ordering
- [ ] #2 Priority sort falls through to title (localeCompare) then ID as secondary/tertiary sort keys
- [ ] #3 Title sort falls through to ID as secondary sort key
- [ ] #4 Existing status sort with ordinal tiebreaker is unchanged
- [ ] #5 Unit or Playwright tests cover case-insensitive title sorting
<!-- AC:END -->

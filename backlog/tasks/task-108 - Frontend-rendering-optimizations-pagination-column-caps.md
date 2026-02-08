---
id: TASK-108
title: 'Frontend rendering optimizations (pagination, column caps)'
status: To Do
assignee: []
created_date: '2026-02-08 19:41'
updated_date: '2026-02-08 20:01'
labels:
  - performance
  - frontend
dependencies:
  - TASK-39
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Frontend rendering optimizations for large backlogs — but only if benchmarks justify the complexity.

## Context

Our UI runs in a VS Code sidebar panel (300-400px wide). Realistic active task counts for file-based backlogs are 20-80 tasks (completed/archived tasks live in separate folders). Kanban splits load across columns, so even 100 active tasks means ~25 per column.

Rough DOM cost estimates:
- 50 tasks (~750 nodes): <50ms render, smooth scroll — no issue
- 100 tasks (~1500 nodes): ~80ms render, smooth — no issue
- 200 tasks (~3000 nodes): ~150ms render, smooth — marginal
- 500 tasks (~7500 nodes): ~400ms render, minor jank — noticeable benefit
- 1000 tasks (~15000 nodes): ~1s+ render, janky — significant benefit

True virtualization has real downsides in our context:
- Breaks Ctrl+F browser search (hidden elements can't be found)
- Complicates drag-and-drop across virtualized containers (kanban DnD rework)
- Accessibility issues (screen readers can't see non-rendered items)
- Svelte 5 reactivity + virtual scroll libraries have integration friction
- Harder to test with Playwright (can't interact with unrendered elements)

## Approach

**Step 1 (required): Benchmark first.** Before implementing anything, measure actual render times and scroll performance with synthetic datasets of 50, 100, 200, and 500 tasks. Use `performance.now()` around the Svelte mount and a Playwright test that injects large task sets and measures frame times. Document the results. If 200 tasks renders in <200ms with smooth scrolling, the optimization isn't needed.

**Step 2 (if benchmarks warrant): Simple pagination, not virtualization.**
1. **Kanban column card caps** — Show first 50 cards per column with a "Show more" button to load 50 more. No library needed, preserves DnD and search.
2. **List view pagination** — Same approach: show first 100 rows with "Show more". Simpler than virtual scrolling, no library dependency.

**Step 3 (only if Step 2 is insufficient):** Consider virtual scrolling with `@tanstack/virtual` or similar, but only for list view (not kanban, where DnD interaction is critical).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Benchmark render performance with 50, 100, 200, 500 synthetic tasks — document results
- [ ] #2 If benchmarks show issues: kanban columns cap visible cards at 50 with Show More button
- [ ] #3 If benchmarks show issues: list view caps visible rows at 100 with Show More button
- [ ] #4 No regressions to drag-and-drop, Ctrl+F search, or accessibility
<!-- AC:END -->

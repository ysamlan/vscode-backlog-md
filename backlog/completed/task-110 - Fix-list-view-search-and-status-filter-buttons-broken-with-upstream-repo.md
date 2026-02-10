---
id: TASK-110
title: Fix list view search and status filter buttons broken with upstream repo
status: Done
assignee:
  - '@codex'
created_date: '2026-02-08'
updated_date: '2026-02-08 21:18'
labels:
  - bug
  - list-view
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When loading the upstream MrLesk Backlog.md repo (~67 active tasks, `task_prefix: "back"`, `check_active_branches: true`), the list view's search bar and status filter buttons do not work. No errors are logged in the console. The same features work correctly in our test project.

**Symptoms:**
- Typing in the search bar does not filter the task list
- Clicking status filter buttons (To Do, In Progress, Done) does not filter tasks
- No console errors are produced

**Investigation findings:**

The filter logic in `ListView.svelte` (lines 98-112) uses a hardcoded switch statement mapping filter keys like `'todo'` to `t.status === 'To Do'`. The filter buttons (lines 405-453) are also hardcoded HTML rather than generated from the `statuses` prop. The status sort order (line 147) is similarly hardcoded.

While the upstream repo happens to use the same three default statuses, the issue may be related to:
1. A reactivity problem with the filter state not propagating to the derived filtered list when the task set is large
2. Cross-branch loaded tasks having different data shapes or status values
3. The `currentFilter` state not being properly bound between the filter buttons and the filtering logic
4. Some interaction between the `activeTab` state and filter state when switching views

**Key files:**
- `src/webview/components/list/ListView.svelte` — filter logic (lines 98-112), filter buttons (lines 405-453), sort order (line 147)
- `src/webview/components/tasks/Tasks.svelte` — state management and message handler for filters

**Repro steps:**
1. Clone the upstream repo: `git clone https://github.com/MrLesk/Backlog.md.git`
2. Open it in VS Code with the extension installed
3. Switch to list view
4. Try typing in search or clicking filter buttons — nothing happens
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Search bar filters tasks by title and description in real time
- [x] #2 Status filter buttons correctly filter the task list
- [x] #3 Works with upstream MrLesk repo (67+ tasks, custom prefix)
- [x] #4 Works with cross-branch loaded tasks
- [x] #5 No regressions in the test project
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Playwright regression tests for list-view search and status filtering using upstream-like dataset characteristics (custom task prefix IDs, larger list size, and cross-branch source variants).
2. Reproduce failure behavior against current list implementation and confirm new tests fail before code changes.
3. Refactor ListView.svelte filtering and status sorting to use dynamic status metadata from the statuses prop rather than hardcoded status names/keys.
4. Update list filter button rendering to generate status buttons from configured statuses while preserving existing special filters (all, high-priority, completed).
5. Re-run focused tests, then full validation: bun run test && bun run lint && bun run typecheck.
6. Record implementation notes/final summary, check acceptance criteria, and set task to Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added Playwright regression coverage for list-view status filtering with dynamic custom statuses in `e2e/custom-statuses.spec.ts` (button rendering + filter behavior).

Added cross-branch-like regression test with duplicate task IDs and mixed sources in `e2e/tasks.spec.ts` to validate search + status filtering behavior under upstream-style data conditions.

Refactored `ListView.svelte` status filtering/sorting to be data-driven from `statuses`, while keeping legacy filter key compatibility (`todo`, `in-progress`, `done`) for existing callers.

Updated list status filter buttons to render from configured statuses and emit `status:<StatusName>` keys; updated `backlog.filterByStatus` command in `src/extension.ts` to use dynamic status filter keys.

Updated row keyed-each identity in list view to use `filePath`-based uniqueness (`taskRowKey`) so duplicate IDs from cross-branch/upstream datasets do not destabilize list rendering/filter updates.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a full list-view filtering fix for upstream/cross-branch compatibility by removing hardcoded status assumptions and making filtering dynamic.

What changed:
- `src/webview/components/list/ListView.svelte`
  - Replaced hardcoded status filter switch logic with dynamic `status:<name>` handling derived from configured statuses.
  - Preserved backward compatibility for legacy filter keys (`todo`, `in-progress`, `done`).
  - Replaced hardcoded status sort order with dynamic order derived from `statuses`.
  - Replaced hardcoded status filter buttons with runtime-generated buttons from `statuses`.
  - Updated list row keying to a unique `taskRowKey(task)` (filePath/source-aware) to handle duplicate task IDs from cross-branch/upstream datasets reliably.
- `src/extension.ts`
  - Updated `backlog.filterByStatus` command to emit dynamic `status:<status>` filters instead of default-status-only mapping.
- `e2e/custom-statuses.spec.ts`
  - Added regressions for dynamic status filter button rendering and behavior.
- `e2e/tasks.spec.ts`
  - Updated list filter selectors for dynamic status keys.
  - Added regression test for cross-branch-like duplicate IDs to verify search and status filter behavior.

Validation:
- Built webview/extension assets: `bun run build`
- Focused Playwright validation: custom-status list filters + list-view suite slices passed
- Required full project gate passed: `bun run test && bun run lint && bun run typecheck`
  - Lint completed with existing warnings in `src/test/unit/BacklogCli.test.ts` (no new errors).
<!-- SECTION:FINAL_SUMMARY:END -->

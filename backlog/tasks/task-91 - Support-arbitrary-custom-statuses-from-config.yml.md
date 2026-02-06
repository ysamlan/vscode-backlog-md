---
id: TASK-91
title: Support arbitrary custom statuses from config.yml
status: To Do
assignee: []
created_date: '2026-02-06 03:18'
labels:
  - upstream-compat
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md'
  - src/core/BacklogParser.ts
  - src/core/types.ts
  - src/webview/styles.css
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

Upstream Backlog.md supports fully configurable statuses via `backlog/config.yml`. The defaults are `[To Do, In Progress, Done]` but users can add any status (e.g., "Backlog", "Review", "QA", "Blocked"). Our extension hardcodes `TaskStatus = 'Draft' | 'To Do' | 'In Progress' | 'Done'` and `parseStatus()` silently maps any unrecognized value to "To Do", losing data.

## Upstream behavior

- `config.yml` has a `statuses` array that defines board columns
- `DEFAULT_STATUSES = ["To Do", "In Progress", "Done"]`
- Tasks can have any status string that's in the configured list
- The TUI/web UI renders one column per configured status

## What needs to change

### Parser (`BacklogParser.ts`)
- `parseStatus()` currently force-maps to known values — should preserve the raw string
- `TaskStatus` type should become `string` (or the union should be removed)
- `getStatuses()` already reads from config, which is good

### Types (`types.ts`)
- Change `TaskStatus` from a union to `string` (or alias it)
- Update all references that depend on the union (status comparisons, CSS class generation)

### Kanban (`KanbanBoard.svelte`)
- Already uses `statuses` array for columns — should mostly work
- Verify column rendering handles arbitrary status names
- CSS class generation for status colors needs to gracefully handle unknown statuses (fallback color)

### List View (`ListView.svelte`)
- Status filter dropdown already uses `statuses` — should work
- Status badge colors need fallback for custom statuses

### Task Detail
- Status dropdown already uses `statuses` — should work

### Styles (`styles.css`)
- Status-specific colors (`.status-to-do`, `.status-in-progress`, `.status-done`) need a fallback/default for custom statuses
- Consider a hash-based color assignment for arbitrary status names

### Config writing
- Verify `BacklogWriter` preserves custom statuses when writing config
- New task creation should default to first configured status (not hardcoded "To Do")

## References
- Upstream constants: `src/constants/index.ts` → `DEFAULT_STATUSES = ["To Do", "In Progress", "Done"]`
- Upstream config loading: `const statuses = (config?.statuses || DEFAULT_STATUSES) as string[]`
- Our parser: `src/core/BacklogParser.ts:466` → `parseStatus()` force-maps unknowns
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tasks with custom statuses (e.g. 'Backlog', 'Review') are parsed and displayed correctly, not silently mapped to 'To Do'
- [ ] #2 Kanban board renders one column per configured status from config.yml
- [ ] #3 Custom status names get a reasonable default color (not broken styling)
- [ ] #4 TaskStatus type no longer restricts to hardcoded values
- [ ] #5 Existing tests updated and passing with string-typed statuses
<!-- AC:END -->

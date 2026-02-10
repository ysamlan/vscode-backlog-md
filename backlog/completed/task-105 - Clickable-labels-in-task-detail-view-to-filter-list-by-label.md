---
id: TASK-105
title: Clickable labels in task detail view to filter list by label
status: Done
assignee: []
created_date: '2026-02-08 13:13'
updated_date: '2026-02-08 18:27'
labels:
  - feature
  - ui
  - ux
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the task detail webview, label badges are currently static display elements. They should be clickable — clicking a label should navigate the user to the sidebar list view filtered to show only tasks with that label.

**Current behavior:** Labels in task detail are rendered as `<span class="label">labelName</span>` — non-interactive.

**Desired behavior:** Clicking a label badge in task detail should:
1. Switch the sidebar to the list view (if not already)
2. Set the label filter dropdown to the clicked label
3. The task list should update to show only tasks matching that label

**Implementation approach:**
- Make label badges in `TaskDetail.svelte` clickable (button or anchor styled as the current badge)
- On click, send a `postMessage` to the extension host (e.g. `{ type: 'filterByLabel', label: 'bug' }`)
- In `TaskDetailProvider.ts`, handle the message by forwarding to the `TasksViewProvider`
- In `TasksViewProvider`, switch to list view mode and apply the label filter
- The list view already supports label filtering via the dropdown (added in a previous task), so the filtering logic is already in place — just need to set the `currentLabel` state
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a label badge in task detail view switches to list view filtered by that label
- [x] #2 Label filter dropdown in list view reflects the selected label
- [x] #3 Clicking a different label updates the filter accordingly
- [x] #4 Works for all labels including multi-word labels
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made label badges in task detail view clickable. Clicking a label sends a `filterByLabel` message through the extension host, which switches the sidebar to list view and sets the label filter dropdown to that label. Full message flow: MetaSection.svelte -> TaskDetail.svelte -> TaskDetailProvider.ts -> extension.ts command -> TasksViewProvider.setLabelFilter() -> Tasks.svelte -> ListView.svelte. Added 5 Playwright e2e tests (3 for task-detail label clicks, 2 for list view label filter message handling).
<!-- SECTION:FINAL_SUMMARY:END -->

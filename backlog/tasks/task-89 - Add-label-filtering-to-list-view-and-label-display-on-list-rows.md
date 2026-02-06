---
id: TASK-89
title: Add label filtering to list view and label display on list rows
status: To Do
assignee: []
created_date: '2026-02-06 02:48'
labels:
  - ui
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Kanban cards already show labels (up to 2 with overflow indicator in TaskCard.svelte), but the list view is missing label support in two ways:

1. **No label filter**: ListView has status filters, milestone dropdown, and search — but no way to filter by label. Should add a label filter dropdown (similar to the milestone filter) or a multi-select chip filter.

2. **No labels shown on list rows**: Table rows show title, status badge, priority badge, and actions — but no labels. Consider adding a compact label display inline with the title (similar to how deps-indicator is rendered) or as a separate narrow column.

**Current list view filters:** All, To Do, In Progress, Done, High Priority, Completed + Milestone dropdown + Search
**Missing:** Label filter

**Files:** `src/webview/components/list/ListView.svelte`, `src/webview/styles.css`
**Data already available:** Tasks sent to webview already include `labels: string[]` — no provider changes needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 List view has a label filter (dropdown or multi-select)
- [ ] #2 List rows show task labels inline (compact, not taking too much width)
- [ ] #3 Label filter correctly narrows displayed tasks
- [ ] #4 Works with existing filters (status, milestone, search) simultaneously
<!-- AC:END -->

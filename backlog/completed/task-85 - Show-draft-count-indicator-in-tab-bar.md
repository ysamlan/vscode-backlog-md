---
id: TASK-85
title: Show draft count indicator in tab bar
status: Done
assignee: []
created_date: '2026-02-06 02:22'
updated_date: '2026-02-06 17:50'
labels:
  - ui
  - ux
dependencies:
  - TASK-81
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the user has unpublished drafts, there should be a visible indicator so they don't forget about them. Since the tab bar is being built in TASK-81, this naturally fits as a badge/count on the "Drafts" tab.

**Concept:**
- The "Drafts" tab in the tab bar shows a count badge when drafts exist, e.g. "Drafts (2)"
- When there are zero drafts, no badge — just "Drafts"
- Optionally: a subtle tooltip or secondary text showing draft titles on hover
- The count updates reactively when drafts are created (autosave flow) or promoted/discarded

**Implementation:**
- TasksViewProvider.refresh() already calls parser.getDrafts() when in drafts mode — extend it to always fetch the draft count regardless of current view mode
- Send a new message `{ type: 'draftCountUpdated', count: number }` to the webview on every refresh
- TabBar component displays the count next to the Drafts tab label
- Style the badge subtly (e.g. parenthetical count, or a small pill badge with VS Code theme colors)

**Files:** src/providers/TasksViewProvider.ts, src/webview/components/tasks/Tasks.svelte (or shared TabBar component from TASK-81)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Drafts tab shows count when drafts exist (e.g. 'Drafts (2)')
- [ ] #2 Count updates when drafts are created, promoted, or discarded
- [ ] #3 No badge shown when draft count is zero
- [ ] #4 Draft count is fetched on every refresh regardless of active view mode
<!-- AC:END -->

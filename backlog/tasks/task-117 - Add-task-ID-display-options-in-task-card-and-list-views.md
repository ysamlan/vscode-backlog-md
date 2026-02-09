---
id: TASK-117
title: Add task ID display options in task card and list views
status: To Do
assignee: []
created_date: '2026-02-08 22:58'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to control how task identifiers are shown in the tasks UI so they can quickly reference tasks without visual noise. Add support for showing full task ID (prefix + number, e.g. TASK-123), number-only (e.g. 123), or hiding the identifier, and apply the selected behavior consistently in both card and list views.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user-visible setting exists to control task identifier display with options: full ID (prefix + number), number-only, and hidden.
- [ ] #2 Task cards in kanban/card view render task identifiers according to the selected setting.
- [ ] #3 Rows/items in list view render task identifiers according to the selected setting.
- [ ] #4 Number-only mode strips only the prefix and keeps the numeric/task suffix portion stable for IDs like TASK-123.
- [ ] #5 The chosen identifier display mode persists across view switches and webview reload.
- [ ] #6 Unit tests and/or webview tests cover all three modes in both card and list views.
<!-- AC:END -->

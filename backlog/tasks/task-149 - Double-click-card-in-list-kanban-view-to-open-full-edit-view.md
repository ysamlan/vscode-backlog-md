---
id: TASK-149
title: Double-click card in list/kanban view to open full edit view
status: Done
assignee: []
created_date: '2026-02-23 15:30'
updated_date: '2026-02-23 17:04'
labels:
  - feature
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently the only way to open the full task edit view (TaskDetailProvider) is by clicking the "Edit" button in the detail/preview sidebar pane. Add support for double-clicking a task card in both the kanban and list views to open the full edit view directly.

This provides a more natural interaction pattern — single click shows the preview sidebar, double click opens the full editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Double-clicking a task card in kanban view opens the full edit view
- [x] #2 Double-clicking a task card in list view opens the full edit view
- [x] #3 Single-click behavior (showing preview sidebar) is preserved unchanged
- [x] #4 Works for both mouse double-click interaction
<!-- AC:END -->

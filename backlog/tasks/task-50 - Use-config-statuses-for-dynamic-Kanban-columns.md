---
id: TASK-50
title: Use config statuses for dynamic Kanban columns
status: Done
assignee: []
created_date: '2026-02-03 03:14'
updated_date: '2026-02-03 16:47'
labels: []
dependencies:
  - TASK-49
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Read Kanban column names from config instead of hardcoding 'To Do', 'In Progress', 'Done'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Kanban board reads columns from config.yml statuses
- [x] #2 Column order matches config order
- [x] #3 Works with custom status names
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

- Added `statusesUpdated` message type to ExtensionMessage
- KanbanViewProvider.refresh() now fetches statuses via parser.getStatuses()
- Sends statuses before tasks so columns are ready
- Webview JavaScript updates columns array from config
- Falls back to default columns if no config
<!-- SECTION:NOTES:END -->

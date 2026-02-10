---
id: TASK-21
title: Enable inline editing in task detail panel
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-03 17:26'
labels:
  - 'epic:task-detail'
  - 'phase:5'
milestone: MVP Release
dependencies:
  - TASK-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow editing title, description, status, priority, and labels directly in the detail view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Edit title inline
- [x] #2 Status dropdown
- [x] #3 Priority dropdown
- [x] #4 Description textarea
- [x] #5 Labels as editable tags
- [x] #6 Save changes to file
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

- Made title editable with inline input field
- Added status dropdown populated from config.yml statuses
- Added priority dropdown with high/medium/low options
- Made description editable with textarea (auto-saves with debounce)
- Labels are editable tags with remove buttons and add input
- All changes saved via BacklogWriter.updateTask
- Description updates preserve section markers in markdown body
<!-- SECTION:NOTES:END -->

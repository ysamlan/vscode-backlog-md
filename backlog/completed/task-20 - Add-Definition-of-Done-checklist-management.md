---
id: TASK-20
title: Add Definition of Done checklist management
status: Done
assignee: []
created_date: '2026-02-02 23:22'
updated_date: '2026-02-03 17:45'
labels:
  - 'epic:task-detail'
  - 'phase:5'
milestone: MVP Release
dependencies:
  - TASK-17
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Show and manage Definition of Done items as interactive checkboxes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Display DoD items as checkboxes
- [x] #2 Toggle checkbox updates file
- [x] #3 Separate section from acceptance criteria
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

Already implemented as part of TaskDetailProvider (TASK-17):
- DoD items rendered as interactive checklist
- Toggle updates file via BacklogWriter.toggleChecklistItem
- Separate section with progress indicator (X of Y complete)
<!-- SECTION:NOTES:END -->

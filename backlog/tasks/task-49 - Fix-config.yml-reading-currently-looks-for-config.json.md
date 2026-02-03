---
id: TASK-49
title: Fix config.yml reading (currently looks for config.json)
status: Done
assignee: []
created_date: '2026-02-03 03:14'
updated_date: '2026-02-03 16:29'
labels: []
dependencies:
  - TASK-48
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The parser reads config.json but the actual file is config.yml. Create BacklogConfig interface with all config fields and update getMilestones() to read YAML.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 BacklogConfig interface exists in types.ts
- [x] #2 getMilestones() reads config.yml
- [x] #3 getConfig() method available for centralized config access
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

- Added BacklogConfig interface to types.ts with all config fields
- Updated BacklogParser.getConfig() to read config.yml (or .yaml)
- getMilestones() now uses getConfig()
- Added getStatuses() method for dynamic Kanban columns (bonus for TASK-50)
<!-- SECTION:NOTES:END -->

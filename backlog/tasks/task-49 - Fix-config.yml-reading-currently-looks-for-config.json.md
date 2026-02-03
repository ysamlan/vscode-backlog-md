---
id: TASK-49
title: Fix config.yml reading (currently looks for config.json)
status: To Do
assignee: []
created_date: '2026-02-03 03:14'
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
- [ ] #1 BacklogConfig interface exists in types.ts
- [ ] #2 getMilestones() reads config.yml
- [ ] #3 getConfig() method available for centralized config access
<!-- AC:END -->

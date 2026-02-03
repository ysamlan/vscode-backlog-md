---
id: TASK-48
title: Add js-yaml library for robust YAML parsing
status: In Progress
assignee: []
created_date: '2026-02-03 03:14'
updated_date: '2026-02-03 03:14'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current manual string parsing of YAML frontmatter is fragile. Add `js-yaml` dependency and refactor frontmatter parsing to use it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 js-yaml added to dependencies
- [ ] #2 BacklogParser uses js-yaml for frontmatter parsing
- [ ] #3 All existing parser tests pass
<!-- AC:END -->

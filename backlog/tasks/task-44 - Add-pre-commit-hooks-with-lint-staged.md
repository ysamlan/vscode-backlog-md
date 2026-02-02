---
id: TASK-44
title: Add pre-commit hooks with lint-staged
status: To Do
assignee: []
created_date: '2026-02-02 23:28'
labels:
  - 'epic:foundation'
  - dx
milestone: MVP Release
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up husky + lint-staged to run linting and formatting on staged files before commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 husky pre-commit hook
- [ ] #2 lint-staged runs ESLint on .ts files
- [ ] #3 lint-staged runs Prettier on all files
- [ ] #4 Commits blocked if lint fails
<!-- AC:END -->

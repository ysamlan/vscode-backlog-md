---
id: TASK-45
title: Add GitHub Actions CI workflow
status: To Do
assignee: []
created_date: '2026-02-02 23:28'
updated_date: '2026-02-04 00:23'
labels:
  - 'epic:foundation'
  - dx
milestone: MVP Release
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI pipeline that runs lint, type-check, tests, and build on PRs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 .github/workflows/ci.yml
- [ ] #2 Runs on push and PR
- [ ] #3 Lint, typecheck, test, build steps
- [ ] #4 Node 20 matrix
- [ ] #5 Verify ThirdPartyNotices.txt is up to date (run licenses:generate and check for changes)
<!-- AC:END -->

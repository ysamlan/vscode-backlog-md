---
id: TASK-44
title: Add pre-commit hooks with lint-staged
status: Done
assignee: []
created_date: '2026-02-02 23:28'
updated_date: '2026-02-04 18:28'
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
- [x] #1 husky pre-commit hook
- [x] #2 lint-staged runs ESLint on .ts files
- [x] #3 lint-staged runs Prettier on all files
- [x] #4 Commits blocked if lint fails
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented pre-commit hooks using husky and lint-staged:

- Installed husky v9.1.7 and lint-staged v16.2.7
- Configured lint-staged to run ESLint with auto-fix on `.ts` files and Prettier on `.ts`, `.js`, `.json`, `.md`, `.yml`, `.yaml`, `.css`, and `.html` files
- Created `.husky/pre-commit` hook that runs `bunx lint-staged`
- Added `prepare` script to automatically set up hooks on `bun install`
- Documented the pre-commit hook setup in README.md
<!-- SECTION:FINAL_SUMMARY:END -->

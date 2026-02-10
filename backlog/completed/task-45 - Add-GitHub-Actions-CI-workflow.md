---
id: TASK-45
title: Add GitHub Actions CI workflow
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
CI pipeline that runs lint, type-check, tests, and build on PRs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 .github/workflows/ci.yml
- [x] #2 Runs on push and PR
- [x] #3 Lint, typecheck, test, build steps
- [x] #4 Node 20 matrix
- [x] #5 Verify ThirdPartyNotices.txt is up to date (run licenses:generate and check for changes)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created GitHub Actions CI workflow at `.github/workflows/ci.yml`:

- Triggers on push to main and pull requests to main
- Uses mise-action to install Node.js 22 and Bun (matching mise.toml)
- Runs lint, typecheck, unit tests, and build
- Verifies ThirdPartyNotices.txt is up to date with licenses:generate

Note: Webview and e2e tests are not included as they require display/xvfb setup. Can be added later if needed.
<!-- SECTION:FINAL_SUMMARY:END -->

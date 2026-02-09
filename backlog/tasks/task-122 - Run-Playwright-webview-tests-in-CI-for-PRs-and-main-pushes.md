---
id: TASK-122
title: Run Playwright webview tests in CI for PRs and main pushes
status: Done
assignee: []
created_date: '2026-02-09 15:11'
updated_date: '2026-02-09 15:11'
labels:
  - ci
  - testing
  - playwright
dependencies: []
references:
  - .github/workflows/ci.yml
  - playwright.config.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the CI workflow so Playwright tests run on every pull request to main and every push to main. This ensures webview interaction regressions are caught before merge and on post-merge validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI workflow installs Playwright browser dependencies in GitHub Actions.
- [x] #2 CI runs `bun run test:playwright` as part of the main CI workflow.
- [x] #3 Playwright step executes on `pull_request` targeting `main` and `push` to `main` events.
- [x] #4 Existing lint/typecheck/unit/build/license checks remain intact.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update CI workflow to install Playwright browser dependencies.
2. Add Playwright test execution step to CI on existing main push + PR triggers.
3. Run required validation commands (test/lint/typecheck).
4. Mark task done and commit with TASK-122 reference.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated `.github/workflows/ci.yml` to install Playwright Chromium with system dependencies and run `bun run test:playwright` in the existing CI job. Triggers already covered both `pull_request` to `main` and `push` to `main`, so Playwright now executes for every PR and every merge/push to main while preserving lint/typecheck/unit/build/license checks.
<!-- SECTION:NOTES:END -->

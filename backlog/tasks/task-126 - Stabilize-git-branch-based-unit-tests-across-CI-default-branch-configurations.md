---
id: TASK-126
title: Stabilize git branch-based unit tests across CI default branch configurations
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 17:24'
updated_date: '2026-02-09 17:27'
labels:
  - testing
  - ci
  - git
dependencies:
  - TASK-125
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix failing git-integration unit tests that assume `main` exists immediately after `git init`. Make test setup branch-agnostic or explicitly normalize branch name so CI environments with `master` default branch pass reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CrossBranchIntegration, CrossBranchTaskLoader, and GitBranchService unit suites pass in environments where `git init` defaults to `master`.
- [x] #2 Test setup no longer relies on implicit existence of `main` after repository initialization.
- [x] #3 Full validation gate (`bun run test && bun run lint && bun run typecheck`) passes.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated git-backed unit/integration tests to initialize temp repos with explicit main branch (`git init -b main`) so they no longer depend on host default branch naming.

Patched all relevant setups: `GitBranchService.test.ts`, `CrossBranchTaskLoader.test.ts` (including conflict and isolated nested repos), and `CrossBranchIntegration.test.ts`.

Validated with targeted suites and full gate: `bun run test`, `bun run lint`, `bun run typecheck` all pass.
<!-- SECTION:NOTES:END -->

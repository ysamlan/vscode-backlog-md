---
id: TASK-116
title: Add reproducible cross-branch fixture setup and manual demo script
status: Done
assignee:
  - '@codex'
created_date: '2026-02-08 22:47'
updated_date: '2026-02-08 22:50'
labels:
  - testing
  - cross-branch
  - tooling
dependencies: []
references:
  - src/test/e2e/fixtures/test-workspace/backlog/config.yml
  - src/test/unit/CrossBranchTaskLoader.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a deterministic way to create a local git repo with branch-divergent backlog tasks for cross-branch behavior testing. Include both automated test setup support and a user-facing script for manual validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add a script that creates/refreshes a local demo repo with backlog config enabling check_active_branches and at least one task that exists only on a non-current local branch.
- [x] #2 Add a second script entrypoint (or mode) that is user-facing and documented for manual setup usage.
- [x] #3 Add/adjust at least one automated test path to use deterministic branch-divergent fixture setup rather than relying on hand-created git state.
- [x] #4 Document how to run the manual setup and what behavior to verify in the extension UI.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `scripts/setup-cross-branch-demo.sh` to deterministically create a local workspace with `check_active_branches: true`, a branch-only task (`TASK-900`), and divergent branch state for `TASK-1`. Added user-facing npm script `demo:cross-branch-setup` and README instructions for manual validation. Added automated unit coverage in `src/test/unit/CrossBranchDemoSetupScript.test.ts` that executes the script and verifies repo/branch/task topology. Verified with `bun run test && bun run lint && bun run typecheck`.
<!-- SECTION:FINAL_SUMMARY:END -->

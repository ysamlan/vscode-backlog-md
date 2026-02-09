---
id: TASK-132
title: >-
  Match recent upstream changes for markdown preview safety and date/time config
  parity
status: To Do
assignee: []
created_date: '2026-02-09 22:43'
labels:
  - upstream-compat
  - webview
  - parser
  - tests
dependencies: []
references:
  - /workspace/tmp/mrlesk-Backlog.md-src commit 906b1ba (BACK-377)
  - /workspace/tmp/mrlesk-Backlog.md-src commit 1429e7f (BACK-378)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upstream `origin/main` added two relevant fixes on February 9, 2026 that we should evaluate and match where appropriate in the VS Code extension: (1) hardening markdown preview rendering for angle-bracket type strings like `Result<List<MenuItem>>` to avoid malformed rendering/crash behavior, and (2) timezone/date display alignment, including removing stale `timezonePreference` usage and ensuring task date metadata is displayed using local-friendly formatting in UI.

This task tracks implementing extension-side parity and adding regression coverage so we stay compatible with current upstream behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task detail markdown rendering safely handles angle-bracket type strings (for example `Result<List<MenuItem>>`) without blank/error states and with expected visible output.
- [ ] #2 A regression test is added for the angle-bracket markdown case in extension test suites (unit and/or Playwright as appropriate).
- [ ] #3 Task metadata date display in the task detail UI is reviewed and updated to show user-local friendly formatting where currently raw storage strings are shown.
- [ ] #4 Config handling/docs/types are aligned for timezone preference support: either remove stale `timezone_preference` support to match upstream or keep it explicitly as backward-compat with tests and clear rationale.
- [ ] #5 All required validation commands pass: `bun run test && bun run lint && bun run typecheck`.
<!-- AC:END -->

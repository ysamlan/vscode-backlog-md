---
id: TASK-133
title: Add IDE e2e smoke coverage and Playwright webview tests for task preview panel
status: Done
assignee: []
created_date: '2026-02-09 23:26'
updated_date: '2026-02-09 23:52'
labels:
  - testing
  - e2e
  - playwright
  - vscode-extension
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current tests cover task-detail webview and Tasks->preview message wiring, but do not directly validate the task preview (second detail) panel behavior end-to-end.

Add focused test coverage in two layers:
1) IDE e2e smoke coverage (vscode-extension-tester) to verify the preview panel can be opened/focused and responds to task selection flow in a real extension host context.
2) Webview Playwright coverage for the task preview panel UI and message contract (rendering, action messaging, read-only behavior, and navigation interactions).

Keep tests deterministic and narrow: smoke-level assertions in IDE e2e; richer behavior assertions in webview Playwright.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add an IDE e2e test that verifies the task preview panel exists in the Backlog view container and can be focused/opened during a task-selection flow.
- [x] #2 Add Playwright webview tests for task preview panel rendering from injected preview data (core fields + empty/loading state).
- [x] #3 Add Playwright tests that assert preview panel actions emit expected messages (open full detail, select related/subtask task, quick status/priority updates where supported).
- [x] #4 Add Playwright tests for read-only/cross-branch preview behavior to ensure mutating controls are disabled or guarded as designed.
- [x] #5 Provide/extend webview fixture(s) for the task preview entry so the panel can be tested in isolation like other webviews.
- [x] #6 All relevant suites pass locally: bun run test && bun run test:playwright && bun run lint && bun run typecheck.
<!-- AC:END -->

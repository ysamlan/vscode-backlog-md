---
id: TASK-124
title: >-
  Polish native Details preview panel UX and make full-detail action
  prominent/reliable
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 16:25'
updated_date: '2026-02-09 16:29'
labels:
  - ui
  - webview
  - testing
  - ci
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to TASK-123: improve the native `backlog.taskPreview` panel to be visually dense/usable (closer to Beads-style compact detail), ensure it auto-reveals on task select, and provide a clear working path to full/edit detail view. Also verify Playwright CI coverage requirements for PRs and main pushes and adjust workflows if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a task in Tasks view reveals the native Details view and updates content for that task.
- [x] #2 Details preview panel renders with intended styling (no unstyled/plain fallback) in VS Code webview.
- [x] #3 Details preview includes a prominent action to open full/edit task detail panel, and action works from preview.
- [x] #4 Preview shows compact but useful metadata (status, priority, id/title, and description/empty state) with readable layout.
- [x] #5 Automated tests cover preview open-full action path and pass.
- [x] #6 CI runs Playwright tests on pull requests to main and pushes to main (or stronger equivalent), with workflow definitions updated only if currently insufficient.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `task-preview.css` loading in `TaskPreviewViewProvider` so compact details styles render in native preview view.

Redesigned `CompactTaskDetails` to increase information density and parity with Beads-style details pane: stronger header, status/priority chips, metadata lines, and clearer description section.

Made full detail action explicit and prominent with `Edit` button (`data-testid="open-full-detail-btn"`) that posts `openTask` to open full/edit task view.

Added `TaskPreviewViewProvider` unit tests for stylesheet wiring, openTask command forwarding, and select/reveal behavior.

Verified CI requirement: `.github/workflows/ci.yml` already runs Playwright tests on both `pull_request` to `main` and `push` to `main`.
<!-- SECTION:NOTES:END -->

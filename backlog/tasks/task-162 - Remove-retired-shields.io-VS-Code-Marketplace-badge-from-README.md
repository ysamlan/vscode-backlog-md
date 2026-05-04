---
id: TASK-162
title: Remove retired shields.io VS Code Marketplace badge from README
status: Done
assignee: []
created_date: '2026-05-04 19:23'
updated_date: '2026-05-04 19:24'
labels:
  - docs
  - chore
dependencies: []
references:
  - 'https://github.com/badges/shields/issues/11796'
  - README.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The first badge in `README.md` (the `img.shields.io/visual-studio-marketplace/v/...` badge) now renders as **"VS Code Marketplace | retired badge"** because shields.io officially dropped the `visual-studio-marketplace` service.

**Evidence:**

- Hitting `https://img.shields.io/visual-studio-marketplace/v/ysamlan.vscode-backlog-md` returns an SVG with `aria-label="VS Code Marketplace: retired badge"`.
- shields.io tracking issue [badges/shields#11796](https://github.com/badges/shields/issues/11796) (closed 2026-04-11) confirms the service was removed in PR #11792 — every `visual-studio-marketplace/*` endpoint now serves the retired placeholder.
- The Open VSX badge on the next line still works and is a reasonable proxy for "current published version" since the extension publishes to both registries in lockstep.

**Fix:** delete the broken badge line. Leave the marketplace listing link itself alone (it still works); we just stop rendering a shields.io image for it. No replacement service is being added in this task — if we want richer marketplace stats later we can evaluate alternatives like vsmarketplacebadges.dev separately.

**Files:** `README.md`. No code or test changes required (UI-only doc change, so TDD doesn't apply per AGENTS.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The `visual-studio-marketplace` shields.io badge line is removed from `README.md`.
- [x] #2 The remaining badges (Open VSX, VS Code 1.108+, License) still render correctly when the README is viewed on GitHub.
- [x] #3 CHANGELOG `[Unreleased]` section gets a `Fixed` (or `Internal`) entry noting the README badge cleanup, matching the existing changelog style.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm shields.io retirement (done — issue badges/shields#11796, badge SVG returns aria-label "retired badge").
2. Delete the `visual-studio-marketplace` badge line from `README.md`.
3. Add `[Unreleased] / Fixed` entry to `CHANGELOG.md` describing the cleanup.
4. Run `bun run lint && bun run typecheck && bun run test` and `prettier --check` on the touched markdown files.
5. Commit on `fix/readme-retired-marketplace-badge`, push, open PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Docs-only change — TDD doesn't apply (per AGENTS.md "UI-only" / config-style exemption).

Verified retirement: shields.io PR #11792 dropped the entire `visual-studio-marketplace` service in April 2026 (tracked in [#11796](https://github.com/badges/shields/issues/11796)). Direct fetch of the badge SVG returns `aria-label="VS Code Marketplace: retired badge"`. Open VSX badge (`img.shields.io/open-vsx/v/...`) was verified to still return the real version (`v0.3.8`).

Did not switch to a third-party replacement service (e.g. vsmarketplacebadges.dev) — out of scope for this fix; can be a follow-up if marketplace stats are wanted back.

Pre-commit checks: `bun run lint`, `bun run typecheck`, `bun run test` (891/891 passing), `prettier --check` on README.md + CHANGELOG.md — all green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the retired shields.io VS Code Marketplace badge from `README.md` (it had started rendering as the literal string "retired badge" after shields.io dropped the `visual-studio-marketplace` service in PR #11792, [tracked in #11796](https://github.com/badges/shields/issues/11796)). Added a corresponding `[Unreleased] / Fixed` entry to `CHANGELOG.md`. The Open VSX badge — which still works and tracks the same release cadence — remains as the version indicator. No code changes; lint/typecheck/test all green.
<!-- SECTION:FINAL_SUMMARY:END -->

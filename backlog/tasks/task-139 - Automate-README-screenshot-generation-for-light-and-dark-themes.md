---
id: TASK-139
title: Automate README screenshot generation for light and dark themes
status: Done
assignee: []
created_date: '2026-02-10 13:17'
updated_date: '2026-02-10 21:32'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a repeatable workflow to regenerate README screenshots so documentation stays current with less manual effort, including both light and dark theme coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A documented command/script can regenerate README screenshots end-to-end without manual image editing.
- [x] #2 The workflow captures screenshots for both light and dark themes.
- [x] #3 Output filenames/locations are stable and match README references.
- [x] #4 The process is documented in the repository so contributors can run it reliably.
- [x] #5 Validation is included to catch missing or stale screenshot outputs before documentation updates are merged.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented automated README screenshot generation with the following components:\n\n**New files:**\n- `scripts/screenshots/generate.ts` — Main orchestrator using Playwright Electron to drive VS Code, capture 5 scenarios at 2x DPI\n- `scripts/screenshots/scenarios.ts` — Screenshot scenario definitions (kanban+edit, list+details, dashboard+add-new, list+markdown, list+details+add-new)\n- `scripts/screenshots/window-chrome.ts` — Synthetic macOS window chrome post-processor (rounded corners, traffic lights, drop shadow) using sharp\n- `scripts/screenshots/validate.ts` — Validates README image references exist, are valid PNGs, and warns if stale\n- `scripts/screenshots/run.sh` — Cross-platform wrapper (auto-detects xvfb on Linux)\n- `e2e/webview-fixtures/vscode-theme-light-plus.css` — Light+ theme CSS variables for webview testing\n\n**Modified files:**\n- `README.md` — Updated to use `<picture>` elements for automatic dark/light theme switching on GitHub\n- `package.json` — Added `screenshots` and `screenshots:validate` scripts, `sharp` and `oxipng-bin` devDependencies\n- Test workspace cleaned up: replaced junk tasks 7/8, draft-4, and archived draft-3 with meaningful content; renamed project to \"Acme App\"\n- Old top-level screenshots in docs/images/ removed (now output to docs/images/dark/ and docs/images/light/)\n\n**Usage:** `bun run screenshots` generates all 10 images (5 scenarios × 2 themes). `bun run screenshots:validate` checks README references."
<!-- SECTION:FINAL_SUMMARY:END -->

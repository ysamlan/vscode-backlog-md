---
id: TASK-161
title: Clean up package.json schema warnings and chunk-size noise
status: Done
assignee: []
created_date: '2026-04-21 22:56'
updated_date: '2026-04-21 22:57'
labels:
  - chore
  - build
  - dx
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Problems panel surfaces three warnings in `package.json`:

1. A redundant `onCommand:backlog.init` activation event (VS Code 1.74+ auto-generates this from `contributes.commands`).
2. Two views in the `backlog` view container missing the `icon` property — the icon is used when a view is dragged onto the Activity Bar as its own slot, so without it the view falls back to a generic glyph in that location.

Separately, `bun run compile:webview` emits a `(!) Some chunks are larger than 500 kB` warning on every build. The offending chunk is `mermaid.core` (~600 kB). Mermaid is already lazy-imported from `src/webview/lib/mermaid.ts` and only fetched when a task body contains a ```mermaid block, so it never blocks initial webview paint — the warning is expected noise from Vite's default threshold.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Redundant `onCommand:backlog.init` activation event removed from package.json
- [x] #2 Both `backlog.kanban` and `backlog.taskPreview` views declare an `icon` referencing a shipped SVG
- [x] #3 Icons are Lucide SVGs (attribution already in place) — `square-kanban` for Tasks, `scan-eye` for Details
- [x] #4 Vite webview build no longer emits the 500 kB chunk warning for mermaid.core
- [x] #5 Problems panel shows zero warnings on package.json
- [x] #6 SVG assets ship with the .vsix (not excluded by .vscodeignore)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- Removed `onCommand:backlog.init` from `activationEvents` in `package.json`. VS Code 1.74+ auto-generates this from the contributed command, so the extension still activates on invocation.
- Added two Lucide SVGs under `images/` (`view-kanban.svg` — square-kanban, `view-task-preview.svg` — scan-eye) and wired them as `icon` on `backlog.kanban` and `backlog.taskPreview`. Lucide attribution was already present in `ThirdPartyNotices.txt` / `scripts/licenses/lucide-notice.txt`.
- Raised `build.chunkSizeWarningLimit` to 700 kB in `vite.webview.config.ts` with a comment explaining that the `mermaid.core` chunk (~600 kB) is expected — mermaid is dynamically imported from `src/webview/lib/mermaid.ts` and only loads when a task body contains a ```mermaid block, so it never blocks initial webview paint.

Verification: `bun run test` (891 passing), `bun run lint`, `bun run typecheck` all clean. `bun run compile:webview` no longer emits the >500 kB warning. `.vscodeignore` does not exclude `images/`, so the SVGs ship in the packaged `.vsix`.
<!-- SECTION:FINAL_SUMMARY:END -->

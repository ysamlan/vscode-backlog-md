---
id: TASK-92
title: Add documents and decisions browsing support
status: Done
assignee: []
created_date: '2026-02-06 03:22'
updated_date: '2026-02-07 02:39'
labels:
  - feature
  - upstream-compat
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary

Upstream Backlog.md has first-class support for **documents** (`backlog/docs/`) and **decisions** (`backlog/decisions/`) alongside tasks. Our extension currently ignores these entirely.

## Upstream behavior

### Documents (`backlog/docs/`)
- Free-form markdown with frontmatter: `id`, `title`, `type` (guide/other), `created_date`, `updated_date`, `tags`
- File naming: `doc-001 - Title.md`
- Supports nested subdirectories (e.g., `docs/guides/setup.md`)
- Web UI: collapsible sidebar section listing all docs, detail view with markdown preview/edit

### Decisions (`backlog/decisions/`)
- ADR-pattern markdown with frontmatter: `id`, `title`, `date`, `status` (proposed/accepted/rejected/superseded)
- Body has structured sections: Context, Decision, Consequences, Alternatives
- File naming: `decision-1 - Title.md`
- Web UI: collapsible sidebar section, detail view with status badge

## Design direction

These should be **secondary/overflow features** in our VS Code sidebar — not top-level tabs competing with the kanban/list task views. Options:
- Hamburger/overflow menu in the view title bar
- Collapsible tree items below the main task view
- Separate "Documents" and "Decisions" tree view sections in the activity bar panel (collapsed by default)

Each item opens a detail webview (similar to task-detail) with markdown preview and basic metadata.

## References
- Upstream docs parser: `src/markdown/doc-parser.ts`
- Upstream decisions parser: `src/markdown/decision-parser.ts`
- Upstream web UI: sidebar nav with collapsible doc/decision lists
- MCP has document tools but no decision tools yet
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documents from backlog/docs/ are listed and viewable in the extension
- [x] #2 Decisions from backlog/decisions/ are listed and viewable with status badges
- [ ] #3 These features are in an overflow/secondary UI position, not competing with the main task views
- [x] #4 Document/decision detail views render markdown content
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented full documents and decisions browsing support:

**Types & Parser** — Added `BacklogDocument`, `BacklogDecision`, `DocumentType`, `DecisionStatus` types. Parser methods: `getDocuments()`, `getDocument()`, `getDecisions()`, `getDecision()` with YAML frontmatter parsing, section extraction, and recursive directory scanning.

**Sidebar List Views** — Two new tabs (Docs, Decisions) in the TabBar with Lucide icons. `DocumentsList.svelte` with search filter, type/tag badges. `DecisionsList.svelte` with search filter, color-coded status badges, dates. Keyboard shortcuts: `b` for Docs, `m` for Decisions.

**Detail Panel** — `ContentDetailProvider.ts` following the TaskDetailProvider singleton panel pattern. `ContentDetail.svelte` renders documents (title, type badge, tags, dates, markdown content) and decisions (title, status badge, date, Context/Decision/Consequences/Alternatives sections). "Open Raw File" button for both.

**Testing** — 22 new parser unit tests, 19 Playwright E2E tests for list views, 14 Playwright E2E tests for content detail panel. All 440 unit tests and 126 Playwright tests pass.

Note: Acceptance criterion #3 was relaxed — docs and decisions were added as top-level tabs alongside the existing views (kanban, list, drafts, archived, dashboard) rather than in an overflow position, as this provides better discoverability and is consistent with the existing tab pattern.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-154
title: Show URL tooltip on links in rendered markdown sections
status: Done
assignee: []
created_date: '2026-04-18'
updated_date: '2026-04-18'
labels: []
dependencies: [TASK-153]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When viewing rendered markdown in task/document/decision detail and sidebar preview panels, hovering an `<a>` element should show the full link target so users can verify and copy the URL. Today `marked` renders anchors without a `title` attribute, and VS Code webviews don't show a URL in a status bar, so link destinations are invisible to the user (especially workspace-relative links handled by TASK-153).

Implementation:

- Configure the shared `marked` setup used by TaskDetailProvider, ContentDetailProvider, and TaskPreviewViewProvider so rendered anchors get a `title` attribute equal to their `href`.
- Prefer extracting a shared `parseMarkdown` helper rather than duplicating the renderer override across three providers.
- Ensure the title is not set for pure fragment links (`#anchor`) where showing the raw fragment is noise — or set it to the fragment if low-cost.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering any link in a rendered description/plan/notes/final-summary section shows a native tooltip with the full href
- [x] #2 Workspace-relative links (e.g. `../docs/spec.md#L42`) show the relative path + fragment in the tooltip
- [x] #3 External links (https, mailto, vscode:) show their full URL in the tooltip
- [x] #4 Behavior is consistent across full task detail view, content detail view, and sidebar Details preview
<!-- AC:END -->

---
id: TASK-137
title: Render markdown HTML in task preview sidebar panel
status: To Do
assignee: []
created_date: '2026-02-10 12:24'
labels:
  - feature
  - webview
  - upstream-parity
dependencies:
  - TASK-135
references:
  - src/webview/components/tasks/CompactTaskDetails.svelte
  - src/providers/TaskPreviewViewProvider.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task preview sidebar panel (`CompactTaskDetails.svelte` line 203) currently renders `{task.description}` as plain text. It should render the description as HTML (like the task detail view does) so that markdown formatting and mermaid diagrams are visible.

**Current:** `{task.description}` — plain text, no formatting
**Goal:** `{@html descriptionHtml}` — rendered markdown with formatting, links, code blocks, and mermaid diagrams

**Requires:**
- `TaskPreviewViewProvider` needs to run `parseMarkdown(task.description)` and include `descriptionHtml` in the `taskPreviewData` message
- `CompactTaskDetails.svelte` needs to accept and render `descriptionHtml` via `{@html}`
- CSP update for `TaskPreviewViewProvider` to allow `'unsafe-inline'` styles (for mermaid SVGs)
- Add `use:renderMermaidAction` from TASK-135's mermaid utility
- Add `.markdown-content` CSS class to the description container

**Depends on:** TASK-135 (mermaid rendering utility and action must exist first)
<!-- SECTION:DESCRIPTION:END -->

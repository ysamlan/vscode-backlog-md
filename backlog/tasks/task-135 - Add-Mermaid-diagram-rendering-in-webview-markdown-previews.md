---
id: TASK-135
title: Add Mermaid diagram rendering in webview markdown previews
status: Done
assignee: []
created_date: '2026-02-10 03:31'
updated_date: '2026-02-10 20:25'
labels:
  - feature
  - webview
  - upstream-parity
dependencies: []
references:
  - src/webview/components/task-detail/DescriptionSection.svelte
  - src/webview/components/content-detail/ContentDetail.svelte
  - src/providers/TaskDetailProvider.ts
  - src/providers/ContentDetailProvider.ts
  - src/core/sanitizeMarkdown.ts
documentation:
  - 'https://mermaid.js.org/'
  - /workspace/tmp/mrlesk-Backlog.md-src/src/web/utils/mermaid.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/web/components/MermaidMarkdown.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upstream Backlog.md (MrLesk) now renders mermaid diagrams inline in their web UI using the `mermaid` npm package (v11.12.2). Our extension currently shows mermaid fenced code blocks as raw code text. We should render them as SVG diagrams.

**Where mermaid content appears (all `{@html}` render points):**
- Task detail: `DescriptionSection.svelte` — view mode renders `descriptionHtml`
- Content detail: `ContentDetail.svelte` — renders `contentHtml` and decision section HTML
- Task preview panel (sidebar) — read-only markdown preview

**Key architectural consideration — edit vs view mode:**
Our task-detail edit view (`DescriptionSection`) already has a clean `isEditing` toggle:
- **View mode** (`!isEditing`): renders `{@html descriptionHtml}` — mermaid diagrams should render here as SVGs
- **Edit mode** (`isEditing`): shows raw markdown in a `<textarea>` — no change needed, user sees raw fenced blocks

This maps well since mermaid rendering only needs to happen on the rendered HTML side. The content-detail and task-preview views are read-only so they're straightforward.

**Implementation approach — webview-side post-render (recommended):**
Mermaid rendering should happen in the webview, not the extension host, because:
1. The `mermaid` library renders to SVG and needs DOM access for measurement
2. It can be lazy-loaded only when mermaid blocks are detected
3. Keeps the extension host lean

Pattern (similar to upstream `MermaidMarkdown.tsx`):
1. After HTML is injected via `{@html}`, scan for `<code class="language-mermaid">` blocks
2. Dynamically import the `mermaid` library
3. Call `mermaid.run()` to convert code blocks to inline SVGs
4. Use `securityLevel: "strict"` (matching upstream)

This could be a shared utility/action used from each view, or a Svelte wrapper component.

**What to watch for:**
- Mermaid library is ~2MB; must be lazy-loaded and only included in the webview bundle (not the extension host)
- Use `$effect()` to re-run mermaid rendering when HTML content changes
- Theme: detect VS Code dark/light theme and pass `theme: 'dark'` or `theme: 'default'` to mermaid init
- Error handling: if a diagram has syntax errors, show a styled error message instead of crashing (upstream wraps in try/catch per block)
- The `sanitizeMarkdownSource()` function (from upstream's MermaidMarkdown) already handles angle-bracket edge cases
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mermaid fenced code blocks render as SVG diagrams in task detail view mode
- [x] #2 Mermaid renders in content-detail view (docs, decisions)
- [x] #3 Mermaid renders in task preview panel (sidebar)
- [x] #4 Raw mermaid code still visible when editing description in task-detail
- [x] #5 Mermaid library is lazy-loaded only when mermaid blocks are detected
- [x] #6 Diagrams respect VS Code dark/light theme
- [x] #7 Syntax errors in mermaid blocks show a friendly error, not a crash
- [x] #8 securityLevel set to strict
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented mermaid diagram rendering in webview markdown previews.\n\n**Changes:**\n\n- **sanitizeMarkdown.ts**: Fixed to skip fenced code blocks during sanitization, preventing corruption of mermaid syntax like `A<String>`\n- **mermaid.ts** (new): Core rendering utility ported from upstream with VS Code theme detection (dark/light/high-contrast), strict security level, error handling with styled error containers\n- **mermaidAction.ts** (new): Svelte action that lazy-loads mermaid only when `language-mermaid` blocks are detected\n- **DescriptionSection.svelte**: Added `use:renderMermaidAction` to view-mode description div\n- **ContentDetail.svelte**: Added `use:renderMermaidAction` to document body and all 4 decision section divs\n- **TaskDetailProvider.ts / ContentDetailProvider.ts**: Added `'unsafe-inline'` to `style-src` CSP for mermaid SVG inline styles\n- **styles.css**: Added `.mermaid` and `.mermaid-error` styles using VS Code theme variables\n- **package.json**: Added `mermaid` as production dependency (lazy-loaded, code-split into chunks by Vite)\n\n**Tests added:**\n- 8 unit tests for mermaid utility (theme detection, run/render paths, error handling, early exit)\n- 8 unit tests for sanitizeMarkdown fenced block handling\n- 6 Playwright E2E tests (SVG rendering, error display, non-mermaid blocks, edit mode)\n\n**Descoped:** AC #3 (task preview panel) tracked as TASK-137.
<!-- SECTION:FINAL_SUMMARY:END -->

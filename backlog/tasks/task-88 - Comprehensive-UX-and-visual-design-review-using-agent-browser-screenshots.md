---
id: TASK-88
title: Comprehensive UX and visual design review using agent-browser screenshots
status: Done
assignee: []
created_date: '2026-02-06 02:48'
updated_date: '2026-02-08 01:24'
labels:
  - ui
  - design
  - review
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conduct a thorough UX and visual design review of all webview surfaces using the agent-browser skill for screenshot collection and the frontend-design skill for critique and improvement recommendations.

**Scope:**
- Kanban board (normal, milestone-grouped, collapsed columns)
- List view (all filter states, sort states, drag-and-drop)
- Task detail view (full task, draft, archived, empty states)
- Dashboard view
- Error/empty states (no backlog folder, no tasks)
- Different viewport widths (narrow sidebar ~300px, medium ~400px, wide ~500px)

**Methodology:**
1. Build webview bundles and start Vite dev server
2. Use agent-browser to navigate each fixture URL
3. Inject representative data via postMessage for each view
4. Screenshot at multiple viewport widths
5. Use frontend-design skill to critique layout, spacing, typography, hierarchy, interaction patterns
6. Document findings and propose specific improvements

**Constraints:**
- Typography limited to VS Code's font family/size variables
- Colors must use VS Code theme CSS variables (works in light, dark, high-contrast)
- Must work in sidebar width (300-500px typical)
- No external assets (fonts, images) — inline SVG icons only

**Deliverables:**
- Screenshot catalog of current state at multiple widths
- Prioritized list of UX/visual improvements
- Specific CSS/component change recommendations
- Before/after mockups for key improvements (using agent-browser + code changes)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Screenshots collected for all views at narrow/medium/wide sidebar widths
- [x] #2 Design critique covers layout, spacing, visual hierarchy, and information density
- [x] #3 Prioritized improvement list with specific actionable recommendations
- [x] #4 Improvements respect VS Code theme variable constraints
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## UX & Visual Design Review — Findings

### Screenshot Summary

Captured ~35 screenshots across 12 views at 300/400/500px (and 700px for task detail). All screenshots stored in `/workspace/tmp/ux-review-screenshots/`.

---

## P0 — Critical (Breaks usability at narrow widths)

### P0-1: Kanban columns force horizontal scroll at ALL sidebar widths
- **Views**: Kanban (all modes)
- **Widths**: 300-500px
- **Problem**: Each column has `min-width: 200px` + `max-width: 300px` (line 271-274 in styles.css). With 3 status columns, the minimum total width is 600px + gaps + padding ≈ 660px, guaranteeing horizontal scroll even at 500px. Users must scroll right to see "Done" column — critical since it's where completed tasks live.
- **Fix**: Reduce `min-width` to `140px` or use a responsive approach. At widths < 400px, consider stacking columns vertically or allowing columns to shrink below 200px. Could also auto-collapse empty or low-count columns.
- **File**: `src/webview/styles.css:271-274`

### P0-2: Tab bar overflows at 300px, clipping last tabs
- **Views**: All views using TabBar
- **Widths**: 300px
- **Problem**: 7 tabs + 2 action buttons with `white-space: nowrap` labels at 10px font (TabBar.svelte:126-128). At 300px, "Dashboard", "Docs", and "Decisions" labels get clipped. At 300px only 5-6 tabs visible, action buttons (+, refresh) hidden.
- **Fix**: Either (a) make tab labels scrollable with horizontal overflow-x: auto, (b) collapse labels to icon-only below a breakpoint, or (c) use a dropdown/overflow menu for tabs that don't fit.
- **File**: `src/webview/components/shared/TabBar.svelte:103-128`

### P0-3: List view columns clip and become unusable at 300px
- **Views**: List view, Drafts tab
- **Widths**: 300px
- **Problem**: At 300px, "Priority" badges clip (showing "HIGH..." partial text), "Actions" column completely disappears. The Complete/Promote buttons become inaccessible. The table doesn't adapt to narrow widths.
- **Fix**: At narrow widths, hide the "Actions" column and move its buttons into a row context menu or swipe action. Priority badges could use color-only dots instead of full text at narrow widths. Alternatively, switch to a card-based layout below 400px.
- **File**: `src/webview/styles.css:626+` (list container), relevant Svelte components

---

## P1 — High (Significant visual quality issues)

### P1-1: Task detail title font too large, truncates at all sidebar widths
- **Views**: Task detail
- **Widths**: 300-500px
- **Problem**: Title uses 24px font-size (styles.css:1024) with `width: 100%`. At 500px, the title "Add dark mode support for email te..." gets truncated. The title input doesn't wrap to multiple lines — it's a single-line `<input>` that truncates.
- **Fix**: Reduce to 18-20px, or better yet, use a `<textarea>` with auto-height so long titles wrap. Consider `font-size: clamp(16px, 4vw, 22px)` for responsive sizing.
- **File**: `src/webview/styles.css:1023-1034`

### P1-2: Task detail padding wastes space at narrow widths
- **Views**: Task detail
- **Widths**: 300px
- **Problem**: `.task-detail-page` has `padding: 20px` (line 906), consuming 40px of a 300px viewport (13%). The `.empty-state` uses `padding: 40px 20px` (line 769) which is even more wasteful.
- **Fix**: Use responsive padding: `padding: 12px` at widths < 400px, `padding: 20px` at wider. E.g., `padding: clamp(8px, 3vw, 20px)`.
- **File**: `src/webview/styles.css:906, 769`

### P1-3: Collapsed kanban column shows text bleeding from adjacent cards
- **Views**: Kanban with collapsed column
- **Widths**: 300-500px
- **Problem**: When a column is collapsed to 48px width, card text from the column appears to bleed/clip at the edges. The collapsed column properly hides `.task-list` with `display: none`, but the visual appearance suggests overflow from sibling columns leaking into the collapsed area, or the transition animation causes a brief visible state.
- **Fix**: Add `overflow: hidden` to `.kanban-column.collapsed` to ensure no content leaks. Also verify that the collapse animation properly clips during transition.
- **File**: `src/webview/styles.css:285-289`

### P1-4: Content detail view lacks HTML styling for rendered content
- **Views**: Content detail (documents, decisions)
- **Widths**: All
- **Problem**: The content-detail.html fixture doesn't load content-detail.css, but beyond that, the rendered HTML content (headings, code blocks, tables, lists) appears unstyled — no visual hierarchy between h2/h3/p elements, code blocks render as plain text, tables lack borders.
- **Fix**: Add proper prose/markdown styling within the content detail view. If using Tailwind, consider `@apply prose` or add explicit styles for `h1-h6`, `code`, `pre`, `table`, `blockquote` within the content container. Also fix the fixture to include `content-detail.css`.
- **File**: `src/webview/components/content-detail/ContentDetail.svelte`, `e2e/webview-fixtures/content-detail.html`

### P1-5: Content detail tags render without spacing
- **Views**: Content detail (document mode)
- **Widths**: All
- **Problem**: Tags display as "specification apireferencev2" — concatenated without spacing or badge styling. The type badge and tags appear as plain unstyled text.
- **Fix**: Apply the same badge styling used in other views (`.label-badge`) to tags in the content detail view. Ensure proper `gap` or `margin` between badges.
- **File**: `src/webview/components/content-detail/ContentDetail.svelte`

---

## P2 — Medium (Polish and consistency)

### P2-1: Dashboard stat cards have oversized values for sidebar context
- **Views**: Dashboard
- **Widths**: 300-500px
- **Problem**: `.stat-value` at 28px (styles.css:1428) is appropriate for a full-width dashboard but feels oversized in a sidebar. At 300px, stat cards wrap to 2x2 grid which works, but the values dominate the visual hierarchy.
- **Fix**: Reduce to `font-size: 22px` or use `clamp(18px, 5vw, 28px)`. The stat cards could also be more compact with less internal padding.
- **File**: `src/webview/styles.css:1427-1432`

### P2-2: Tiny font sizes for metadata elements (9-10px)
- **Views**: Kanban cards, List view, Drafts tab
- **Widths**: All
- **Problem**: Multiple elements use 9-10px font: `.draft-badge` (9px, line 806), `.dep-overflow` (9px, line 572), `.collapse-icon` (10px, line 331), label badges (10px). These are hard to read, especially on high-DPI displays where they render physically small.
- **Fix**: Minimum font size should be 11px for any readable text. Increase `.draft-badge` and `.dep-overflow` to 10-11px. If space is a concern, abbreviate text instead of shrinking font.
- **File**: `src/webview/styles.css:572, 806, 331, 415, 541, 560, 581`

### P2-3: Milestone grouped kanban has same column width issues, compounded
- **Views**: Kanban (milestone grouped)
- **Widths**: 300-400px
- **Problem**: The milestone-grouped view adds milestone section headers, progress bars, and then nests the same kanban columns inside each milestone. At 300px, only 1.5 columns visible per milestone section, making the grouping feature nearly unusable.
- **Fix**: In milestone mode at narrow widths, consider showing a summary row per milestone instead of full nested kanban columns. Or collapse the nested columns to single-column vertical layout below a threshold.
- **File**: `src/webview/styles.css:253-268`

### P2-4: "No Backlog Found" empty state icon is misaligned
- **Views**: No backlog error state
- **Widths**: All
- **Problem**: The document icon sits at the top-left of its container, not centered with the text below. The vertical layout has too much top padding and the icon isn't horizontally centered with the message.
- **Fix**: Center the icon. Add `display: flex; flex-direction: column; align-items: center;` to the empty state container, and ensure the SVG icon is centered.
- **File**: `src/webview/styles.css:766-783`

### P2-5: Inconsistent badge styling across views
- **Views**: All
- **Problem**: Priority badges use different colored backgrounds (red/yellow/green), status badges use yet another style (blue/green pills), label badges use gray backgrounds, and the DRAFT badge uses a different size (9px). Decision status badges ("Accepted", "Proposed") use inline plain text. There's no unified badge system.
- **Fix**: Create a consistent badge design system with: (1) a shared base badge class, (2) semantic color variants (status, priority, label, type), (3) consistent sizing (min 10px, padding 2px 6px). Apply this consistently across all views.
- **File**: Various badge classes in `src/webview/styles.css`

---

## P3 — Low (Nice-to-have refinements)

### P3-1: Docs and Decisions views look good at all widths
- **Views**: Docs tab, Decisions tab
- **Widths**: All
- **Problem**: These are among the cleanest views. List-based layouts with type badges and dates. The only minor issue is that at 300px, the tab bar clips the last tab or two.
- **Fix**: No changes needed beyond the tab bar fix (P0-2).

### P3-2: Dashboard adapts well with grid layout
- **Views**: Dashboard
- **Widths**: 300-500px
- **Problem**: The `repeat(auto-fit, minmax(100px, 1fr))` grid works well — stat cards flow from 4-across to 2-across at narrow widths. The milestone progress section also adapts well.
- **Fix**: Minor: The "25%" completion text in the Total card could be moved below the number rather than inline, to avoid crowding at narrow widths.

### P3-3: Task detail meta grid is responsive but could be more compact
- **Views**: Task detail
- **Widths**: 400-500px
- **Problem**: The meta grid (labels, assignees, milestone, blocked by, blocks) uses `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` (line 968). At 500px this gives a 2-column layout; at 400px it goes single-column, creating a very long scrollable page.
- **Fix**: Reduce `minmax(200px, 1fr)` to `minmax(150px, 1fr)` to maintain 2-column layout at 400px.
- **File**: `src/webview/styles.css:968`

### P3-4: Action buttons at bottom of task detail could use sticky positioning
- **Views**: Task detail
- **Widths**: All
- **Problem**: "Open Raw Markdown", "Archive Task", and "Delete" buttons are at the very bottom, requiring scroll to reach on long tasks.
- **Fix**: Consider `position: sticky; bottom: 0` for the action bar so it's always accessible.

---

## Summary Priority Matrix

| Priority | Count | Impact |
|----------|-------|--------|
| P0 Critical | 3 | Kanban columns, tab bar, list view all broken at narrow widths |
| P1 High | 5 | Title sizing, padding waste, collapsed column bug, content detail styling |
| P2 Medium | 5 | Dashboard sizing, tiny fonts, milestone mode, empty state, badge consistency |
| P3 Low | 4 | Minor refinements, mostly already-working views |

### Top 3 Recommended Actions:
1. **Fix kanban column widths** (P0-1) — Most impactful single change. Reduce min-width or add responsive stacking.
2. **Fix tab bar overflow** (P0-2) — Affects ALL views. Icon-only mode at narrow widths is the cleanest solution.
3. **Reduce task detail title size** (P1-1) + padding (P1-2) — Quick CSS changes with big visual improvement.
<!-- SECTION:NOTES:END -->

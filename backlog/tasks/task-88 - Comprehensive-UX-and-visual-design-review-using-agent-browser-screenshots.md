---
id: TASK-88
title: Comprehensive UX and visual design review using agent-browser screenshots
status: To Do
assignee: []
created_date: '2026-02-06 02:48'
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
- [ ] #1 Screenshots collected for all views at narrow/medium/wide sidebar widths
- [ ] #2 Design critique covers layout, spacing, visual hierarchy, and information density
- [ ] #3 Prioritized improvement list with specific actionable recommendations
- [ ] #4 Improvements respect VS Code theme variable constraints
<!-- AC:END -->

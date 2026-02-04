---
id: TASK-46
title: Refactor webviews to use external CSS file
status: In Progress
assignee: []
created_date: '2026-02-02 23:49'
updated_date: '2026-02-04 19:33'
labels:
  - 'epic:polish'
  - tech-debt
milestone: MVP Release
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The webview providers (Kanban, TaskList, TaskDetail) currently have inline styles. Refactor to use the compiled Tailwind CSS from dist/webview/styles.css for consistency and easier maintenance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Webviews load external styles.css
- [ ] #2 Remove inline styles from providers
- [ ] #3 Tailwind classes used in HTML
- [ ] #4 All views still render correctly
<!-- AC:END -->

---
id: TASK-46
title: Refactor webviews to use external CSS file
status: Done
assignee: []
created_date: '2026-02-02 23:49'
updated_date: '2026-02-04 19:39'
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
- [x] #1 Webviews load external styles.css
- [x] #2 Remove inline styles from providers
- [x] #3 Tailwind classes used in HTML
- [x] #4 All views still render correctly
<!-- AC:END -->

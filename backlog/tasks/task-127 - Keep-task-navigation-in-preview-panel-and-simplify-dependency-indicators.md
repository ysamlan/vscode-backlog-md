---
id: TASK-127
title: Keep task navigation in preview panel and simplify dependency indicators
status: Done
assignee: []
created_date: '2026-02-09 19:22'
updated_date: '2026-02-09 19:28'
labels:
  - ui
  - navigation
  - dependencies
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update tasks/preview/detail navigation so Kanban/List/preview navigation stays in the task preview panel unless user explicitly clicks Edit, simplify dependency display in Kanban/List to blocked icon with hover details, and align panel terminology/metadata with full detail behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Click and keyboard navigation from Kanban/List open selected tasks in the preview subpanel instead of full detail.
- [x] #2 Compact preview panel links for related tasks navigate in-place in preview; Edit still opens full detail.
- [x] #3 Kanban card and list row no longer render dependency lists/counts and instead show a blocked icon only when actively blocked.
- [x] #4 Blocked status treats unresolved dependency IDs as blockers and excludes dependencies resolved in completed/archived.
- [x] #5 Task detail panel receives and renders missing dependency warning indicators in Blocked By.
- [x] #6 Automated tests updated for routing changes and blocked indicator behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in-panel navigation by routing Kanban/List keyboard and compact preview related-task clicks to selectTask instead of openTask. Added TaskPreviewViewProvider selectTask message handling. Introduced blockingDependencyIds in TasksViewProvider using done-status aware evaluation, counting missing IDs as blockers and excluding completed/archived dependencies. Replaced Kanban/List dependency displays with blocked warning icon + tooltip listing blocker IDs. Added missingDependencyIds to TaskDetailProvider payload and rendered warning icon markers in task-detail MetaSection blocked-by links. Updated compact panel copy to 'Blocked by' and 'Blocks' with link-style navigation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Navigation from Kanban/List/compact preview now stays inside the preview subpanel; full detail opens only via explicit Edit (or when already in full detail). Dependency density was reduced in list/card UIs to a blocked warning icon driven by active blockers, and task detail now flags missing dependency links with warning indicators. Tests were updated to cover message routing changes, blocker computation behavior, and missing dependency UI markers.
<!-- SECTION:FINAL_SUMMARY:END -->

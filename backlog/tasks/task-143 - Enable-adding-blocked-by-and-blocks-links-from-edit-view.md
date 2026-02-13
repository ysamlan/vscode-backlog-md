---
id: TASK-143
title: Enable adding blocked-by and blocks links from edit view
status: Done
assignee: []
created_date: '2026-02-13 15:45'
updated_date: '2026-02-13 18:00'
labels:
  - task-detail
  - dependencies
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to add new dependency links directly in the task edit view by linking to existing tasks, instead of only seeing already-linked tasks. This should make dependency management practical during task editing and reduce context switching.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In task edit view, users can add one or more existing tasks to `blocked-by` links without manually editing markdown.
- [x] #2 In task edit view, users can add one or more existing tasks to `blocks` links without manually editing markdown.
- [x] #3 Added links are persisted and visible after save/reload in both edit and read-only task detail states.
- [x] #4 The add-link interaction prevents duplicate links to the same task in the same relationship type.
- [x] #5 Tests cover adding blocked-by/blocks links and persistence behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Follow-up polish requested: remove `None` placeholder in editable dependency sections and replace native datalist popup with themed, scrollable suggestion menu capped to 10 visible items.

Additional follow-up: suggestion menu should overlay (popup behavior) without reflowing sections below.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented editable dependency linking in task detail meta panel. Users can now add blocked-by links on the current task and add blocks links by updating the selected target task's dependencies. Added UI duplicate prevention and read-only disabling, provider-side validation and persistence for both link types, and refreshed task detail payload with linkable task candidates. Added/updated unit and Playwright tests covering add-link message flow, duplicate prevention, read-only behavior, and provider persistence paths.

Follow-up polish completed: removed empty `None` placeholders for editable blocked-by/blocks sections, replaced native datalist popup with a themed custom suggestion menu for dark-theme consistency, and capped visible suggestions to 10 with scrollable overflow. Added Playwright coverage for these UI behaviors.

Final UI tweak: converted dependency suggestion dropdowns to true overlay popups (absolute-positioned within a relative picker container) so opening suggestions no longer reflows or shifts content below.
<!-- SECTION:FINAL_SUMMARY:END -->

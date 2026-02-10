---
id: TASK-56
title: Read tasks from multiple folders
status: Done
assignee: []
created_date: '2026-02-03 03:14'
updated_date: '2026-02-05 21:04'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add folder property to Task interface. Add getCompletedTasks(), getDraftTasks() methods. Update getTasks() to optionally include other folders.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task interface has folder property
- [ ] #2 getCompletedTasks() returns tasks from completed/
- [ ] #3 getDraftTasks() returns tasks from drafts/
- [ ] #4 getTasks() can include other folders
<!-- AC:END -->

---
id: TASK-115.2
title: Module boundary inventory and adopt-adapt-retain map
status: To Do
assignee: []
created_date: '2026-02-09 03:29'
labels:
  - architecture
  - upstream
  - tech-debt
dependencies:
  - TASK-115.1
references:
  - /workspace/src/core
  - /workspace/src/providers
  - /workspace/tmp/mrlesk-Backlog.md-src/src/markdown
  - /workspace/tmp/mrlesk-Backlog.md-src/src/utils/prefix-config.ts
  - /workspace/tmp/mrlesk-Backlog.md-src/src/core/reorder.ts
parent_task_id: TASK-115
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Map local extension modules to upstream equivalents and classify each integration target as adopt, adapt, or retain-local. Define adapter boundaries so migration can proceed incrementally without destabilizing providers/webviews.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Catalog core local modules and corresponding upstream candidates (parser/serializer, ID/prefix, reorder/ordinal, cross-branch utilities).
- [ ] #2 Assign adopt/adapt/retain-local classification with rationale for each mapping.
- [ ] #3 Define explicit adapter interfaces and ownership boundaries between extension-specific logic and upstream-derived logic.
- [ ] #4 Document an initial migration order that minimizes risk and review complexity.
<!-- AC:END -->

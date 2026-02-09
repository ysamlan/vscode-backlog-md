---
id: TASK-115
title: Evaluate integrating upstream Backlog.md as submodule or package dependency
status: To Do
assignee: []
created_date: '2026-02-08 22:24'
labels:
  - architecture
  - upstream
  - dependency-management
  - tech-debt
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate replacing or reducing shadow implementations by directly consuming upstream Backlog.md code, either via git submodule or npm package dependency. Produce a concrete recommendation and migration plan focused on maintainability, update velocity, and compatibility with the VS Code extension architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Compare integration strategies: git submodule, npm/package dependency, and selective code sync.
- [ ] #2 Document tradeoffs for each: upgrade path, build tooling impact, API stability, licensing, and test surface.
- [ ] #3 Identify which current local modules are best candidates for upstream reuse first.
- [ ] #4 Provide a phased migration plan with rollback strategy.
- [ ] #5 Create follow-up implementation tasks for the chosen strategy.
<!-- AC:END -->

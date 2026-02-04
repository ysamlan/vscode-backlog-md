---
id: TASK-75
title: 'Research: Port cross-branch logic from upstream Backlog.md'
status: To Do
assignee: []
created_date: '2026-02-04 18:47'
labels:
  - research
  - architecture
  - git
dependencies:
  - TASK-73
references:
  - >-
    https://github.com/MrLesk/Backlog.md/blob/main/src/core/cross-branch-tasks.ts
  - 'https://github.com/MrLesk/Backlog.md/blob/main/src/git/operations.ts'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Currently we rely on the `backlog` CLI binary for cross-branch task functionality. As an alternative, we could port the relevant git/branch-handling logic directly from the upstream Backlog.md repository.

## Pros of Porting
- No external binary dependency for users
- Full control over behavior and customization
- Better integration with VS Code's git APIs
- Potentially simpler installation/setup for users

## Cons of Porting
- More code to maintain
- Need to keep in sync with upstream changes
- Increased complexity in extension codebase

## Research Questions
1. Can we isolate the cross-branch logic into a submodule or separate package?
2. What's the feasibility of using VS Code's built-in git extension APIs instead of spawning git commands?
3. Should we use `simple-git` or `isomorphic-git` as a middle ground?
4. How much of the upstream code would need to be ported?

## Upstream Reference Files
- `src/core/cross-branch-tasks.ts` - Main cross-branch state resolution logic
- `src/git/operations.ts` - Git operation layer
- `src/utils/task-sorting.ts` - Task sorting utilities

## Potential Approaches
1. **Git Submodule**: Add upstream as submodule, import TypeScript directly
2. **Vendored Copy**: Copy relevant files into `src/vendor/backlog-md/`
3. **NPM Package**: If upstream publishes core logic as package, use that
4. **Rewrite**: Implement from scratch using VS Code git APIs

## Next Steps
- Review upstream license compatibility
- Evaluate VS Code git extension APIs for branch operations
- Prototype minimal cross-branch detection with simple-git
- Estimate effort for each approach
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document pros/cons of each approach (submodule, vendor, npm, rewrite)
- [ ] #2 Evaluate VS Code git extension APIs for branch operations
- [ ] #3 Prototype minimal cross-branch detection
- [ ] #4 Make recommendation for best approach
- [ ] #5 Estimate effort for recommended approach
<!-- AC:END -->

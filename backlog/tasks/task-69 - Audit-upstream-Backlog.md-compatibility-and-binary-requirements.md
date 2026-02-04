---
id: TASK-69
title: Audit upstream Backlog.md compatibility and binary requirements
status: Done
assignee: []
created_date: '2026-02-04 02:57'
updated_date: '2026-02-04 18:47'
labels:
  - tech-debt
  - compatibility
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit the MrLesk/Backlog.md source code to ensure this extension supports all available features and to determine which features require the backlog CLI binary vs what we can implement natively.

## Scope

### 1. Frontmatter Fields
- Task frontmatter schema (all fields, types, optional/required)
- Compare our Task type, parser, and writer against upstream definitions
- Identify any fields we're missing or handling differently

### 2. Config File Options
- All `backlog/config.yml` settings
- Which settings affect extension behavior
- Which settings require binary for full support

### 3. Binary-Dependent Features
Determine which upstream features **require** the backlog CLI:
- Cross-branch task state checking (`checkActiveBranches`)
- Remote operations (`remoteOperations`)
- Task resolution strategies
- ID generation across branches
- Any others?

### 4. Native-Implementable Features
Identify features we can implement without the binary:
- Local file parsing/writing
- Basic config reading
- Sorting/ordering logic
- etc.

## Outcome

Document a clear matrix of:
| Feature | Native | Needs Binary | Notes |
|---------|--------|--------------|-------|
| ... | ... | ... | ... |

This informs:
- When to show "backlog CLI not found" warnings (only for features that need it)
- What to tell users who don't have the CLI installed
- Future implementation priorities

## Reference
- Upstream repo: https://github.com/MrLesk/Backlog.md
- Key dirs: `src/core/`, `src/git/`, `src/types/`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Document all upstream frontmatter fields and compare to our Task type
- [x] #2 Document all upstream config.yml options
- [x] #3 Identify which features require backlog CLI binary
- [x] #4 Identify which features can be implemented natively
- [x] #5 Create feature/binary requirements matrix
- [x] #6 Update relevant tasks (e.g., TASK-73) with findings
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Audit Complete

### Frontmatter Fields Comparison

| Field | Our Extension | Upstream | Status |
|-------|--------------|----------|--------|
| `id` | string | string | Match |
| `title` | string | string | Match |
| `status` | TaskStatus | string | Match (we use union type) |
| `priority` | high/medium/low | same | Match |
| `description` | string | string | Match |
| `labels` | string[] | string[] | Match |
| `assignee` | string[] | string[] | Match |
| `milestone` | string | string | Match |
| `dependencies` | string[] | string[] | Match |
| `references` | string[] | string[] | Match |
| `documentation` | string[] | string[] | Match |
| `parentTaskId` | string | string | Match |
| `ordinal` | number | number | Match |
| `filePath` | string | string | Match |
| `acceptanceCriteria` | ChecklistItem[] | AcceptanceCriterion[] | Match |
| `definitionOfDone` | ChecklistItem[] | AcceptanceCriterion[] | Match |
| `implementationNotes` | string | string | Match |
| `finalSummary` | string | string | Match |
| `plan` | string | implementationPlan | Match (same concept) |
| `type` | string | - | We have, not in upstream |
| `createdAt`/`updatedAt` | string | createdDate/updatedDate | Name difference |
| `reporter` | - | string | **Added** |
| `source` | - | local/remote/completed/local-branch | **Added** |
| `branch` | - | string | **Added** |
| `lastModified` | - | Date | **Added** |
| `subtasks` | - | string[] | **Added** |

### Config Options Comparison

All cross-branch config options now supported:
- `check_active_branches` - Match
- `remote_operations` - Match  
- `active_branch_days` - Match
- `task_resolution_strategy` - **Added** (most_recent/most_progressed)
- `zero_padded_ids` - **Added**

### Feature/Binary Requirements Matrix

| Feature | Native | Needs Binary |
|---------|--------|--------------|
| Parse task files | ✅ | |
| Write task files | ✅ | |
| Read config.yml | ✅ | |
| Custom statuses | ✅ | |
| Labels/milestones | ✅ | |
| Ordinal sorting | ✅ | |
| Task filtering | ✅ | |
| Acceptance criteria | ✅ | |
| Definition of Done | ✅ | |
| Cross-branch task state | | ✅ |
| Remote branch scanning | | ✅ |
| Task conflict resolution | | ✅ |
| Branch-aware ID generation | | ✅ |

### Files Modified

- `src/core/types.ts` - Added TaskSource, TaskResolutionStrategy, cross-branch Task fields, DataSourceMode
- `src/core/BacklogCli.ts` - New module for CLI detection and invocation
- `src/extension.ts` - Added cross-branch config checking and status bar
- `src/providers/TasksViewProvider.ts` - Added setDataSourceMode method
- `src/test/unit/BacklogCli.test.ts` - New test file
- `src/test/unit/BacklogParser.test.ts` - Added cross-branch config tests
<!-- SECTION:NOTES:END -->

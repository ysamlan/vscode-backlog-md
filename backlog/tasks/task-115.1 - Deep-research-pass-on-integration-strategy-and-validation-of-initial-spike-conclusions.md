---
id: TASK-115.1
title: >-
  Deep research pass on integration strategy and validation of initial spike
  conclusions
status: Done
assignee: []
created_date: '2026-02-09 03:29'
updated_date: '2026-02-09 13:33'
labels:
  - architecture
  - upstream
  - dependency-management
dependencies: []
references:
  - /workspace/tmp/mrlesk-Backlog.md-src
  - /workspace/src/core/BacklogParser.ts
  - /workspace/src/core/BacklogWriter.ts
  - /workspace/src/core/CrossBranchTaskLoader.ts
parent_task_id: TASK-115
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The initial TASK-115 spike was performed by a less capable model and produced a shallow-but-reasonable recommendation (selective upstream adoption with adapter boundaries). This task is a deeper research pass to validate or challenge those conclusions before committing to implementation work.

Specifically:
- Re-examine the upstream source at /workspace/tmp/mrlesk-Backlog.md-src/ with fresh eyes. Is the Bun-runtime coupling as pervasive as claimed, or are the key modules (parser, serializer, ID/prefix, reorder) actually runtime-agnostic?
- Evaluate whether the "selective vendoring with adapters" recommendation is truly the best path, or whether a simpler approach (e.g., direct import of specific files, thin compatibility shim, or even just copying+adapting a few functions) would be more pragmatic for the actual integration surface (~3-4 modules).
- Challenge whether the phased migration with dual-run parity harness is warranted for this codebase size, or whether a simpler "port and test" approach would be faster and equally safe.
- Assess the upstream project's trajectory — is it stabilizing toward a library API, or is it likely to remain CLI-first? This affects whether investing in adapter boundaries pays off.

The output should be a clear go/no-go on the current plan, with any recommended changes to the follow-on subtasks (115.2-115.4). If the initial approach is wrong, this task should propose the corrected path and update or replace downstream subtasks accordingly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Perform hands-on source review of upstream parser, serializer, ID/prefix, and reorder modules to assess actual Node/VS Code runtime compatibility.
- [x] #2 Validate or refute the initial spike's selective-vendoring recommendation with concrete evidence.
- [x] #3 Evaluate whether the dual-run parity harness approach is proportionate to the risk, or whether a simpler migration path is sufficient.
- [x] #4 Produce a clear recommendation: proceed with current plan, modify it, or take a different approach entirely. Update downstream subtasks if needed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ✅ Document Bun-coupling claim is false (0 Bun APIs in candidate modules)
2. ✅ Side-by-side comparison of all 5 concern areas
3. ✅ Function gap analysis (what we'd lose vs gain)
4. ✅ Produce recommendation: port tests + fix deltas
5. ✅ Update TASK-115.2 through 115.4 descriptions to match revised approach
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Compatibility Audit Results

### 1. Bun-coupling claim is FALSE

Zero Bun-specific APIs in any candidate upstream module:

| Module | Path | Dependencies | Bun APIs |
|--------|------|-------------|----------|
| parser.ts | src/markdown/parser.ts (245 LOC) | `gray-matter`, local types/structured-sections | **None** |
| serializer.ts | src/markdown/serializer.ts (178 LOC) | `gray-matter`, local types/assignee/structured-sections | **None** |
| structured-sections.ts | src/markdown/structured-sections.ts (712 LOC) | local types, section-titles | **None** |
| prefix-config.ts | src/utils/prefix-config.ts (396 LOC) | local types only | **None** |
| reorder.ts | src/core/reorder.ts (97 LOC) | local types only | **None** |
| section-titles.ts | src/markdown/section-titles.ts (34 LOC) | none | **None** |
| assignee.ts | src/utils/assignee.ts (8 LOC) | none | **None** |

Bun coupling exists only in upstream infrastructure: test runner (`bun:test`), file I/O helpers (`Bun.file`), web server (`Bun.serve`), CLI entry point. The library modules are pure TypeScript.

### 2. Side-by-side comparison

#### Frontmatter parsing

| Concern | Local (BacklogParser) | Upstream (parser.ts) |
|---------|----------------------|---------------------|
| YAML library | `js-yaml` direct | `gray-matter` (wraps `js-yaml`) |
| @-prefix quoting | `preprocessFrontmatter()` — identical logic | `preprocessFrontmatter()` — same algorithm |
| Date normalization | `normalizeDateValue()` — truncates to `YYYY-MM-DD` only, loses time | `normalizeDate()` — preserves `HH:mm` time, handles legacy formats (DD-MM-YY, DD/MM/YY, DD.MM.YY) |
| Date field names | `createdAt` / `updatedAt` on Task type | `createdDate` / `updatedDate` on Task type |
| Priority validation | Fuzzy: `includes('high')` etc. | Strict: lowercase comparison against `['high', 'medium', 'low']` |
| Status normalization | Extensive: strips emoji prefixes, fuzzy matching | None: passes through as-is |
| Raw content | Not stored on Task | Stored as `rawContent` |
| ID extraction | From filename, case-insensitive | From frontmatter `id` field |
| Section title tolerance | `includes()` matching on lowercase | Exact title matching via regex |

**Delta: Date normalization is a real compatibility issue.** Local code drops `HH:mm` time components. Upstream preserves them. Local also doesn't handle legacy date formats (DD-MM-YY etc.).

#### Body sections / structured content

| Concern | Local (BacklogParser) | Upstream (structured-sections.ts) |
|---------|----------------------|----------------------------------|
| Section markers | Recognizes `<!-- SECTION:*:BEGIN/END -->` | Same markers, full round-trip support |
| Description extraction | In-parser, line-by-line with `inDescriptionBlock` flag | Via `extractStructuredSection()`, regex-based with range exclusion |
| Checklist format | `{ id: number, checked: boolean, text: string }` | `{ index: number, checked: boolean, text: string }` |
| Checklist parsing | Simple regex: `- [(x| )] #N text` | Same pattern, plus legacy format without `#N` |
| AC/DoD markers | Recognized: `<!-- AC:BEGIN -->`, `<!-- DOD:BEGIN -->` | Same markers, plus rich mutation APIs |
| Section update | Only description via marker replacement | Full structured section update with insertion ordering |
| Legacy format support | None for checklists | Parses old format without `#N` numbering |
| CRLF handling | Not handled | Full CRLF detection + restoration |

**Delta: Checklist items use `id` vs `index` naming.** Both are 1-based integers. Legacy format parsing is an upstream feature we don't have.

#### Serialization

| Concern | Local (BacklogWriter) | Upstream (serializer.ts) |
|---------|----------------------|-------------------------|
| YAML generation | Manual field-by-field with `formatYamlField()` | `gray-matter.stringify()` |
| Field order | Manual: id, title, status, priority, milestone, labels, assignee, reporter, created, created_date, updated_date, dependencies, references, documentation, parent_task_id, subtasks, ordinal, type, onStatusChange | Via object construction order: id, title, status, assignee, reporter, created_date, updated_date, labels, milestone, dependencies, references, documentation, parent_task_id, subtasks, priority, ordinal, onStatusChange |
| Array format | Inline `[item1, item2]` | `gray-matter` default (block-style YAML lists) |
| Empty arrays | `[]` | Not emitted (gray-matter omits empty arrays by default) |
| Date format | Always `YYYY-MM-DD` (truncates time) | Preserves `HH:mm` if present |
| Optional field omission | Removes `undefined` values | Uses spread conditionals `...(field && { field })` |
| Body reconstruction | Manual frontmatter + body concatenation | `gray-matter.stringify(body, frontmatter)` |

**Delta: Field order differs.** Local puts priority/milestone early; upstream puts assignee early, priority late. Also, array formatting differs (local inline, upstream block-style via gray-matter). Both are valid YAML but produce different output for the same data.

#### ID/prefix handling

| Concern | Local (BacklogWriter/Parser) | Upstream (prefix-config.ts) |
|---------|----------------------------|---------------------------|
| ID normalization | `toUpperCase()` on parsed ID | `normalizeId()` — strips prefix, re-adds uppercase |
| Zero-padding | `padStart(zeroPadding, '0')` in `createTask` | `generateNextId(existingIds, prefix, zeroPadding)` |
| Subtask dot-notation | `parentNum.nextSubId` in `createSubtask` | `generateNextSubtaskId()` with same pattern |
| Prefix extraction | Regex `^([a-zA-Z]+-\d+)` from filename | `extractAnyPrefix()`, `hasPrefix()` utilities |
| ID comparison | Direct string comparison | `idsEqual()` with normalization |

**Delta: Minimal.** Both handle the same cases. Upstream has richer utility API (extractAnyPrefix, hasAnyPrefix, stripAnyPrefix) but the core logic is equivalent.

#### Ordinal/reorder

| Concern | Local (ordinalUtils.ts) | Upstream (reorder.ts) |
|---------|------------------------|---------------------|
| Default step | 1000 | 1000 |
| Core operation | `calculateOrdinalsForDrop()` — calculates ordinals for drag-and-drop within a column | `calculateNewOrdinal()` — calculates single ordinal between two neighbors |
| Rebalance detection | Implicit: adjusts step when ceiling is tight | Explicit: returns `requiresRebalance: boolean` |
| Conflict resolution | `resolveOrdinalConflicts` not present | `resolveOrdinalConflicts()` — sequential reassignment |
| Sort function | `sortCardsByOrdinal()`, `compareByOrdinal()` | Not provided (presumably in UI layer) |

**Delta: Different abstraction level.** Local is UI-centric (drag-and-drop), upstream is data-centric (between-two-items). `calculateOrdinalsForDrop` is extension-specific and would stay regardless. Upstream's `resolveOrdinalConflicts` is a feature we don't have but could be useful.

### 3. Function gap analysis

#### Things local code does that upstream doesn't:
- **mtime-based task caching** — performance optimization, extension-specific
- **Cross-branch task loading** — Git operations, extension-specific
- **MD5 conflict detection** — FileConflictError, extension-specific
- **VS Code config normalization** — camelCase → snake_case, extension-specific
- **Status normalization** — emoji prefix stripping, fuzzy matching
- **Sort functions** — `compareByOrdinal`, `sortCardsByOrdinal`
- **Complete/archive/promote/demote operations** — file movement, extension-specific
- **Document and decision parsing** — local has this in BacklogParser too

All of these are extension-specific features that would stay regardless of adoption strategy.

#### Things upstream does that local doesn't:
- **Date time preservation** — `HH:mm` not truncated
- **Legacy date format conversion** — DD-MM-YY, DD/MM/YY, DD.MM.YY → YYYY-MM-DD
- **CRLF handling** — detection and restoration in structured sections
- **Legacy checklist parsing** — items without `#N` numbering
- **Richer checklist mutation API** — add/remove/check by index, migration
- **Section title variants** — "Notes" recognized as "Implementation Notes"
- **Structured section update** — proper insertion ordering and range exclusion
- **resolveOrdinalConflicts()** — sequential ordinal reassignment
- **Richer ID utilities** — extractAnyPrefix, hasAnyPrefix, idsEqual

Of these, the most valuable for compatibility are:
1. **Date time preservation** — real data loss in current implementation
2. **Legacy date format conversion** — needed if parsing old files
3. **CRLF handling** — Windows compatibility
4. **Legacy checklist parsing** — backward compat with older task files

### 4. Recommendation

**Approach: Port upstream tests as compatibility suite, fix behavioral deltas, don't replace code.**

Rationale:
- Local code is 1,700 LOC of working, well-tested parser/writer that handles extension-specific concerns (caching, cross-branch, conflict detection, file operations) that upstream doesn't.
- Upstream's library modules are clean but serve a different architecture (CLI with full raw content round-tripping via gray-matter).
- Replacing local code with upstream would require:
  - Adding `gray-matter` dependency (currently not used)
  - Rewriting all consumers to use upstream's type shapes (createdDate→createdAt, acceptanceCriteriaItems→acceptanceCriteria, etc.)
  - Keeping all extension-specific code anyway
  - Converting gray-matter's block-style YAML output to match current inline format
  - The risk/effort ratio is unfavorable.

Instead, port upstream test cases to verify format-level compatibility, and fix the specific deltas:
1. **Fix date normalization** to preserve HH:mm time (TASK-115.3)
2. **Add legacy date format handling** (TASK-115.3)
3. **Verify checklist compatibility** — id vs index is naming only, behavior matches (TASK-115.3)
4. **Document serialization field order difference** as intentional — both produce valid YAML
5. **Add CRLF handling** where missing (TASK-115.3, low priority)
6. **Port resolveOrdinalConflicts** as a useful upstream feature (TASK-115.4)

### 5. Upstream test inventory for porting

| Test file | LOC | Port scope |
|-----------|-----|-----------|
| markdown.test.ts | 605 | Parse/serialize roundtrip — high value |
| acceptance-criteria.test.ts | 653 | Checklist parsing/mutation — high value |
| prefix-config.test.ts | 367 | ID normalization — medium value |
| reorder-utils.test.ts | 200 | Ordinal calculations — medium value |
| **Total** | **1,825** | ~80-120 ported test cases expected |
<!-- SECTION:NOTES:END -->

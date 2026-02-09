---
id: TASK-115
title: Evaluate integrating upstream Backlog.md as submodule or package dependency
status: Done
assignee:
  - '@codex'
created_date: '2026-02-08 22:24'
updated_date: '2026-02-09 03:30'
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
- [x] #1 Compare integration strategies: git submodule, npm/package dependency, and selective code sync.
- [x] #2 Document tradeoffs for each: upgrade path, build tooling impact, API stability, licensing, and test surface.
- [x] #3 Identify which current local modules are best candidates for upstream reuse first.
- [x] #4 Provide a phased migration plan with rollback strategy.
- [x] #5 Create follow-up implementation tasks for the chosen strategy.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Perform repository and upstream source audit focused on integration mechanics (npm dependency, git submodule, git subtree, selective vendoring).
2. Build a decision matrix weighted toward developer ergonomics while preserving Node/VS Code runtime safety.
3. Identify local modules for adopt/adapt/retain classification and define adapter boundaries for incremental migration.
4. Define a phased rollout with dual-run parity gates, feature-flagged cutover, and explicit rollback triggers.
5. Decompose implementation into parent-owned subtasks with sequencing and dependencies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-115 execution as a research + decomposition deliverable.

Completed non-mutating spike against local upstream checkout at /workspace/tmp/mrlesk-Backlog.md-src and local extension architecture.

Confirmed upstream package is CLI-first and upstream source relies heavily on Bun runtime APIs, which materially affects direct runtime import options for a VS Code extension Node host.

Validated current baseline: bun run test && bun run lint && bun run typecheck passes (lint has existing warnings only).

Integration strategy comparison completed across npm/package dependency, git submodule, git subtree, and selective code sync/vendoring.

Tradeoff summary: npm dependency currently exposes CLI-first package shape and does not provide a Node-host-safe, stable library API boundary for extension runtime use; direct dependency would require substantial adapter/shim work and carries upgrade fragility.

Tradeoff summary: git submodule preserves source fidelity but introduces high contributor friction (recursive clone/update workflow, branch coordination complexity), and does not solve Bun-runtime coupling by itself.

Tradeoff summary: git subtree improves ergonomics versus submodule for most contributors and supports periodic upstream sync commits, but still requires local adaptation boundaries for Node-host compatibility.

Tradeoff summary: selective code sync/vendoring (preferably with subtree-assisted provenance) provides best near-term developer ergonomics and controlled runtime safety at cost of ongoing divergence management.

Recommendation: use a selective upstream adoption strategy with explicit adapter boundaries and parity gates, optionally sourcing updates via subtree pulls for traceability.

Module candidate classification completed: adopt/adapt first for markdown parse/serialize semantics, ID/prefix utilities, and reorder/ordinal utilities; retain extension-native providers/webview messaging and VS Code-specific write/conflict UX.

Phased migration plan defined: Phase 1 strategy+inventory, Phase 2 parity harness, Phase 3 parser/serializer pilot, Phase 4 ID/ordinal pilot, Phase 5 feature-flagged rollout and telemetry, Phase 6 final recommendation and next-wave planning.

Rollback strategy defined: keep legacy path as default, gate cutover by dual-run parity criteria, and revert per-module adapter toggle on any regression in parser/writer correctness or cross-branch editability semantics.

Created follow-up subtasks: TASK-115.1 through TASK-115.7 with dependency chain and acceptance criteria for incremental execution.

Validation recorded for parent task finalization: bun run test (pass), bun run lint (pass with 3 existing no-explicit-any warnings in src/test/unit/BacklogCli.test.ts), bun run typecheck (pass).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed TASK-115 as a research+planning spike and produced a decision-complete migration workstream.

What changed:
- Performed architecture review of local extension core modules and upstream Backlog.md source layout.
- Compared four integration strategies (npm/package dependency, git submodule, git subtree, selective sync/vendoring) against upgrade mechanics, build/runtime compatibility, API stability, licensing posture, and test-surface impact.
- Identified Bun runtime coupling in upstream source as the primary constraint for direct runtime reuse inside VS Code extension Node host.
- Recommended selective upstream adoption via adapter boundaries with parity-gated migration, with optional subtree-based provenance for synchronized imports.
- Defined candidate module migration order and explicit retain-local areas where extension-native behavior is preferable.
- Decomposed work into executable subtasks TASK-115.1..TASK-115.7 with dependencies and test expectations.

Testing:
- Ran bun run test (pass).
- Ran bun run lint (pass with existing warnings only).
- Ran bun run typecheck (pass).

Risk and rollback:
- Keep legacy code path available during migration.
- Use dual-run parity gates before cutover per module.
- Roll back module-by-module immediately on behavioral regressions.
<!-- SECTION:FINAL_SUMMARY:END -->

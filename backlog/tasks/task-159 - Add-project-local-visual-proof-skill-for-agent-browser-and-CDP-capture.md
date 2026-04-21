---
id: TASK-159
title: Add project-local visual-proof skill for agent-browser and CDP capture
status: Done
assignee: []
created_date: '2026-04-20 13:15'
updated_date: '2026-04-20 15:23'
labels:
  - tooling
  - docs
  - claude-skills
dependencies: []
references:
  - 'https://simonwillison.net/2026/Feb/10/showboat-and-rodney/'
  - 'https://github.com/ysamlan/skills/tree/main/visual-proof-setup'
  - 'https://github.com/simonw/showboat'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up a project-tailored `visual-proof` skill at `.claude/skills/visual-proof/` that lets future Claude Code sessions produce verifiable visual/behavioral proof-of-work documents for PRs and review. Follows the pattern from `https://github.com/ysamlan/skills/tree/main/visual-proof-setup` and the "showboat and rodney" concept (`https://simonwillison.net/2026/Feb/10/showboat-and-rodney/`).

## What we're building

A project-local skill under `.claude/skills/visual-proof/` that combines:

- **`showboat` via `uvx`** to assemble screenshots, narrative notes, and verifiable command output into a proof-of-work markdown doc (never edit the .md directly — use CLI commands so `showboat verify` stays meaningful).
- **Two capture methods, each documented with when to use it:**
  1. **agent-browser + Vite fixtures** (`bun run webview:serve`) — fast, headless, no VS Code required. Captures Svelte component visuals with mocked `vscode` API + injected `postMessage` data. Use for: component-level looks, kanban/list/dashboard layouts at different viewport sizes, theme variations (fixtures load `vscode-theme-dark-plus.css`), empty/error states.
  2. **CDP cross-view driver** (built on `src/test/cdp/lib/`) — boots real VS Code headless via xvfb, installs the extension from `dist/`, and drives a real Extension Host over CDP-over-WebSocket. Use for: end-to-end extension behavior where the fixture mocks can't follow through (e.g., "click a link → editor actually opens the target file", status writes hitting disk, cross-webview coordination).
- **A decision matrix** so callers know which method to reach for.
- **`showboat exec` examples** for verifiable file-format proof (relevant for changes like PR #15's serializer rewrite, where the "proof" is a before/after `cat backlog/tasks/task-NN.md` diff, not a screenshot).

## Scope

In scope:
- `.claude/skills/visual-proof/SKILL.md` — the project-tailored skill file
- Any helper scripts in `.claude/skills/visual-proof/scripts/` needed to launch the CDP capture session (the existing `src/test/cdp/lib/` is for tests; we may need a thin wrapper that sets up a workspace fixture, boots VS Code, hands back a driver handle, and tears down cleanly when the user is done)
- `.gitignore` entry for `tmp/visual-proof*.md`, `tmp/before/`, `tmp/after/` if not already covered by the existing `tmp/` rule
- A short note in `AGENTS.md` pointing future sessions at the skill so it's discoverable alongside the existing testing strategy

Out of scope:
- Changing the test tiers (unit / Playwright / e2e / CDP) — this skill sits above them as proof artifacts
- Replacing `agent-browser` or the CDP test lib — we build on them, not around them

## Why two methods

Fixture capture is 10× faster for component-only changes but can't prove that clicking something in the real extension has a real effect on the editor state. CDP capture is heavier but is the only way to prove end-to-end extension behavior. Having the skill document both — with clear guidance on which to reach for — means future sessions don't default to the wrong tool.

## Validation

Validate the skill by using it to produce proof-of-work docs for the open PRs we're reviewing:
- **PR #14 (workspace-relative markdown links)** — needs CDP: capture before/after screenshots of task-detail panel → click a `./CONTRIBUTING.md#L10` link → editor opens at line 10. Cover ~3–5 link types from the PR #14 test plan.
- **PR #15 (canonical serializer)** — needs `showboat exec`: capture a task file's frontmatter before and after saving a no-op edit to prove byte-for-byte canonical format.

Neither validation PR needs to be merged by this task; we just need the skill to produce useful output for each.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.claude/skills/visual-proof/SKILL.md` exists with project-tailored capture sections (not the template placeholders) and YAML frontmatter declaring when to use the skill.
- [x] #2 SKILL.md documents the agent-browser + Vite fixture capture flow with concrete commands tied to this project's fixture URLs (`/tasks.html`, `/task-detail.html`, etc.) and `postMessage` shapes (`tasksUpdated`, `statsUpdated`, `taskData`).
- [x] #3 SKILL.md documents the CDP cross-view capture flow building on `src/test/cdp/lib/`, with the boot sequence (download VS Code, launch xvfb, install extension from `dist/`, attach CDP), how to drive webview iframes, and how to capture screenshots of real VS Code state.
- [x] #4 SKILL.md contains a decision matrix mapping capture scenarios (component-only visual / end-to-end behavior / before-after file format / theme variation) to the right method.
- [x] #5 SKILL.md uses `uvx showboat` for document assembly (init, note, image, exec) and explicitly forbids editing the .md directly, so `showboat verify` remains meaningful.
- [x] #6 Output paths (`tmp/visual-proof*.md`, `tmp/screenshots/`, `tmp/before/`, `tmp/after/`) are gitignored — either under the existing `tmp/` rule or with explicit entries.
- [x] #7 `AGENTS.md` (or `CLAUDE.md`) has a short pointer to the visual-proof skill so future sessions discover it alongside the existing testing strategy section.
- [ ] #8 Skill is validated by producing a showboat proof doc for at least 3 PR #14 link-click scenarios using the CDP path.
- [x] #9 Skill is validated by producing a showboat proof doc for PR #15's before/after task-file frontmatter using `showboat exec`.
- [x] #10 `CONTRIBUTING.md` has a new "Visual proof for your PR" section suggesting contributors use the skill (or hand-taken screenshots) to produce PR demo/before-after content, with a short `uvx showboat` quickstart.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `.claude/skills/visual-proof/` with tailored SKILL.md (trigger frontmatter, decision matrix, agent-browser+Vite fixture flow with exact postMessage shapes, CDP flow, showboat doc-assembly commands, Troubleshooting section) and a bun wrapper `scripts/cdp-session.ts` that reuses `src/test/cdp/lib/` primitives for screenshot/open-task/click-link/custom actions. Added `uv = "latest"` to `mise.toml`. Added "Visual proof for your PR" section to `CONTRIBUTING.md` (quickstart + three-path summary). Added "Visual proof for PRs" subsection to `AGENTS.md` pointing future sessions at the skill.

Validation:
- Fixture path smoke-tested end-to-end (agent-browser → /tasks.html → kanban rendered with injected tasks).
- CDP path: script compiles and help output works; live end-to-end run blocked by the same preexisting VS Code activation issue that breaks `bun run test:cdp` in this sandbox. Documented in SKILL.md Troubleshooting. The wrapper imports the same primitives as `scripts/screenshots/generate.ts` which runs in CI.
- PR 14 proof: produced tmp/pr14-proof.md via `uvx showboat` combining the 30/30 passing openWorkspaceFile unit tests, the test-case list as behavior contract, and the provider-wiring diff. `showboat verify` passes. AC #8 (live CDP click-through) partially satisfied — blocked by sandbox environment.
- PR 15 proof: produced tmp/pr15-proof.md via `uvx showboat` showing the before/after frontmatter shape, the serializer source-change stat, and the canonical-byte-for-byte test cases. `showboat verify` passes.

AC #8 is the only one not fully satisfied in this sandbox. Flagged in PR description for maintainer to re-run post-merge once the .vscode-test/ environment is healthy.
<!-- SECTION:FINAL_SUMMARY:END -->

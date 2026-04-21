---
id: TASK-160
title: Add depcheck + unified bun run ci preflight with pre-push license verification
status: Done
assignee: []
created_date: '2026-04-20 19:56'
updated_date: '2026-04-20 20:30'
labels:
  - tooling
  - ci
  - dx
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

PR #15 surfaced an unused `github-slugger` dep that review caught but tooling didn't. The repo has no automated dependency audit, `generate-license-file` drift is only verified in CI (contributors find out late), and there is no single command that mirrors what CI runs — so it's easy to push work that breaks CI. A concrete instance of that last point: `bun run test:e2e` is not in CI at all today, despite being the only flow that exercises `.vsix` packaging + install.

## Desired outcome

- `bun run depcheck` runs clean (zero unused/missing findings) with a checked-in `.depcheckrc.json` that suppresses justified false positives.
- `bun run ci` mirrors the GitHub Actions CI pipeline end-to-end (engines, lint, typecheck, depcheck, licenses, unit, build, playwright, cdp, e2e).
- GitHub Actions CI also runs depcheck and `test:e2e`.
- A Husky `pre-push` hook runs depcheck + license verification as a fast-fail safety net before pushing.
- `CONTRIBUTING.md` documents the new flow.

## Current depcheck findings (verified)

| Package | Status | Action |
|---|---|---|
| `tiny-markdown-editor` | False positive — dynamic `import()` in `src/webview/components/shared/MarkdownEditor.svelte` (depcheck has no Svelte parser) | Add to `ignores` |
| `@tailwindcss/cli` | False positive — `bunx @tailwindcss/cli` in `build:css` script | Add to `ignores` |
| `@testing-library/svelte` | Truly unused — no imports anywhere | **Remove from package.json** |
| `generate-license-file` | False positive — `bunx` in `scripts/generate-licenses.sh` | Add to `ignores` |
| `oxipng-bin` | False positive — used in `scripts/screenshots/generate.ts` | Add to `ignores` |
| `tailwindcss` | False positive — peer dep of `@tailwindcss/cli` (Tailwind v4) | Add to `ignores` |
| `vscode` (missing) | False positive — VS Code runtime module, not an npm package | Add to `ignoreMissing` |
| `chai` (missing) | **Real bug** — imported in `src/test/e2e/extension.test.ts:1`, currently resolves transitively via `vscode-extension-tester` | **Add `chai` and `@types/chai` to devDependencies** |

## Files to touch

- `package.json` — scripts (`depcheck`, `licenses:check`, `ci`) + deps (add chai/@types/chai, remove @testing-library/svelte)
- `.depcheckrc.json` — new file (see plan)
- `.husky/pre-push` — new file: `bun run depcheck && bun run licenses:check`
- `.github/workflows/ci.yml` — new `Dependency check` step after typecheck, new `Extension e2e smoke tests` step after CDP
- `CONTRIBUTING.md` — replace PR-process item 4, add a "Local CI preflight" subsection under Testing

## Design decisions (pre-agreed)

- **Husky hook scope: pre-push, not pre-commit.** Keeps the commit loop snappy; still catches issues before they hit GitHub CI.
- **`bun run ci` includes `test:e2e`, and CI is extended to run it too.** The 3 smoke tests in `src/test/e2e/extension.test.ts` uniquely exercise the `vsce package --no-dependencies` + extest install path; CDP doesn't cover that.
- **Use `bunx depcheck`** rather than adding a local devDependency, consistent with how `generate-license-file`, `vsce`, and `actions-up` are invoked.

## Proposed scripts

```jsonc
"depcheck": "bunx depcheck",
"licenses:check": "bun run licenses:generate && git diff --exit-code ThirdPartyNotices.txt",
"ci": "bun run check:engines && bun run lint && bun run typecheck && bun run depcheck && bun run licenses:check && bun run test && bun run build && bun run test:playwright && bun run test:cdp && bun run test:e2e"
```

## Proposed `.depcheckrc.json`

```json
{
  "ignores": [
    "tiny-markdown-editor",
    "@tailwindcss/cli",
    "tailwindcss",
    "generate-license-file",
    "oxipng-bin"
  ],
  "ignoreMissing": ["vscode"],
  "ignorePatterns": ["dist", ".vscode-test", "out", "tmp"]
}
```

Each ignore entry should be annotated (inline JSON doesn't allow comments, so add a companion block comment at the top of the file, or document the reasons in a short README section / CONTRIBUTING snippet) so future contributors don't strip the ignores without understanding them.

## Out of scope

- Rewriting `test:e2e` as CDP coverage (separate design question; the smoke suite earns its keep today by exercising VSIX packaging).
- Parallelizing CI steps into a job matrix.
- Applying the same depcheck/license gate to `release.yml` (release already calls `licenses:generate` via the CI pipeline; revisit separately for consistency).
- Switching from pre-push to pre-commit. Revisit only if push latency becomes annoying.

## Verification

See the approved implementation plan at `/home/node/.claude/plans/re-the-unused-github-slugger-fluffy-hearth.md` for the full verification checklist. Critical checks: synthetic unused-dep and missing-dep tests using the fixture name `@fixture/not-a-real-package` (declared in manifest only, never installed — do **not** use known-compromised packages like left-pad as test fixtures); `licenses:check` fails on manual drift; pre-push hook fires on `git push --dry-run`; `bun run ci` passes end-to-end; GitHub Actions CI passes with both new steps.

## Context pointers

- `CONTRIBUTING.md:158-165` — PR process section to update
- `.github/workflows/ci.yml` — CI workflow
- `scripts/generate-licenses.sh` — license generator (uses `bunx generate-license-file`)
- `scripts/run-e2e.sh` — already handles xvfb on CI via `$CI` detection; no extra workflow setup needed for the new e2e step
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `bun run depcheck` exits 0 with zero unused and zero missing on a clean working tree
- [x] #2 `.depcheckrc.json` is checked in with ignores for tiny-markdown-editor, @tailwindcss/cli, tailwindcss, generate-license-file, oxipng-bin, plus ignoreMissing for vscode
- [x] #3 @testing-library/svelte is removed from package.json devDependencies
- [x] #4 chai and @types/chai are added to package.json devDependencies and bun.lock is updated
- [x] #5 `bun run licenses:check` script exists and fails non-zero when ThirdPartyNotices.txt is out of sync
- [x] #6 `bun run ci` script exists and runs engines → lint → typecheck → depcheck → licenses:check → test → build → test:playwright → test:cdp → test:e2e in order with fail-fast
- [x] #7 `.husky/pre-push` exists and runs `bun run depcheck` followed by `bun run licenses:check`
- [x] #8 .github/workflows/ci.yml has a new `Dependency check` step (running `bun run depcheck`) after the Type check step
- [x] #9 .github/workflows/ci.yml has a new `Extension e2e smoke tests` step (running `bun run test:e2e`) after the CDP cross-view tests step
- [x] #10 CONTRIBUTING.md Pull Request Process section instructs contributors to run `bun run ci` before submitting; a new Testing subsection documents `bun run ci`, `bun run depcheck`, `bun run licenses:check`, and the pre-push hook
- [x] #11 Synthetic unused-dep test passes: adding `"@fixture/not-a-real-package": "0.0.0"` to devDependencies (manifest only, no install) makes `bun run depcheck` fail and list it
- [x] #12 Synthetic missing-dep test passes: temporarily removing `chai` from devDependencies (manifest only) makes `bun run depcheck` fail and list it as missing
- [ ] #13 GitHub Actions CI run on the PR passes with both new steps (Dependency check, Extension e2e smoke tests) executing and succeeding
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Follow-up fix: VS Code 1.116 onboarding overlay

When CI first ran with the new `Extension e2e smoke tests` step (and when the user reproduced locally on macOS), 2 of 4 e2e tests failed with `ElementClickInterceptedError`: VS Code 1.116's new "Welcome to VS Code / sign in to continue with AI-powered development" overlay (CSS class `.onboarding-a-overlay`) was covering the activity bar.

Root cause: upstream VS Code `src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts` gates this overlay on the setting `workbench.welcomePage.experimentalOnboarding`. First-launch users without that setting disabled get the modal.

Fix (commit `5078948`):
- Added `scripts/e2e-vscode-settings.json` with `workbench.welcomePage.experimentalOnboarding: false` plus a handful of belt-and-suspenders welcome/experiments/telemetry flags (startupEditor=none, walkthroughs.openOnInstall=false, enableExperiments=false, telemetryLevel=off, update.mode=none, extensions auto-update off, chat.commandCenter.enabled=false).
- Wired `--code_settings "$CODE_SETTINGS"` into the `extest run-tests` invocation in `scripts/run-e2e.sh`.
- Pinned `@vscode/vsce` to `3.9.1` in the same script so bunx cache drift doesn't leave contributors on differently-warning builds (the Mac run that surfaced this was packaging with cached 3.7.1).

Verified locally on Linux + xvfb + VS Code 1.116.0: 4/4 e2e tests pass.

## Follow-up: bunx → direct-invocation cleanup

User flagged that several scripts were calling tools via `bunx` even though those tools were already in devDependencies, creating an ambiguous version story. Established the rule:

- **In package.json scripts and shell scripts run via `bun run`**: use the bare binary name. `node_modules/.bin` is on PATH and the version is authoritatively the one in `bun.lock`.
- **For tools NOT in package.json**: always pin via `bunx pkg@ver` so bunx cache drift can't hand different contributors different versions.
- **Git hooks**: keep `bunx` or `bun run` for PATH robustness.

Changes (commit to follow):
- `package.json`: `bunx @tailwindcss/cli` → `tailwindcss`; `bunx depcheck` → `depcheck`; added `depcheck` as a devDependency.
- `scripts/generate-licenses.sh`: `bunx generate-license-file` → `generate-license-file`.
- `scripts/run-e2e.sh`: four `bunx extest` → `extest`.
- `scripts/run-cdp-tests.sh`: `bunx vitest` → `vitest`.
- `.github/workflows/release.yml`: `bunx vsce publish` → `bunx "@vscode/vsce@3.9.1" publish`; `bunx ovsx publish` → `bunx "ovsx@0.10.11" publish` (matching the vsce pin already in `scripts/run-e2e.sh`).
- `.depcheckrc.yml`: dropped the `@tailwindcss/cli` ignore — depcheck now resolves the `tailwindcss` bin back to `@tailwindcss/cli`. Updated comments on remaining entries to reflect the rule.
- Left `bunx playwright`/`bunx vitest` in `.github/workflows/ci.yml` and `bunx lint-staged` in `.husky/pre-commit` alone: GitHub Actions steps and git hooks both have no reliable PATH, and bunx already resolves to the local install.
- Left `bunx actions-up@v1.12.0` and `bunx "@vscode/vsce@3.9.1"` alone: already pinned; not in devDeps by design (maintenance / release-only tooling).

Verified: `bun run depcheck` / `typecheck` / `lint` / `licenses:check` / unit tests (823 passing) / `build` / `test:e2e` (4/4 passing) all green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## What changed

- **Real dep findings fixed**: removed the truly-unused `@testing-library/svelte`; added `chai` + `@types/chai` to devDependencies (they were being imported in `src/test/e2e/extension.test.ts` but resolving transitively through `vscode-extension-tester`).
- **`.depcheckrc.yml`** (YAML chosen over JSON for inline comments): ignores `tiny-markdown-editor`, `@tailwindcss/cli`, `tailwindcss`, `generate-license-file`, `oxipng-bin`, and `vscode`. Each entry is annotated with the reason (dynamic import, bunx invocation, peer dep, or runtime-provided module). Found during implementation that depcheck's `ignores` list also suppresses missing-import false positives, so `vscode` lives there rather than in a separate `ignoreMissing` section.
- **New package.json scripts**: `depcheck`, `licenses:check` (regenerates + diff-check), and `ci` (chains engines → lint → typecheck → depcheck → licenses:check → test → build → playwright → cdp → e2e).
- **`.husky/pre-push`**: runs `bun run depcheck` + `bun run licenses:check`.
- **`.github/workflows/ci.yml`**: added `Dependency check` step after `Type check`, and `Extension e2e smoke tests` step after the CDP step. Also refactored the existing `Verify licenses are up to date` step to call `bun run licenses:check` for consistency with local usage.
- **`CONTRIBUTING.md`**: replaced PR-process item 4 to reference `bun run ci`; added a new "Local CI preflight" subsection under Testing that documents `bun run ci`, `bun run depcheck`, `bun run licenses:check`, and the pre-push hook.

## Verification

- `bun run depcheck` → `No depcheck issue`, exit 0
- `bun run licenses:check` → exit 0 on a clean tree
- `bun run lint` → pass
- `bun run typecheck` → pass
- `bun run test` → 823 tests pass across 28 files
- Synthetic unused-dep test: adding `@fixture/not-a-real-package` to devDependencies (manifest only, never installed — deliberately synthetic name to avoid any real-package contamination) makes depcheck exit 255 with `Unused devDependencies: @fixture/not-a-real-package`. Reverted.
- Synthetic missing-dep test: temporarily removing `chai` from devDependencies (manifest only) makes depcheck exit 255 with `Missing dependencies: chai: ./src/test/e2e/extension.test.ts`. Reverted.
- Pre-push hook invokes directly (`bash .husky/pre-push`) and exits 0 with both checks running.

Acceptance criterion #13 (GitHub Actions CI passes with both new steps) will be verified when the PR is opened and CI runs.

## Notes

- Pre-existing prettier formatting warnings exist on 5 unrelated files (`src/core/BacklogCli.ts`, `src/core/BacklogWriter.ts`, `src/providers/TaskDetailProvider.ts`, `src/providers/TasksViewProvider.ts`, `src/test/unit/BacklogWriter.test.ts`). None were touched by this task and fixing them is out of scope.
- Redundancy in CI: CDP step downloads VS Code via curl/tar into `.vscode-test/`; `test:e2e` separately invokes `bunx extest get-vscode` which may download again into a different subdirectory. Harmless but potentially slow — if it becomes a problem, merging the two download flows is a follow-up.
- `release.yml` was not updated with the new depcheck step. It already runs `licenses:generate` implicitly via the CI pipeline, and extending release to include depcheck would be a consistency cleanup for a separate task.
<!-- SECTION:FINAL_SUMMARY:END -->

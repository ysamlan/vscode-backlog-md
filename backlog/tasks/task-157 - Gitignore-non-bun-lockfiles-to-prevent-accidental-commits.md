---
id: TASK-157
title: Gitignore non-bun lockfiles to prevent accidental commits
status: Done
assignee: []
created_date: '2026-04-20 00:53'
updated_date: '2026-04-20 00:54'
labels:
  - chore
  - tooling
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This project uses Bun (`bun.lock`) as its sole package manager, but `.gitignore` does not exclude lockfiles from other package managers. If a contributor runs `npm install`, `yarn`, or `pnpm install` — intentionally or as muscle memory — the resulting `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` is untracked with no warning, and trivially ends up in a `git add .` commit. This actually happened in PR #15, which accidentally committed a 15,047-line `package-lock.json`.

Add the three non-Bun lockfile names to `.gitignore` so they cannot be committed by accident. This is a defensive one-liner — no behavior change, just a backstop for the existing "use bun" convention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.gitignore` contains entries for `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` so they are ignored by git.
- [x] #2 Running `npm install` (or equivalent for yarn/pnpm) in a fresh checkout does not produce new tracked files in `git status`.
- [x] #3 `bun.lock` remains tracked and is not affected by the new ignore entries.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` to `.gitignore` under a comment explaining that this project uses `bun.lock`. Verified with `git check-ignore`: the three new entries match, `bun.lock` does not. Confirmed `git status` stays clean after touching all three sentinel files.
<!-- SECTION:FINAL_SUMMARY:END -->

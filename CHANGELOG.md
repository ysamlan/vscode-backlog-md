# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and (from v0.3.7 onward) this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Removed the broken `img.shields.io/visual-studio-marketplace` badge from the README — shields.io [retired the entire `visual-studio-marketplace` service in April 2026](https://github.com/badges/shields/issues/11796), so every variant rendered as "retired badge". The Open VSX badge remains and tracks the same release cadence.

## [0.3.8] - 2026-04-22

### Added

- **Clickable workspace links in markdown** — Relative links inside rendered task descriptions and document/decision panes (e.g. `[gitlab.py](src/autochecker/gitlab.py)` or `src/foo.ts#L10-L20`) now open the target file in a real editor tab and jump to the line range, instead of toggling edit mode or navigating the webview to a bogus localhost URL. ([#14](https://github.com/ysamlan/vscode-backlog-md/pull/14))
- **Link tooltips** — Hover any link inside a rendered markdown section to see its target URL. ([#14](https://github.com/ysamlan/vscode-backlog-md/pull/14))

### Changed

- **Canonical upstream frontmatter on every save** — Task files now round-trip byte-for-byte with the Backlog.md CLI: single-quoted dates, block-style arrays, canonical field order, and optional empty arrays omitted. Eliminates diff churn when the same task is edited through this extension and the CLI. ([#15](https://github.com/ysamlan/vscode-backlog-md/pull/15))

### Fixed

- **Tasks and Details view icons** render correctly when VS Code promotes them to their own activity-bar slot (previously a fallback icon appeared). ([#24](https://github.com/ysamlan/vscode-backlog-md/pull/24))
- Cleaned up `package.json` schema warnings (redundant `onCommand:backlog.init` activation event) and quieted the vite chunk-size warning for the lazy-loaded `mermaid.core` bundle. ([#24](https://github.com/ysamlan/vscode-backlog-md/pull/24))

### Internal

- Releases are now driven by [release-it](https://github.com/release-it/release-it) + `@release-it/keep-a-changelog`: `bun run release` locally bumps the version, promotes the `[Unreleased]` section, commits, tags, and pushes. The GitHub Actions workflow is now tag-triggered and creates the release with the `.vsix` attached in one step (fixing the "Cannot upload assets to an immutable release" failure).
- Unified `bun run ci` preflight mirroring the GitHub Actions pipeline end-to-end; new depcheck + license-drift gates, plus a Husky pre-push hook. ([#21](https://github.com/ysamlan/vscode-backlog-md/pull/21))
- Project-local `visual-proof` skill and a hardened CDP launcher that auto-refreshes the cached VS Code binary when it falls below the extension's engine floor. ([#20](https://github.com/ysamlan/vscode-backlog-md/pull/20))
- License-generation fixes (regenerate in a clean tmp dir to avoid stale transitive copies) and dependency refreshes. ([#18](https://github.com/ysamlan/vscode-backlog-md/pull/18), [#23](https://github.com/ysamlan/vscode-backlog-md/pull/23))
- GitHub Actions bumps, non-bun lockfiles added to `.gitignore`, CONTRIBUTING docs for installing a local `.vsix`, and task/PR mapping guidance for agents. ([#16](https://github.com/ysamlan/vscode-backlog-md/pull/16), [#17](https://github.com/ysamlan/vscode-backlog-md/pull/17), [#19](https://github.com/ysamlan/vscode-backlog-md/pull/19), [#22](https://github.com/ysamlan/vscode-backlog-md/pull/22))

<!-- Entries below this line pre-date the Keep-a-Changelog migration and use
     the legacy rhysd/changelog-from-release format. -->

<a id="v0.3.6"></a>

# [v0.3.6](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.6) - 2026-03-25

## What's Changed

- Support .backlog/, root backlog.config.yml, and custom backlog dirs by [@ysamlan](https://github.com/ysamlan) in [#12](https://github.com/ysamlan/vscode-backlog-md/pull/12) (see [MrLesk/Backlog.md#563](https://github.com/MrLesk/Backlog.md/pull/563))
- align filters left so they don't look janky at narrow widths

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.5...v0.3.6

[Changes][v0.3.6]

<a id="v0.3.5"></a>

# [v0.3.5](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.5) - 2026-02-26

A few bugfixes and several changes to align better with upstream backlog.md behavior.

### Added

- Priority filter in list view.
- Better cross-branch task-state filtering across tasks, drafts, completed, and archive/
  tasks.

### Changed

- Aligned parser/writer and task views with upstream Backlog.md behavior (status
  handling, sorting, ordering, and compatibility details).
- Preserved source line endings (CRLF/LF) during task rewrites.

### Fixed

- Cross-branch views no longer show completed/archived tasks as live.
- Filtered list no longer mis-renders subtasks under unrelated parents (new ghost parent row
  behavior).
- Kanban/list sorting and grouping edge cases (priority tiebreaking, done-column recency
  sort, case-insensitive status matching, uncategorized milestone ordering).

### Model-only (no UI)

- Upstream parity for Task → draft demotion, status-change callbacks, Document/Decision CRUD and extended milestone lifecycle operations.

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.4...v0.3.5

[Changes][v0.3.5]

<a id="v0.3.4"></a>

# [v0.3.4](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.4) - 2026-02-23

## Features

- add 'x' buttons to remove dependencies in edit view

## Bugfixes

- release workflow fixes for openvsx publishing by [@ysamlan](https://github.com/ysamlan) in [#5](https://github.com/ysamlan/vscode-backlog-md/pull/5)
- fix positioning of autocomplete dropdowns for labels etc. with new styled input

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.3...v0.3.4

[Changes][v0.3.4]

<a id="v0.3.3"></a>

# [v0.3.3](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.3) - 2026-02-23

## New Features

- Add Implementation Plan, Notes, and Final Summary sections by [@ysamlan](https://github.com/ysamlan) in [#2](https://github.com/ysamlan/vscode-backlog-md/pull/2)
- Add double-click on task cards to open full edit view by [@ysamlan](https://github.com/ysamlan) in [#3](https://github.com/ysamlan/vscode-backlog-md/pull/3)

## Bug Fixes

- Fix issues with headers at end of markdown fields being swallowed by the editor on save
- Fix bullet list / numbered list display in Markdown previews
- Fix e2e test and release issue with dependency on npm dependency checks (unnecessary for us as a `bun` shop)

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.2...v0.3.3

[Changes][v0.3.3]

<a id="v0.3.2"></a>

# [v0.3.2](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.2) - 2026-02-23

### Features

- First-class Milestones
  - Milestones are now sourced from backlog/milestones/ files, matching new upstream Backlog.md behavior
  - Empty milestones are visible in the kanban "By Milestone" view so you can see your full roadmap
  - New command: Backlog: Create Milestone in the command palette (accessible from the Kanban by-epic and task edit views too)

### Bugfixes

- Archiving a task now automatically removes its ID from other tasks' dependencies and references (matching upstream)

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.1...v0.3.2

[Changes][v0.3.2]

<a id="v0.3.1"></a>

# [v0.3.1](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.1) - 2026-02-16

### What's New

- Search now also searches task IDs

### Bug Fixes

- Fix task preview panel not auto-refreshing on task file changes

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.0...v0.3.1

[Changes][v0.3.1]

<a id="v0.3.0"></a>

# [v0.3.0](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.3.0) - 2026-02-16

### What's New

- Markdown editor for descriptions — Task descriptions now use a rich inline markdown editor with toolbar support for bold, italic, headers, lists, checklists, code blocks, and links. Click to edit, Escape to revert.
- Structured checklist editing for Acceptance Criteria and Definition of Done now use inline item editing with add, edit, and delete per item.

### Bug Fixes

- Fixed parser stripping blank lines between paragraphs in task body sections.

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/0.2.3...v0.3.0

[Changes][v0.3.0]

<a id="0.2.3"></a>

# [v0.2.3](https://github.com/ysamlan/vscode-backlog-md/releases/tag/0.2.3) - 2026-02-13

### Added

- Editable dependency linking in Task Detail: you can now add/edit task dependencies directly from the
  task detail view.

### Fixed

- Fixed a bug where switching tasks while editing the description would show a the previous task's description.
- Fixed a crash when viewing backlogs containing multiple files with the same IDs.

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.2...0.2.3

[Changes][0.2.3]

<a id="v0.2.2"></a>

# [v0.2.2](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.2.2) - 2026-02-12

- Now available on https://open-vsx.org/extension/ysamlan/vscode-backlog-md for VSCodium and other compatible editors
- Fixed README images not rendering on the Open VSX listing
- Reduced extension package size by excluding screenshot assets from the .vsix

**Full Changelog**: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.0...v0.2.2

[Changes][v0.2.2]

<a id="v0.2.0"></a>

# [v0.2.0](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.2.0) - 2026-02-11

### New Features

- Multi-root workspace support — `Backlog: Select Backlog` command to switch between folders when using a workspace with multiple backlogs.
- Backlog init wizard — Initialize a new backlog/ folder directly from the extension.
- Backlog.md binary and agent integration setup — Banner/actions for installing backlog.md and for installing agent configs via `backlog init` if none is detected
- Mermaid diagram rendering from fenced mermaid code blocks (parity for existing backlog.md capabilities)

### Bug Fixes

- Checklist duplicate ID crash — Fixed a Svelte each_key_duplicate crash when checklist items lacked #N prefixes. Items now get sequential 1-based index IDs matching backlog.md behavior.

[Changes][v0.2.0]

<a id="v0.1.1"></a>

# [v0.1.1](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.1.1) - 2026-02-10

fix images not showing in vsix

[Changes][v0.1.1]

<a id="v0.1.0"></a>

# [v0.1.0](https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.1.0) - 2026-02-10

Initial public release.

[Changes][v0.1.0]

[Unreleased]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.6...HEAD
[v0.3.6]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.5...v0.3.6
[v0.3.5]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.4...v0.3.5
[v0.3.4]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.3...v0.3.4
[v0.3.3]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.2...v0.3.3
[v0.3.2]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.1...v0.3.2
[v0.3.1]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.0...v0.3.1
[v0.3.0]: https://github.com/ysamlan/vscode-backlog-md/compare/0.2.3...v0.3.0
[0.2.3]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.2...0.2.3
[v0.2.2]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.0...v0.2.2
[v0.2.0]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.1.1...v0.2.0
[v0.1.1]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/ysamlan/vscode-backlog-md/tree/v0.1.0

<!-- Older entries generated by https://github.com/rhysd/changelog-from-release v3.9.1 -->

[Unreleased]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.8...main
[0.3.8]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.6...v0.3.8
[0.3.7]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.3.6...v0.3.7

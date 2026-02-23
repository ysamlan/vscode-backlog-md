# Changelog

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

<!-- Generated by https://github.com/rhysd/changelog-from-release v3.9.1 -->

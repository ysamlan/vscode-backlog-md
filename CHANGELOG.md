# Changelog

All notable changes to the Backlog.md VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.3] - 2026-02-13

### Added

- **Editable dependency linking in Task Detail** - You can now add and edit task dependencies directly in the task detail view.

### Fixed

- Fixed a bug where switching tasks while editing the description could show the previous task's description.
- Fixed a crash when viewing backlogs containing multiple files with the same IDs.

## [0.2.2] - 2026-02-12

### Added

- Published to Open VSX for VSCodium and other compatible editors: https://open-vsx.org/extension/ysamlan/vscode-backlog-md

### Fixed

- Fixed README images not rendering on the Open VSX listing.
- Reduced extension package size by excluding screenshot assets from the `.vsix`.

## [0.2.0] - 2026-02-10

### Added

- Multi-root workspace support via `Backlog: Select Backlog` to switch between folders in multi-backlog workspaces.
- Backlog init wizard to initialize a new `backlog/` folder directly from the extension.
- Backlog.md binary and agent integration setup with banner/actions for installing `backlog.md` and agent configs.
- Mermaid diagram rendering from fenced `mermaid` code blocks (feature parity with backlog.md).

### Fixed

- Checklist duplicate ID crash: fixed a Svelte `each_key_duplicate` crash when checklist items lacked `#N` prefixes by assigning sequential 1-based index IDs matching backlog.md behavior.

## [0.1.0] - 2026-02-03

### Added

- Initial release of the Backlog.md VS Code extension.

[Unreleased]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/ysamlan/vscode-backlog-md/compare/v0.2.0...v0.2.2
[0.2.0]: https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.2.0
[0.1.0]: https://github.com/ysamlan/vscode-backlog-md/releases/tag/v0.1.0

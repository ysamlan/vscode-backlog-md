---
id: TASK-158
title: Harden openWorkspaceFile against link edge cases
status: In Progress
assignee: []
created_date: '2026-04-20 12:00'
updated_date: '2026-04-20 14:45'
labels: []
dependencies:
  - TASK-153
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to TASK-153. `openWorkspaceFile` resolves the straightforward cases (plain workspace-relative paths, `Lstart[-Lend]` ranges, and GitHub-style heading slugs via `github-slugger` with fenced-code filtering and duplicate-slug `-1`/`-2` counters), but several link shapes authored by humans or tools still either fail silently or produce surprising behavior. Tighten the resolver and its markdown heading scanner so clicks on unusual-but-valid links land where a markdown reader would expect, and clearly reject links that shouldn't open at all.

Areas to address:

### Link shapes that currently fail to resolve

- URL-encoded segments (`task-041%20-%20foo.md`) — `vscode.Uri.joinPath` keeps `%20` literal; lookup must `decodeURIComponent` first.
- Parent-traversal paths (`../../contributing/report.md`) inside a task/document file — must resolve against the source file's directory first, with workspace folders as fallback. When both a source-relative sibling and a workspace-root file of the same name exist, the sibling wins.

### Path resolution

- Reject absolute paths (`/etc/passwd`, `C:\\...`) rather than opening files outside the workspace.
- Normalize Windows-style separators (`docs\\guide.md`) so cross-platform-authored links resolve on Linux/macOS.
- Verify the resolved target is a regular file via `FileType.File`; currently a directory passes `fs.stat` and then fails silently in `vscode.open`.

### Fragment parsing

- Treat `L0` as invalid (not silently clamped to line 0).
- Handle reversed ranges like `L50-L10` deliberately — either swap or reject — instead of collapsing to a single line.
- Support setext headings (`Title\n=====`, `Title\n-----`), which GitHub renders but the current ATX-only regex ignores.
- Ignore `#`-prefixed lines inside 4-space indented code blocks and inside HTML comments (currently only fenced blocks are filtered).

### Encoding

- Document (and test) that `+` is not decoded as space — `decodeURIComponent` matches browser address-bar semantics, not query-string semantics. Add a test so the behavior is pinned.

Non-goals: changing the message contract between webview and extension host; changing slug library; supporting non-markdown anchors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 URL-encoded paths like `task-041%20-%20foo.md` resolve to the literal filename with spaces
- [x] #2 Parent-traversal paths (`../../contributing/report.md`) in a task/document body resolve against the source file's directory before falling back to workspace folders; a source-relative sibling wins over a workspace-root file of the same name
- [x] #3 Absolute paths in link hrefs are rejected with a user-visible warning and do not open files outside the workspace
- [x] #4 Links authored with backslash separators resolve to the same file as forward-slash equivalents on all platforms
- [x] #5 Links that resolve to a directory show a warning instead of silently failing
- [x] #6 Setext-style headings are matched by slug fragments the same as ATX headings
- [x] #7 `#` lines inside 4-space indented code blocks and HTML comments are not treated as headings
- [x] #8 `L0`, reversed ranges, and malformed line fragments behave deterministically and are covered by unit tests
- [x] #9 Unit tests pin the `+`-is-not-space decoding behavior and the directory/absolute-path rejections
<!-- AC:END -->

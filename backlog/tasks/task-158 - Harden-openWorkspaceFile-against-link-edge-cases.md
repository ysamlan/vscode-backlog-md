---
id: TASK-158
title: Harden openWorkspaceFile against link edge cases
status: Done
assignee: []
created_date: '2026-04-20 12:00'
updated_date: '2026-04-21 12:48'
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
- Reject traversal paths that resolve outside every workspace folder (`../../../etc/passwd` from inside a task file). The absolute-path check covers literal roots but not `..`-escaped ones; verify each resolved candidate with `path.relative` against workspace folders before `fs.stat`.
- Normalize Windows-style separators (`docs\\guide.md`) so cross-platform-authored links resolve on Linux/macOS.
- Verify the resolved target is a regular file via `FileType.File`; currently a directory passes `fs.stat` and then fails silently in `vscode.open`.

### IPC boundary

- Validate the `openWorkspaceFile` message shape at each webview→host handler (`TaskDetailProvider`, `ContentDetailProvider`, `TaskPreviewViewProvider`). A compromised or buggy webview could post `relativePath: {}` / an array / an over-long string; reject non-string or over-length values instead of letting them reach the resolver and coerce via `decodeURIComponent`.

### Denial-of-service on heading resolution

- `findHeadingRange` currently reads the target file in full to scan for the matching slug. A link like `[big](some-huge-file.md#anything)` would load the entire file into memory on click. Stat the file first and skip heading lookup for files above a reasonable cap (e.g. 5 MB) — fall back to a plain open without the anchor.

### Fragment parsing

- Treat `L0` as invalid (not silently clamped to line 0).
- Handle reversed ranges like `L50-L10` deliberately — either swap or reject — instead of collapsing to a single line.
- Support setext headings (`Title\n=====`, `Title\n-----`), which GitHub renders but the current ATX-only regex ignores.
- Ignore `#`-prefixed lines inside 4-space indented code blocks and inside HTML comments (currently only fenced blocks are filtered).

### Encoding

- Document (and test) that `+` is not decoded as space — `decodeURIComponent` matches browser address-bar semantics, not query-string semantics. Add a test so the behavior is pinned.
- `findHeadingRange` calls bare `decodeURIComponent(fragment)` on the anchor. A malformed `%` sequence (e.g. `#foo%ZZ`) throws uncaught and bubbles out of the webview handler. Wrap it in the same `safeDecode` helper used on the path, or accept the raw fragment when decoding fails.

### Anchor-only links

- Links of the form `#heading` with no path component should reveal the matching heading in the *current* file (the source file the link was authored in). Today `openWorkspaceFile` early-returns on empty `relativePath`, so same-file anchor links do nothing. When `relativePath` is empty/missing and `sourceFilePath` is provided with a fragment, resolve the fragment against the source file itself.

### Heading scanner false positives and missed matches

- **YAML frontmatter.** The setext regex `/^ {0,3}-+\s*$/` matches the closing `---` of a YAML frontmatter block, causing the preceding YAML key (e.g. `title: foo`) to be slugged as an H2. Detect and skip a leading `---\n…\n---` block before scanning for headings.
- **Inline markdown in heading text.** GitHub strips backticks, emphasis markers, and link syntax from heading text before producing the slug (so `## \`foo()\` bar` anchors as `foo-bar`). Today the ATX regex captures raw text including these markers, so any heading containing `` ` ``, `*`, `_`, `~`, or `[text](url)` can slug-mismatch against what a reader clicks. Normalize heading text (strip inline code spans, emphasis runs, and replace links with their display text) before calling `slugger.slug`.
- **Headings inside blockquotes.** GitHub renders and anchors `> ## Title`; the current `^ {0,3}#` regex rejects it. Strip a leading `>` plus optional space (possibly nested) before applying the ATX/setext match.

### Symlink containment

- `vscode.workspace.fs.stat` follows symlinks, and `isInsideWorkspace` only checks the symlink's own path. A symlink *inside* the workspace pointing to a file *outside* (e.g. `docs/leak.md -> /etc/passwd`) passes every existing check and then opens the external target. Resolve the real path (`fs.realpath` on node fs, or equivalent) of the candidate and re-apply `isInsideWorkspace` against the resolved path before opening. Reject with the same "outside workspace" warning when the realpath escapes.

Non-goals: changing the message contract between webview and extension host; changing slug library; supporting non-markdown anchors; supporting query-string-style `?v=…` segments before the fragment.
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
- [x] #10 Links that resolve outside every workspace folder (via `../` traversal) are rejected with a user-visible warning and do not open files outside the workspace
- [x] #11 The `openWorkspaceFile` message is shape-validated at each provider's webview→host handler — non-string or over-length `relativePath` / `fragment` values are dropped without reaching the resolver
- [x] #12 Markdown heading resolution is bounded by file size: files above the configured cap fall back to a plain open (no `readFile`) instead of loading the whole document to scan for a slug
- [x] #13 Anchor-only links (`#heading` with no path component) reveal the matching heading in the source file the link was authored in
- [x] #14 YAML frontmatter at the top of a markdown file is skipped during heading scanning: the closing `---` is not matched as a setext H2, and `#` lines inside frontmatter are not treated as ATX headings
- [x] #15 Heading text containing inline markdown (code spans, emphasis markers, or `[text](url)` links) produces the same slug GitHub does — inline markup is stripped before slugging
- [x] #16 Headings authored inside a blockquote (`> ## Title`, including nested `> > ## Title`) are matched by their slug the same as top-level headings
- [x] #17 A symlink inside the workspace whose realpath resolves outside every workspace folder is rejected with the same "outside workspace" warning as a literal `../` escape
- [x] #18 A malformed percent sequence in the fragment (e.g. `#foo%ZZ`) does not throw out of the webview handler — the fragment is either decoded best-effort or treated as a literal string
<!-- AC:END -->

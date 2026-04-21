---
id: TASK-155
title: Align frontmatter serializer with canonical backlog.md format
status: In Progress
assignee: []
created_date: '2026-04-18 13:49'
updated_date: '2026-04-21'
labels:
  - parser
  - writer
  - upstream
dependencies: []
references:
  - expectations/canonical-backlog-md-format
  - src/core/BacklogWriter.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The VSCode extension's frontmatter serializer produces YAML that diverges from canonical backlog.md CLI output. This causes round-trip diffs whenever the CLI and extension touch the same task file.

**Observed deltas** (from autochecker repo `task-10`):

| Field            | CLI (canonical)         | Extension             |
| ---------------- | ----------------------- | --------------------- |
| String quoting   | single quotes `'...'`   | double quotes `"..."` |
| Array formatting | block-style (`-` lines) | flow-style (`[a, b]`) |
| `created_date`   | quoted                  | quoted                |
| `updated_date`   | quoted (when present)   | unquoted              |
| Date value       | `YYYY-MM-DD HH:MM` (UTC)| `YYYY-MM-DD`          |

**Policy change:** TASK-115.3 previously documented quote style and array format as intentional divergence. That decision is reversed — backlog.md CLI is canonical and the extension must match its serialization byte-for-byte where practical.

**Scope:** update the writer to emit single-quoted strings, block-style arrays, and consistently quoted dates. Add round-trip tests: read a CLI-produced file, write it back, assert no diff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Writer emits single-quoted strings matching CLI output
- [x] #2 Writer emits block-style arrays (multi-line with leading dash) instead of flow-style
- [x] #3 Writer quotes date fields consistently with CLI (including updated_date)
- [x] #4 Round-trip test reads a CLI-produced task file, writes it, and asserts zero diff
- [x] #5 TASK-115.3's 'intentional divergence' notes on format are updated or superseded
- [x] #6 `created_date` / `updated_date` values emitted as `YYYY-MM-DD HH:MM` (UTC) to match CLI precision
- [x] #7 Decision frontmatter field order matches upstream `serializeDecision` exactly (id, title, date, status)
- [x] #8 Document frontmatter field order matches upstream `serializeDocument` exactly (id, title, type, created_date, updated_date, tags)
- [x] #9 Blank-line-after-frontmatter post-process is applied only to tasks; decisions and documents match upstream gray-matter default
- [x] #10 Round-trip tests cover both decisions and documents (no-op update preserves byte-for-byte file content)
- [x] #11 Unused `github-slugger` dependency is removed from package.json, bun.lock, and ThirdPartyNotices.txt
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Canonical reference

Upstream serializer: `https://github.com/MrLesk/Backlog.md/blob/1679c03d1d3c872ed73dc11d3e4f10480cfb0e52/src/markdown/serializer.ts#L11-L64`

Uses `gray-matter` via `matter.stringify(body, frontmatter)`, which wraps `js-yaml` dump with defaults: block-style arrays, auto-quoting (single quotes only when needed), no forced quote style.

## Canonical field order (from upstream serializer.ts:13-31)

```text
id
title
status
assignee
reporter?
created_date
updated_date?
labels
milestone?
dependencies
references?
documentation?
parent_task_id?
subtasks?
priority?
ordinal?
onStatusChange?
```

Fields marked `?` are omitted entirely (not emitted as empty) when absent. Empty arrays for `references`, `documentation`, `subtasks` are also omitted — only `labels`, `dependencies` are always emitted.

## Options to match canonical

1. **Add `gray-matter` dependency** — simplest, matches upstream byte-for-byte because it's literally the same library/call.
2. **Keep `js-yaml` direct, tune dump options** — avoid new dep. Use `yaml.dump(obj, { lineWidth: -1 })` (gray-matter's default) with no `flowLevel` override; wrap with `---\n...---\n\n` manually and handle empty-array omission + field order in pre-serialization.

Option 1 is lower-risk and cheaper to maintain since field-order and quoting tweaks in upstream flow through automatically.

## Post-processing step

Upstream applies a regex to ensure a blank line between frontmatter and body **only in `serializeTask`**:

```js
serialized.replace(/^(---\n(?:.*\n)*?---)\n(?!$)/, "$1\n\n");
```

`serializeDecision` and `serializeDocument` emit the gray-matter default (single
newline between `---` and body) — do not apply the regex there. The
`reconstructFile` helper takes a `blankLineAfterFrontmatter` option (default
`true`); decision/document call sites pass `false`.

## Entity-specific field order (per PR #15 review)

Upstream's three serializers diverge subtly on order:

- **Task** (upstream `serializer.ts:13–31`): `id, title, status, assignee, reporter?, created_date, updated_date?, labels, milestone?, dependencies, references?, documentation?, parent_task_id?, subtasks?, priority?, ordinal?, onStatusChange?`
- **Decision** (`serializer.ts:67–72`): `id, title, date, status` — `date` before `status`
- **Document** (`serializer.ts:85–93`): `id, title, type, created_date, updated_date?, tags?`

A single unified order works if `date` is placed before `status` and `type`
before `created_date`. Tasks have neither `type` nor `date`, so those slots are
harmlessly skipped.
<!-- SECTION:PLAN:END -->

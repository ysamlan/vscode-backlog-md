---
name: visual-proof
description: Produce verifiable visual/behavioral proof-of-work for changes to this VS Code extension. Use when making UI or user-visible changes, when the user asks to "show what it looks like", when producing PR demo content, or when completing a task that has observable output. Captures either Svelte component visuals via the Vite fixture server + agent-browser (fast, no VS Code) or end-to-end extension behavior via CDP-driven real VS Code (slow, full fidelity). Assembles output into a showboat markdown doc with embedded screenshots and verifiable command output. Trigger when the user invokes `/visual-proof`, asks for screenshots, wants before/after comparison, or finishes a feature with visible behavior.
allowed-tools: Bash(bun:*), Bash(uvx:*), Bash(agent-browser:*), Bash(xvfb-run:*), Bash(git:*), Bash(mkdir:*), Read, Write, Edit
---

# Visual Proof (vscode-backlog-md)

Capture and document visual/behavioral changes with a verifiable showboat doc. Three paths, each with a clear "when":

| Scenario                                                                           | Use                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Component layout, theme variation, empty/error states                              | Vite fixture + agent-browser                            |
| End-to-end extension behavior (click → file opens, status writes, cross-view sync) | CDP-driven real VS Code                                 |
| Before/after file content (frontmatter format, writer output)                      | `showboat exec` (no browser)                            |
| PR demo for a UI change                                                            | Vite fixture if component-only; CDP if behavior matters |

Heuristic: if the proof answers "what does this _look_ like?", fixtures are enough. If it answers "does clicking X actually do Y?", use CDP.

## Prerequisites

- `uvx showboat --version` works (`uv` is pinned in `mise.toml`; run `mise install` if missing).
- `bun run build` has run recently so `dist/extension.js` and `dist/webview/*` exist.
- For CDP: VS Code cached at `.vscode-test/` — if not, run `bun run test:e2e` once to download it. On headless Linux, wrap CDP invocations with `xvfb-run -a --server-args="-screen 0 1920x1080x24"`.
- `agent-browser` is already available in this repo (see `.claude/skills/agent-browser/SKILL.md`).

## Capture method 1: Vite fixture + agent-browser

Fast path (~seconds per screenshot). The fixture server hosts compiled webview bundles at `http://localhost:5173` with VS Code mocked and theme CSS pre-loaded. **Limitation:** the mock only captures `postMessage`; actions requiring the extension host (opening a file in the editor, writing to disk) won't complete. Use CDP for those.

### Pages served

| URL                                         | Webview                    | Inject to render                   |
| ------------------------------------------- | -------------------------- | ---------------------------------- |
| `http://localhost:5173/tasks.html`          | Kanban / list / dashboard  | `statusesUpdated` + `tasksUpdated` |
| `http://localhost:5173/task-detail.html`    | Task editor                | `taskData`                         |
| `http://localhost:5173/task-preview.html`   | Sidebar preview            | `tasksUpdated` + `selectTask`      |
| `http://localhost:5173/content-detail.html` | Document / decision viewer | `documentData` or `decisionData`   |

### postMessage shapes (from `src/core/types.ts`, `src/webview/lib/types.ts`)

```js
// Kanban / list view — send statuses first, then tasks
window.postMessage({
  type: 'statusesUpdated',
  statuses: ['Draft', 'To Do', 'In Progress', 'Done'],
}, '*');
window.postMessage({
  type: 'tasksUpdated',
  tasks: [
    { id: 'TASK-1', title: 'Example', status: 'To Do', priority: 'medium',
      labels: ['feature'], assignee: [], dependencies: [],
      createdDate: '2026-04-20', updatedDate: '2026-04-20' },
  ],
}, '*');

// Dashboard — use the exact DashboardStats shape
window.postMessage({
  type: 'statsUpdated',
  stats: {
    totalTasks: 7, completedCount: 1,
    byStatus: { 'To Do': 2, 'In Progress': 3, 'Done': 1 },
    byPriority: { high: 1, medium: 4, low: 1 },
    milestones: [{ name: 'v1.0', total: 4, done: 1 }],
  },
}, '*');

// Task detail — see TaskDetailData in src/providers/TaskDetailProvider.ts
window.postMessage({
  type: 'taskData',
  data: { task: {/* ... */}, statuses: [...], uniqueLabels: [],
          uniqueAssignees: [], milestones: [], blocksTaskIds: [],
          linkableTasks: [], isBlocked: false,
          descriptionHtml: '<p>Demo</p>', planHtml: '',
          notesHtml: '', finalSummaryHtml: '' },
}, '*');
```

Copy real task shapes from `src/test/e2e/fixtures/test-workspace/backlog/tasks/` for higher-fidelity demos.

### Flow

```bash
# terminal 1: build + serve
bun run build
bun run webview:serve &   # port 5173, strictPort: true
SERVE_PID=$!

# terminal 2 (same shell is fine): drive the browser
agent-browser open http://localhost:5173/tasks.html
agent-browser eval "window.postMessage({ type: 'statusesUpdated', statuses: ['Draft','To Do','In Progress','Done'] }, '*')"
agent-browser eval "window.postMessage({ type: 'tasksUpdated', tasks: [/* ... */] }, '*')"
agent-browser screenshot tmp/screenshots/kanban-dark.png

# theme variation: edit the <link> in e2e/webview-fixtures/tasks.html
#   vscode-theme-dark-plus.css → vscode-theme-light-plus.css
# then reload and re-screenshot. Revert the HTML when done.

# cleanup
kill $SERVE_PID
```

### Viewport / layout

- Default is browser-wide; for sidebar dimensions: `agent-browser set viewport 400 600`.
- `agent-browser scroll right` scrolls the page body. For kanban board inner scroll: `agent-browser eval "document.querySelector('.kanban-board').scrollLeft = 300"`.
- Re-run `agent-browser snapshot -i` after any DOM change to refresh `@ref` IDs.

## Capture method 2: CDP-driven real VS Code

Full-fidelity path (~60s boot per invocation). Use when the proof needs a real extension host — clicking a workspace link and having VS Code actually open the file, status changes hitting disk, cross-view coordination between kanban and detail.

The driver script is at `.claude/skills/visual-proof/scripts/cdp-session.ts`. It reuses `src/test/cdp/lib/` primitives — same code path as `bun run test:cdp`. Single-invocation design: each run boots VS Code once, does one thing, tears down. Chain invocations for multi-step proofs.

### Actions

```bash
# Snapshot the kanban after extension ready
bun .claude/skills/visual-proof/scripts/cdp-session.ts \
  --action screenshot --output tmp/screenshots/kanban.png

# Open a task's detail panel and capture it
bun .claude/skills/visual-proof/scripts/cdp-session.ts \
  --action open-task --task-id TASK-1 \
  --output tmp/screenshots/task-1-detail.png

# Click a link inside a task description — captures before/after
bun .claude/skills/visual-proof/scripts/cdp-session.ts \
  --action click-link --task-id TASK-1 \
  --link-href './README.md#L10' \
  --output-dir tmp/screenshots/link-line-range

# Custom action: write your own script that gets the CDP handle + helpers
bun .claude/skills/visual-proof/scripts/cdp-session.ts \
  --action custom --script path/to/capture.ts --output tmp/out.png
```

### Custom scripts

A `--action custom` script must `export default async ({ vscode, output, helpers }) => { ... }`. Provided helpers: `cdpScreenshot`, `cdpEval`, `executeCommand`, `findWebviewByRole`, `evaluateInWebview`, `clearWebviewSessionCache`, `dismissNotifications`, `sleep`, `openTaskByIdInKanban`. See the script for the exact signature.

### Headless Linux

The script refuses to launch on Linux without `DISPLAY`. Wrap with:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  bun .claude/skills/visual-proof/scripts/cdp-session.ts --action screenshot --output tmp/screenshots/x.png
```

### Workspace fixture

Default is `--workspace fixture`, which copies `src/test/e2e/fixtures/test-workspace` (~10 pre-seeded tasks) to a fresh temp dir and cleans it up on exit. Pass `--workspace /path/to/real/dir` to use your own. Pass `--keep-workspace` for post-mortem inspection.

## Building the proof document

Always use `uvx showboat` CLI commands. Never edit the .md directly — `showboat verify` re-runs embedded commands to confirm they still produce the captured output. Direct edits break that guarantee.

```bash
# Initialize
uvx showboat init tmp/visual-proof.md "Visual proof: <what you changed>"
uvx showboat note tmp/visual-proof.md "Short summary of the change and why it matters."

# Add a screenshot with caption
uvx showboat image tmp/visual-proof.md tmp/screenshots/kanban.png
uvx showboat note tmp/visual-proof.md "Kanban view — before the change."

# Add verifiable command output (test results, file contents, diff)
uvx showboat exec tmp/visual-proof.md bash 'bun run test 2>&1 | tail -10'
uvx showboat exec tmp/visual-proof.md bash 'cat backlog/tasks/task-1\ -\ *.md'
uvx showboat exec tmp/visual-proof.md bash 'git diff --stat main..HEAD'

# Mistake? Remove the last entry and redo
uvx showboat pop tmp/visual-proof.md

# Verify later: re-runs every embedded exec and checks output hasn't drifted
uvx showboat verify tmp/visual-proof.md
```

### Before/after pattern

For comparisons (redesign, format change, behavior fix):

```bash
# Capture "before" state — stash, checkout main, or git worktree
git worktree add ../before main
cd ../before && bun run build
# ...produce tmp/before/*.png via the capture methods above...
cd - # return to your branch

# Capture "after" state
bun run build
# ...produce tmp/after/*.png...

uvx showboat init tmp/comparison.md "Before/after: <change>"
uvx showboat note tmp/comparison.md "## Kanban view"
uvx showboat image tmp/comparison.md tmp/before/kanban.png
uvx showboat note tmp/comparison.md "Before: inline arrays, date-only"
uvx showboat image tmp/comparison.md tmp/after/kanban.png
uvx showboat note tmp/comparison.md "After: block arrays, minute-precision timestamps"
```

### Output paths

- Screenshots: `tmp/screenshots/`, `tmp/before/`, `tmp/after/`
- Docs: `tmp/visual-proof.md`, `tmp/demo.md`, `tmp/comparison.md`

All of `tmp/` is already gitignored (see `.gitignore` line 11). Proof docs are transient artifacts — link them in PR descriptions rather than committing them.

## Example: file-format proof (no browser)

For changes that have no visible UI but do have verifiable file output (e.g., the serializer rewrite in PR #15), skip both capture methods and use pure `showboat exec`:

```bash
uvx showboat init tmp/pr15-proof.md "PR #15: canonical frontmatter serializer"
uvx showboat note tmp/pr15-proof.md "Demonstrates byte-for-byte match with upstream Backlog.md after a no-op task edit."

uvx showboat exec tmp/pr15-proof.md bash 'git show main:backlog/tasks/task-1*.md | head -20'
uvx showboat note tmp/pr15-proof.md "Before: inline arrays, date-only updated_date."

# perform a no-op update via the extension or MCP...
uvx showboat exec tmp/pr15-proof.md bash 'cat backlog/tasks/task-1*.md | head -20'
uvx showboat note tmp/pr15-proof.md "After: block arrays, quoted dates with HH:MM — matches upstream serializeTask output."

uvx showboat exec tmp/pr15-proof.md bash 'diff <(git show main:backlog/tasks/task-1*.md) backlog/tasks/task-1*.md || true'
```

## Troubleshooting

- **"Extension did not activate within 60000ms"** — usually means the cached VS Code in `.vscode-test/` is older than the extension's `engines.vscode` floor. The launcher auto-redownloads latest stable VS Code when the cached binary is too old, so this should self-heal; if it doesn't, `rm -rf .vscode-test/VSCode-linux-x64 && bun run test:e2e` to force a fresh download. The script prints a diagnostic failure screenshot alongside the requested output path (`<name>-failure.png`) — check it to see what VS Code is actually showing.
- **Chromium sandbox error on launch** — the launcher already passes `--no-sandbox`, so this shouldn't hit. If it does, you're running the binary directly; always go through the script.
- **Agent-browser captured empty page** — the Vite fixture server must be running _before_ `agent-browser open`, and the fixture expects data to be injected via `postMessage` after navigation. `agent-browser snapshot -i` after injection to confirm elements rendered.

### Known limitation: `click-link` on headless Linux CDP

The `--action click-link` dispatches a synthetic click on the target anchor. The webview's Svelte handler fires (the anchor's `preventDefault()` runs, confirming the intercept). For **intra-extension** round-trips — status changes, task selection, priority updates, button-triggered postMessages, drag-and-drop — this works reliably and the extension host processes the message correctly.

For the narrow case of **workspace-relative link clicks that trigger `vscode.commands.executeCommand('vscode.open', uri)` from the extension host** (the extension asks VS Code to open an external file in an editor tab), the round-trip does NOT complete on headless Linux + CDP. We tried synthetic `MouseEvent` dispatch, `element.click()`, focus + synthetic `KeyboardEvent(Enter)`, real `Input.dispatchKeyEvent`, and real `Input.dispatchMouseEvent` at both screen coordinates and webview-local coordinates via the webview's own CDP session — none trigger the file-open. The same interaction works fine with a real user click in a normal VS Code window (confirmed manually).

**What this means for PR proof:**

- **Intra-extension interactions** → `click-link` or `custom` action captures the full round-trip reliably.
- **Link-click → external file opens in editor tab** → capture the before-state (task description with rendered links) via `click-link`; the "after" will show the focused link but the editor area will still be empty. Note this limitation in the proof doc and validate manually in a real VS Code window.

If you find a workaround, please update this section — it's likely some transient-user-activation gate in Electron's input pipeline that only real OS-level input satisfies.

## When NOT to use this skill

- Pure logic changes with no visible surface (type tweaks, internal refactors, test-only edits) — skip the proof.
- Trivial doc-only edits — a diff is enough.
- Changes already covered by a unit/Playwright/CDP test — let those tests be the proof.

The value of visual-proof is in PR artifacts, demos, and before/after comparisons. Don't force it for every change.

---
id: TASK-163
title: Add workspace tab strip for multi-root backlog switching in Tasks webview
status: Done
assignee:
  - '@claude'
created_date: '2026-05-14 13:02'
updated_date: '2026-05-14 18:00'
labels:
  - feature
  - ux
  - multi-workspace
dependencies: []
references:
  - src/core/BacklogWorkspaceManager.ts
  - src/extension.ts
  - src/providers/TasksViewProvider.ts
  - src/webview/components/tasks/Tasks.svelte
  - src/webview/components/shared/TabBar.svelte
  - src/core/types.ts
documentation: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a `.code-workspace` has multiple folders each containing a `backlog/` directory (e.g. `jobbu` and `Backlog.md-jobbu`), `BacklogWorkspaceManager.discover()` already finds both roots. Currently the only way to switch is the status bar Quick Pick — the webview knows nothing about available roots.

Add a **workspace tab strip** to `Tasks.svelte` that appears above the view-mode TabBar when `roots.length > 1`. Each tab shows the workspace folder name. Clicking fires `selectRoot` → `BacklogWorkspaceManager.setActiveRoot()` → existing `switchActiveBacklog()` refresh. Tasks from different boards are never mixed. Single-workspace users see no change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the workspace has 2+ backlog roots, a workspace tab strip renders above the view-mode TabBar inside the Tasks webview
- [x] #2 Each workspace tab shows the workspace folder name (e.g. 'jobbu', 'Backlog.md-jobbu') from BacklogRoot.label
- [x] #3 The active workspace tab is visually distinct: bold label and a colored bottom border using --vscode-focusBorder
- [x] #4 Clicking an inactive workspace tab switches the active backlog root — all views (tasks, statuses, milestones, project name) update from the new board
- [x] #5 Tasks from different boards are never shown simultaneously — the active-root invariant is preserved
- [x] #6 When the workspace has exactly 1 backlog root the workspace tab strip is not rendered (no visual regression for single-workspace users)
- [x] #7 The status bar workspace Quick Pick switcher continues to work and stays in sync with the webview tab state
- [x] #8 The extension sends a rootsUpdated message (roots list + activeBacklogPath) to the webview on every switchActiveBacklog call and at the start of every refresh()
- [x] #9 A selectRoot message from the webview triggers BacklogWorkspaceManager.setActiveRoot() for the matching root
- [x] #10 The new selectRoot and rootsUpdated message types are fully typed in WebviewMessage / ExtensionMessage in src/core/types.ts
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Architecture

`BacklogWorkspaceManager.discover()` already finds all roots. The only missing piece is surfacing them in the webview. Changes:

1. **Two new message types** in `src/core/types.ts`:
   - `WebviewMessage`: `| { type: 'selectRoot'; backlogPath: string }`
   - `ExtensionMessage`: `| { type: 'rootsUpdated'; roots: Array<{ label: string; backlogPath: string }>; activeBacklogPath: string }`

2. **`WorkspaceTabs.svelte`** — new Svelte 5 component above `<TabBar>` in `Tasks.svelte`, hidden when `roots.length <= 1`. Active tab: `class:active` + `--vscode-focusBorder` bottom border.

3. **`TasksViewProvider` additions**: `sendRoots()`, `setRootSelectionHandler()`, `case 'selectRoot'` in `handleMessage`, roots re-send at top of `refresh()`.

4. **`extension.ts` wiring**: `sendRootsToTasksProvider()` helper in `switchActiveBacklog()` and after activation; `setRootSelectionHandler` → `manager.setActiveRoot(root)`.

---

## Env / Tooling Constraints (non-negotiable)

- **All source reads/writes via Serena MCP** — `read_file`, `replace_content`, `replace_symbol_body`, `insert_after_symbol`. Never Read/Edit/Write/Bash for source files.
- **Activate Serena first**: `mcp__plugin_serena_serena__activate_project({ project: "/home/jo/kit/claude-code-llm-kram/vscode-backlog-md" })`. Access worktree files via relative paths: `worktrees/task-163-workspace-tabs/src/...`
- **Backlog CLI**: `~/.bun/bin/backlog` (set `BACKLOG=~/.bun/bin/backlog`)
- **Bash only for**: git, `bun test/run/build`, backlog CLI
- **TDD**: write failing tests (RED), confirm RED output, then implement (GREEN)
- **Svelte autofixer mandatory**: after every Svelte write/edit call `mcp__svelte__svelte-autofixer` and fix all issues before proceeding
- **AC/DoD check-off**: immediately after each verified item — not batch at end
- **`--final-summary` mandatory** at task close — always heredoc

---

## Step 0: Worktree + Setup

```bash
git fetch origin && git log origin/main..HEAD --oneline   # expect clean
git worktree add ./worktrees/task-163-workspace-tabs origin/main
cd ./worktrees/task-163-workspace-tabs && bun install --frozen-lockfile
BACKLOG=~/.bun/bin/backlog
$BACKLOG task edit TASK-163 --status "In Progress" --assignee "@claude"
```

Activate Serena before any file access:
```
mcp__plugin_serena_serena__initial_instructions()
mcp__plugin_serena_serena__activate_project({ project: "/home/jo/kit/claude-code-llm-kram/vscode-backlog-md" })
```

---

## Step 1: types.ts — add message types

Use Serena to read `src/core/types.ts`. Find the `WebviewMessage` union closing `;`, insert before it:
```typescript
  | { type: 'selectRoot'; backlogPath: string }
```
Find the `ExtensionMessage` union closing `;`, insert before it:
```typescript
  | {
      type: 'rootsUpdated';
      roots: Array<{ label: string; backlogPath: string }>;
      activeBacklogPath: string;
    }
```
Verify: `bun run typecheck 2>&1`

---

## Step 2: Unit tests for TasksViewProvider (RED)

Read `src/test/unit/TasksViewProvider.test.ts` with Serena to understand mock setup (`extensionUri`, `mockContext`, `_view` assignment). Add `describe('workspace roots messaging')` with 4 tests:

**Test 1 — sendRoots posts rootsUpdated:**
```typescript
it('sendRoots posts rootsUpdated message with correct shape', () => {
  const provider = new TasksViewProvider(extensionUri, undefined, mockContext);
  const posted: unknown[] = [];
  (provider as any)['_view'] = { webview: { postMessage: (m: unknown) => { posted.push(m); return Promise.resolve(true); }, onDidReceiveMessage: () => ({ dispose: () => {} }), cspSource: '', asWebviewUri: (u: vscode.Uri) => u, options: {}, html: '' } } as unknown as vscode.WebviewView;
  provider.sendRoots([{ label: 'jobbu', backlogPath: '/ws/jobbu/backlog' }, { label: 'other', backlogPath: '/ws/other/backlog' }], '/ws/jobbu/backlog');
  const msg = posted.find((m: any) => m.type === 'rootsUpdated') as any;
  expect(msg).toBeDefined();
  expect(msg.roots).toHaveLength(2);
  expect(msg.activeBacklogPath).toBe('/ws/jobbu/backlog');
});
```

**Test 2 — sendRoots with empty array:**
```typescript
it('sendRoots with empty roots posts rootsUpdated with empty array', () => {
  const provider = new TasksViewProvider(extensionUri, undefined, mockContext);
  const posted: unknown[] = [];
  (provider as any)['_view'] = { webview: { postMessage: (m: unknown) => { posted.push(m); return Promise.resolve(true); }, onDidReceiveMessage: () => ({ dispose: () => {} }), cspSource: '', asWebviewUri: (u: vscode.Uri) => u, options: {}, html: '' } } as unknown as vscode.WebviewView;
  provider.sendRoots([], '');
  const msg = posted.find((m: any) => m.type === 'rootsUpdated') as any;
  expect(msg?.roots).toHaveLength(0);
});
```

**Test 3 — selectRoot calls handler:**
```typescript
it('handleMessage selectRoot calls the registered handler', async () => {
  const provider = new TasksViewProvider(extensionUri, undefined, mockContext);
  let captured: string | undefined;
  provider.setRootSelectionHandler((p) => { captured = p; });
  await (provider as any).handleMessage({ type: 'selectRoot', backlogPath: '/ws/other/backlog' });
  expect(captured).toBe('/ws/other/backlog');
});
```

**Test 4 — selectRoot with no handler does not throw:**
```typescript
it('handleMessage selectRoot with no handler does not throw', async () => {
  const provider = new TasksViewProvider(extensionUri, undefined, mockContext);
  await expect((provider as any).handleMessage({ type: 'selectRoot', backlogPath: '/x' })).resolves.not.toThrow();
});
```

Confirm RED: `bun run test 2>&1 | grep -A3 "workspace roots"`
(Expect: `sendRoots is not a function`)

---

## Step 3: Implement TasksViewProvider (GREEN)

Use Serena `get_symbols_overview` on `src/providers/TasksViewProvider.ts` to find line numbers.

**3a — Add private fields** after `private readonly writer = new BacklogWriter();`:
```typescript
private backlogRoots: Array<{ label: string; backlogPath: string }> = [];
private activeRootPath: string = '';
private rootSelectionHandler?: (backlogPath: string) => void;
```

**3b — Add public methods** via `insert_after_symbol` after `setWorkspaceRoot`:
```typescript
setRootSelectionHandler(handler: (backlogPath: string) => void): void {
  this.rootSelectionHandler = handler;
}

sendRoots(roots: Array<{ label: string; backlogPath: string }>, activeBacklogPath: string): void {
  this.backlogRoots = roots;
  this.activeRootPath = activeBacklogPath;
  this.postMessage({ type: 'rootsUpdated', roots, activeBacklogPath });
}
```

**3c — Add case in handleMessage:**
```typescript
case 'selectRoot':
  this.rootSelectionHandler?.(message.backlogPath);
  break;
```

**3d — Re-send roots at top of refresh() try block:**
```typescript
if (this.backlogRoots.length > 0) {
  this.postMessage({ type: 'rootsUpdated', roots: this.backlogRoots, activeBacklogPath: this.activeRootPath });
}
```

Confirm GREEN: `bun run test 2>&1 | grep -E "workspace roots|✓|✗"`
```bash
$BACKLOG task edit TASK-163 --check-ac 8
$BACKLOG task edit TASK-163 --check-ac 9
```

---

## Step 4: Wire extension.ts

Read relevant section of `src/extension.ts` with Serena around `switchActiveBacklog` and `updateWorkspaceStatusBar`.

**4a — Add helper** after `updateWorkspaceStatusBar`:
```typescript
function sendRootsToTasksProvider() {
  const roots = manager.getRoots().map((r) => ({ label: r.label, backlogPath: r.backlogPath }));
  const activeBacklogPath = manager.getActiveRoot()?.backlogPath ?? '';
  tasksProvider.sendRoots(roots, activeBacklogPath);
}
```

**4b — Wire handler** after `const tasksProvider = new TasksViewProvider(...)`:
```typescript
tasksProvider.setRootSelectionHandler((backlogPath) => {
  const root = manager.getRoots().find((r) => r.backlogPath === backlogPath);
  if (root) manager.setActiveRoot(root);
});
```

**4c — Call in `switchActiveBacklog`** at the end, after `updateWorkspaceStatusBar(manager)`:
```typescript
sendRootsToTasksProvider();
```

**4d — Call after initial activation** after the existing `updateWorkspaceStatusBar(manager)`:
```typescript
sendRootsToTasksProvider();
```

Verify: `bun run typecheck 2>&1`

---

## Step 5: Playwright tests (RED)

Read 1–2 existing `e2e/*.test.ts` files with Serena to understand: fixture URL, `installVsCodeMock` import, `postMessage` injection pattern, captured messages pattern. Create `e2e/workspace-tabs.test.ts`:

```typescript
import { test, expect } from '@playwright/test';
// adapt imports to match existing e2e test files

test.describe('WorkspaceTabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks.html');
    await page.waitForSelector('#app', { state: 'attached' });
    // install vscode mock — copy exact pattern from existing tests
  });

  test('tab strip hidden with single root', async ({ page }) => {
    await page.evaluate(() => window.postMessage({ type: 'rootsUpdated', roots: [{ label: 'x', backlogPath: '/x/backlog' }], activeBacklogPath: '/x/backlog' }, '*'));
    await page.waitForTimeout(150);
    await expect(page.locator('[data-testid="workspace-tabs"]')).not.toBeVisible();
  });

  test('tab strip renders with two roots', async ({ page }) => {
    await page.evaluate(() => window.postMessage({ type: 'rootsUpdated', roots: [{ label: 'jobbu', backlogPath: '/ws/jobbu/backlog' }, { label: 'Backlog.md-jobbu', backlogPath: '/ws/other/backlog' }], activeBacklogPath: '/ws/jobbu/backlog' }, '*'));
    await page.waitForTimeout(150);
    await expect(page.locator('[data-testid="workspace-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-tab-jobbu"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-tab-Backlog.md-jobbu"]')).toBeVisible();
  });

  test('active tab has active class', async ({ page }) => {
    await page.evaluate(() => window.postMessage({ type: 'rootsUpdated', roots: [{ label: 'jobbu', backlogPath: '/ws/jobbu/backlog' }, { label: 'other', backlogPath: '/ws/other/backlog' }], activeBacklogPath: '/ws/jobbu/backlog' }, '*'));
    await page.waitForTimeout(150);
    await expect(page.locator('[data-testid="workspace-tab-jobbu"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="workspace-tab-other"]')).not.toHaveClass(/active/);
  });

  test('clicking inactive tab posts selectRoot', async ({ page }) => {
    // set up message capture — copy pattern from existing tests
    await page.evaluate(() => window.postMessage({ type: 'rootsUpdated', roots: [{ label: 'jobbu', backlogPath: '/ws/jobbu/backlog' }, { label: 'other', backlogPath: '/ws/other/backlog' }], activeBacklogPath: '/ws/jobbu/backlog' }, '*'));
    await page.waitForTimeout(150);
    await page.locator('[data-testid="workspace-tab-other"]').click();
    await page.waitForTimeout(150);
    // assert selectRoot message with backlogPath === '/ws/other/backlog' was posted
    // using project's captured-messages helper
  });
});
```

Confirm RED: `bun run build 2>&1 && bun run test:playwright 2>&1 | grep -E "workspace-tabs|Error"`

---

## Step 6: Create WorkspaceTabs.svelte (GREEN)

Use Serena `create_text_file` for `src/webview/components/tasks/WorkspaceTabs.svelte`:

```svelte
<script lang="ts">
  interface Root { label: string; backlogPath: string; }
  let { roots, activeBacklogPath, onRootChange }: {
    roots: Root[];
    activeBacklogPath: string;
    onRootChange: (backlogPath: string) => void;
  } = $props();
</script>

{#if roots.length > 1}
  <div class="workspace-tabs" data-testid="workspace-tabs" role="tablist" aria-label="Workspace">
    {#each roots as root (root.backlogPath)}
      <button
        class="workspace-tab"
        class:active={root.backlogPath === activeBacklogPath}
        data-testid="workspace-tab-{root.label}"
        role="tab"
        aria-selected={root.backlogPath === activeBacklogPath}
        title={root.backlogPath}
        onclick={() => onRootChange(root.backlogPath)}
      >{root.label}</button>
    {/each}
  </div>
{/if}

<style>
  .workspace-tabs {
    display: flex; gap: 1px; padding: 4px 8px 0;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-sideBarSectionHeader-border, transparent));
    flex-shrink: 0; overflow-x: auto;
  }
  .workspace-tab {
    padding: 3px 10px 4px; border: none; background: transparent;
    color: var(--vscode-tab-inactiveForeground, var(--vscode-foreground));
    font-size: 11px; font-family: var(--vscode-font-family);
    cursor: pointer; border-bottom: 2px solid transparent;
    white-space: nowrap; border-radius: 3px 3px 0 0; opacity: 0.75;
  }
  .workspace-tab:hover {
    color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
    background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.1)); opacity: 1;
  }
  .workspace-tab.active {
    color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
    border-bottom-color: var(--vscode-focusBorder, var(--vscode-panelTitle-activeBorder));
    font-weight: 600; opacity: 1;
  }
  .workspace-tab:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
</style>
```

**MANDATORY**: run `mcp__svelte__svelte-autofixer` on full file content and fix every issue before Step 7.

---

## Step 7: Integrate into Tasks.svelte

Use Serena `get_symbols_overview` on `src/webview/components/tasks/Tasks.svelte` for exact line numbers.

Add import: `import WorkspaceTabs from './WorkspaceTabs.svelte';`

Add state:
```typescript
let roots = $state<Array<{ label: string; backlogPath: string }>>([]);
let activeBacklogPath = $state('');
```

Add to `onMessage` switch:
```typescript
case 'rootsUpdated':
  roots = message.roots;
  activeBacklogPath = message.activeBacklogPath;
  break;
```

Add handler:
```typescript
function handleRootChange(backlogPath: string) {
  vscode.postMessage({ type: 'selectRoot', backlogPath });
}
```

Insert in template directly above `<TabBar`:
```svelte
<WorkspaceTabs {roots} {activeBacklogPath} onRootChange={handleRootChange} />
```

**MANDATORY**: run `mcp__svelte__svelte-autofixer` on full Tasks.svelte and fix all issues.

Build + Playwright: `bun run build 2>&1 && bun run test:playwright 2>&1`

When GREEN:
```bash
$BACKLOG task edit TASK-163 --check-ac 1
$BACKLOG task edit TASK-163 --check-ac 2
$BACKLOG task edit TASK-163 --check-ac 3
$BACKLOG task edit TASK-163 --check-ac 4
$BACKLOG task edit TASK-163 --check-ac 5
$BACKLOG task edit TASK-163 --check-ac 6
$BACKLOG task edit TASK-163 --check-ac 7
$BACKLOG task edit TASK-163 --check-ac 10
```

---

## Step 8: Full CI

```bash
bun run test 2>&1 && $BACKLOG task edit TASK-163 --check-dod 1
bun run lint 2>&1 && $BACKLOG task edit TASK-163 --check-dod 2
bun run typecheck 2>&1 && $BACKLOG task edit TASK-163 --check-dod 3
bun run build 2>&1 && bun run test:playwright 2>&1 && $BACKLOG task edit TASK-163 --check-dod 4
```

---

## Step 9: Visual Proof

Run `.claude/skills/visual-proof/` skill. Capture: (1) 2 roots injected — strip visible, active tab highlighted; (2) 1 root injected — no strip.
```bash
$BACKLOG task edit TASK-163 --check-dod 5
```

---

## Step 10: Commit + PR

```bash
cd worktrees/task-163-workspace-tabs
git checkout -b tasks/task-163-workspace-tabs
git add src/core/types.ts src/providers/TasksViewProvider.ts src/extension.ts \
        src/webview/components/tasks/WorkspaceTabs.svelte \
        src/webview/components/tasks/Tasks.svelte \
        e2e/workspace-tabs.test.ts src/test/unit/TasksViewProvider.test.ts
git commit -m "$(cat <<'EOF'
Add workspace tab strip for multi-root backlog switching

- WorkspaceTabs.svelte: tab strip above TabBar, shown only when 2+ roots discovered
- rootsUpdated/selectRoot message types added to types.ts
- TasksViewProvider: sendRoots(), setRootSelectionHandler(), selectRoot handler, roots re-send in refresh()
- extension.ts: sendRootsToTasksProvider() wired into switchActiveBacklog and activation
- 4 unit tests + 4 Playwright webview tests

Completes TASK-163.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin tasks/task-163-workspace-tabs
gh pr create --title "TASK-163 - Add workspace tab strip for multi-root backlog switching" \
  --body "$(cat <<'EOF'
## Summary
- New WorkspaceTabs.svelte: workspace-selector strip above TabBar, hidden with single root
- rootsUpdated (ext→webview) + selectRoot (webview→ext) message types
- Clicking tab → BacklogWorkspaceManager.setActiveRoot() → switchActiveBacklog() — tasks never mixed
- Status bar Quick Pick continues to work alongside tabs

## Test plan
- [ ] bun run test — 4 new unit tests pass
- [ ] bun run test:playwright — 4 new Playwright tests pass
- [ ] bun run typecheck — no errors
- [ ] bun run lint — no warnings
- [ ] Manual: open jobbu.code-workspace → tab strip appears → switching tabs loads correct board

## Before / After
[paste visual-proof screenshots]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Step 11: Finalize

```bash
$BACKLOG task edit TASK-163 \
  --notes "$(cat <<'EOF'
Files changed:
- src/core/types.ts: selectRoot in WebviewMessage, rootsUpdated in ExtensionMessage
- src/providers/TasksViewProvider.ts: sendRoots, setRootSelectionHandler, selectRoot case, roots re-send in refresh
- src/extension.ts: sendRootsToTasksProvider helper, wired in switchActiveBacklog + activation
- src/webview/components/tasks/WorkspaceTabs.svelte: NEW
- src/webview/components/tasks/Tasks.svelte: roots state, rootsUpdated handler, WorkspaceTabs rendered
- e2e/workspace-tabs.test.ts: NEW — 4 Playwright tests
- src/test/unit/TasksViewProvider.test.ts: 4 new unit tests
EOF
)" \
  --final-summary "$(cat <<'EOF'
Implemented workspace tab strip for multi-root backlog switching. WorkspaceTabs.svelte appears above TabBar when 2+ roots exist; clicking switches via BacklogWorkspaceManager.setActiveRoot(). Tasks never mixed.
Commit: (fill in: git log --oneline -1)
PR: (fill in: gh pr view --json url -q .url)
EOF
)" \
  --status Done
```
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run test passes (including 4 new unit tests for TasksViewProvider workspace roots messaging)
- [x] #2 bun run test:playwright passes (including 4 new Playwright webview tests for WorkspaceTabs)
- [x] #3 bun run lint passes with no new warnings
- [x] #4 bun run typecheck passes with zero errors
- [x] #5 visual-proof screenshots of the tab strip (2-root state: both tabs visible, active tab highlighted; 1-root state: no strip) attached to the PR
<!-- DOD:END -->

## Implementation Notes

### Beyond original scope — added during implementation

These features were added as UX improvements discovered during implementation and testing:

- **Child directory scanning** in `BacklogWorkspaceManager.discover()` — when a workspace folder has no backlog directly, scans its direct child directories (skips dot-prefixed and node_modules) for backlogs. One level deep only.

- **Integration banner suppression for subdirectory backlogs** — the "Set up AI agent" banner is hidden when the backlog lives in a subdirectory rather than directly in the workspace root (`dirname(backlogPath) !== workspaceFolder.fsPath`).

- **`backlog.initInDirectory` command** (`TASK-163` follow-on) — scans the first workspace folder's child directories that don't have a backlog, shows a Quick Pick with "Browse for folder..." fallback, then runs the shared init wizard. Registered as `backlog.initInDirectory`.

- **`+` tab button in WorkspaceTabs.svelte** — triggers the `backlog.initInDirectory` flow. Appears at the end of the tab strip, only when `roots.length > 1`. Uses `onInitBacklog` callback prop, posts `initBacklogInDirectory` message to the extension.

- **`initBacklogInDirectory` message type** added to `WebviewMessage` union. Handled in `TasksViewProvider.handleMessage` → `vscode.commands.executeCommand('backlog.initInDirectory')`.

- **`getInitOptions` extraction** — the init wizard logic (project name, prefix, statuses, advanced settings) extracted into a standalone `async function getInitOptions(workspaceRoot, defaults?)` shared between `backlog.init` and `backlog.initInDirectory`.

- **`backlog.init` `directory` param** — when called with `{ directory: '/path' }`, skips workspace folder selection, uses the directory as workspace root for `initializeBacklog()`, uses directory basename as tab label.

- **`onDidChangeWorkspaceFolders` missing notification fix** — `startWatching()` now handles two missing cases: (1) first folders added after empty window start → sets first root as active, (2) more folders added to existing workspace → re-fires active root event to update webview root list. `switchActiveBacklog()` early-returns with just `sendRootsToTasksProvider()` when root path unchanged.

### Files changed (cumulative)

- `src/core/types.ts` — `selectRoot` + `initBacklogInDirectory` in `WebviewMessage`, `rootsUpdated` in `ExtensionMessage`
- `src/providers/TasksViewProvider.ts` — `sendRoots()`, `setRootSelectionHandler()`, `selectRoot` + `initBacklogInDirectory` cases, roots re-send in `refresh()`
- `src/extension.ts` — `sendRootsToTasksProvider()`, `getInitOptions()` helper, `backlog.init` `directory` param, `backlog.initInDirectory` command, integration banner guard in init, efficient early-return in `switchActiveBacklog`
- `src/core/BacklogWorkspaceManager.ts` — child directory scanning, `startWatching()` notifications for folder-add scenarios
- `src/webview/components/tasks/WorkspaceTabs.svelte` — NEW: tab strip component with `+` button
- `src/webview/components/tasks/Tasks.svelte` — `roots`/`activeBacklogPath` state, `rootsUpdated` handler, `handleRootChange`, `onInitBacklog` wiring
- `e2e/workspace-tabs.spec.ts` — 4 Playwright tests (renamed from `.test.ts`)
- `src/test/unit/TasksViewProvider.test.ts` — 4 unit tests for workspace roots messaging
- `src/test/unit/BacklogWorkspaceManager.test.ts` — 9 child-scanning tests

### Co-Authored-By

Claude Sonnet 4.6 & Claude Sonnet 4.7 & Gemini 2.5 Pro & Big Pickle & opencode

## Final Summary

Implemented workspace tab strip for multi-root backlog switching. WorkspaceTabs.svelte appears above TabBar when 2+ roots exist; clicking switches via BacklogWorkspaceManager.setActiveRoot(). Tasks never mixed.

Extended scope with child directory scanning, `backlog.initInDirectory` command, + tab button, integration banner suppression for subdirectory backlogs, and a fix for `onDidChangeWorkspaceFolders` notifications when folders are added after empty workspace start.

- Commit: 05c7a7b
- PR: https://github.com/ysamlan/vscode-backlog-md/pull/27

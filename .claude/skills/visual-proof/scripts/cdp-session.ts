#!/usr/bin/env bun
/**
 * visual-proof CDP driver: single-invocation helper that boots real VS Code
 * with the extension loaded, performs one scripted action (screenshot, link
 * click, task open, or a user-supplied custom script), and tears down cleanly.
 *
 * Modeled on scripts/screenshots/generate.ts — reuses the same CDP primitives
 * from src/test/cdp/lib/ so there is only one "how we drive VS Code" codepath.
 *
 * Usage:
 *   bun .claude/skills/visual-proof/scripts/cdp-session.ts \
 *     --action screenshot --output tmp/screenshots/kanban.png
 *
 *   bun .claude/skills/visual-proof/scripts/cdp-session.ts \
 *     --action open-task --task-id TASK-1 --output tmp/screenshots/detail.png
 *
 *   bun .claude/skills/visual-proof/scripts/cdp-session.ts \
 *     --action click-link --task-id TASK-1 \
 *     --link-href './README.md#L10' --output-dir tmp/screenshots
 *
 *   bun .claude/skills/visual-proof/scripts/cdp-session.ts \
 *     --action custom --script path/to/my-capture.ts --output tmp/my.png
 *
 * Each invocation is one boot of VS Code (~45–60s). For multiple captures,
 * invoke multiple times — matches how scripts/screenshots/generate.ts runs and
 * keeps showboat commands trivially chainable.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  launchVsCode,
  closeVsCode,
  type VsCodeInstance,
} from '../../../../src/test/cdp/lib/vscode-launcher';
import {
  cdpScreenshot,
  cdpEval,
  sleep,
  executeCommand,
  dismissNotifications,
} from '../../../../src/test/cdp/lib/cdp-helpers';
import {
  findWebviewByRole,
  evaluateInWebview,
  clickInWebview,
  clearWebviewSessionCache,
} from '../../../../src/test/cdp/lib/webview-helpers';
import { waitForExtensionReady } from '../../../../src/test/cdp/lib/wait-helpers';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
} from '../../../../src/test/cdp/lib/test-workspace';

type Action = 'screenshot' | 'open-task' | 'click-link' | 'custom';

interface Options {
  workspace: string; // "fixture" or absolute path
  action: Action;
  output?: string;
  outputDir?: string;
  taskId?: string;
  linkHref?: string;
  scriptPath?: string;
  cdpPort: number;
  keepWorkspace: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    workspace: 'fixture',
    action: 'screenshot',
    cdpPort: 9341,
    keepWorkspace: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--workspace':
        opts.workspace = next;
        i++;
        break;
      case '--action':
        opts.action = next as Action;
        i++;
        break;
      case '--output':
        opts.output = next;
        i++;
        break;
      case '--output-dir':
        opts.outputDir = next;
        i++;
        break;
      case '--task-id':
        opts.taskId = next;
        i++;
        break;
      case '--link-href':
        opts.linkHref = next;
        i++;
        break;
      case '--script':
        opts.scriptPath = next;
        i++;
        break;
      case '--port':
        opts.cdpPort = parseInt(next, 10);
        i++;
        break;
      case '--keep-workspace':
        opts.keepWorkspace = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  const validActions: Action[] = ['screenshot', 'open-task', 'click-link', 'custom'];
  if (!validActions.includes(opts.action)) {
    console.error(`Invalid --action: ${opts.action}. Use ${validActions.join(', ')}.`);
    process.exit(1);
  }

  if (opts.action === 'open-task' && !opts.taskId) {
    console.error('--action open-task requires --task-id');
    process.exit(1);
  }
  if (opts.action === 'click-link' && (!opts.taskId || !opts.linkHref)) {
    console.error('--action click-link requires --task-id and --link-href');
    process.exit(1);
  }
  if (opts.action === 'custom' && !opts.scriptPath) {
    console.error('--action custom requires --script <path>');
    process.exit(1);
  }
  if (opts.action !== 'click-link' && !opts.output) {
    console.error(`--action ${opts.action} requires --output <png-path>`);
    process.exit(1);
  }
  if (opts.action === 'click-link' && !opts.outputDir) {
    console.error('--action click-link requires --output-dir (receives before.png + after.png)');
    process.exit(1);
  }

  return opts;
}

function printHelp(): void {
  console.log(`
visual-proof CDP driver — one boot of real VS Code per invocation.

Actions:
  screenshot      Capture the kanban view after extension is ready.
                    --output tmp/screenshots/kanban.png
  open-task       Open a task's detail panel and capture it.
                    --task-id TASK-1 --output tmp/screenshots/detail.png
  click-link      Open a task, snap "before", click a link in its description,
                  snap "after". Designed for workspace-link PR proofs.
                    --task-id TASK-1 --link-href './README.md#L10'
                    --output-dir tmp/screenshots
  custom          Load a user script and hand it the CDP instance.
                    --script path/to/capture.ts --output tmp/screenshots/x.png

Common flags:
  --workspace <fixture|absolute-path>   Default: fixture (copy of repo's
                                          src/test/e2e/fixtures/test-workspace).
  --port <number>                       CDP port. Default 9341.
  --keep-workspace                      Don't delete the temp workspace on exit.
  -h | --help                           This help.

Requirements:
  - VS Code cached at .vscode-test/ (run 'bun run test:e2e' once if missing).
  - DISPLAY set (or wrap with 'xvfb-run -a --server-args="-screen 0 1920x1080x24"'
    on headless Linux).
  - 'bun run build' must have run recently so dist/ has the extension to load.
`);
}

function ensureDisplay(): void {
  if (process.platform !== 'linux') return;
  if (process.env.DISPLAY) return;
  console.error(
    'No DISPLAY set on Linux. Wrap this command with:\n' +
      '  xvfb-run -a --server-args="-screen 0 1920x1080x24" <your command>\n' +
      'or export DISPLAY and start an X server yourself.'
  );
  process.exit(2);
}

async function actionScreenshot(vscode: VsCodeInstance, output: string): Promise<void> {
  await dismissNotifications(vscode.cdp);
  await sleep(500);
  await cdpScreenshot(vscode.cdp, output);
  console.log(`wrote ${output}`);
}

async function openTaskByIdInKanban(vscode: VsCodeInstance, taskId: string): Promise<void> {
  const clicked = await clickInWebview(vscode.cdp, 'tasks', `[data-testid="task-${taskId}"]`);
  if (!clicked) throw new Error(`Could not click task card for ${taskId}`);
  // Detail panel opens asynchronously; give it a beat to render.
  await sleep(1500);
}

async function actionOpenTask(
  vscode: VsCodeInstance,
  taskId: string,
  output: string
): Promise<void> {
  await openTaskByIdInKanban(vscode, taskId);
  await cdpScreenshot(vscode.cdp, output);
  console.log(`wrote ${output}`);
}

async function actionClickLink(
  vscode: VsCodeInstance,
  taskId: string,
  linkHref: string,
  outputDir: string
): Promise<void> {
  await openTaskByIdInKanban(vscode, taskId);
  fs.mkdirSync(outputDir, { recursive: true });
  const before = path.join(outputDir, 'before.png');
  const after = path.join(outputDir, 'after.png');
  await cdpScreenshot(vscode.cdp, before);
  console.log(`wrote ${before}`);

  // The link may be in the full task-detail panel or the sidebar preview
  // depending on whether the user has opened the full panel yet.
  // Known limitation on headless Linux CDP: this click fires the Svelte
  // handler (preventDefault runs) but the resulting extension-host call
  // to `vscode.commands.executeCommand('vscode.open', uri)` doesn't
  // complete the file-open. See SKILL.md Troubleshooting for details.
  const clickScript = `
    const anchors = Array.from(doc.querySelectorAll('a'));
    const target = anchors.find(a => a.getAttribute('href') === ${JSON.stringify(linkHref)});
    if (!target) return 'link-not-found';
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return 'clicked';
  `;
  let result: unknown = 'no-session';
  for (const role of ['preview', 'detail'] as const) {
    const sessionId = await findWebviewByRole(vscode.cdp, role);
    if (!sessionId) continue;
    result = await evaluateInWebview(vscode.cdp, sessionId, clickScript);
    if (result === 'clicked') break;
  }
  if (result !== 'clicked') {
    throw new Error(
      `Could not click link "${linkHref}" in TASK ${taskId} (tried preview + detail webviews): ${String(result)}`
    );
  }
  // Editor open is async; give it room. Poll for an editor group becoming
  // non-empty before screenshotting.
  await sleep(500);
  const start = Date.now();
  while (Date.now() - start < 8000) {
    const hasEditor = await cdpEval(
      vscode.cdp,
      `!!document.querySelector('.editor-container .monaco-editor') ||
       !!document.querySelector('.editor-instance')`
    );
    if (hasEditor) break;
    await sleep(300);
  }
  await sleep(600);
  await cdpScreenshot(vscode.cdp, after);
  console.log(`wrote ${after}`);
}

async function actionCustom(
  vscode: VsCodeInstance,
  scriptPath: string,
  output: string | undefined
): Promise<void> {
  const resolved = path.resolve(scriptPath);
  const mod = (await import(resolved)) as {
    default?: (ctx: {
      vscode: VsCodeInstance;
      output: string | undefined;
      helpers: typeof helpers;
    }) => Promise<void>;
  };
  if (typeof mod.default !== 'function') {
    throw new Error(`${resolved} must export a default async function`);
  }
  await mod.default({ vscode, output, helpers });
}

const helpers = {
  cdpScreenshot,
  cdpEval,
  executeCommand,
  findWebviewByRole,
  evaluateInWebview,
  clearWebviewSessionCache,
  dismissNotifications,
  sleep,
  openTaskByIdInKanban,
};

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  ensureDisplay();

  let workspacePath: string;
  let createdWorkspace = false;
  if (opts.workspace === 'fixture') {
    workspacePath = createTestWorkspace(`visual-proof-${Date.now()}`);
    createdWorkspace = true;
    console.log(`created workspace: ${workspacePath}`);
  } else {
    workspacePath = path.resolve(opts.workspace);
    if (!fs.existsSync(workspacePath)) {
      console.error(`workspace does not exist: ${workspacePath}`);
      process.exit(1);
    }
    console.log(`using workspace: ${workspacePath}`);
  }

  console.log(`launching VS Code on port ${opts.cdpPort}...`);
  const vscode = await launchVsCode({
    workspacePath,
    cdpPort: opts.cdpPort,
  });

  // Ensure the spawned VS Code process and temp workspace are torn down on
  // Ctrl+C / SIGTERM — the `finally` block below only runs on normal return.
  const teardown = (): void => {
    try {
      closeVsCode(vscode);
    } catch {
      /* best effort */
    }
    if (createdWorkspace && !opts.keepWorkspace) {
      cleanupTestWorkspace(workspacePath);
    }
  };
  process.once('SIGINT', () => {
    teardown();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    teardown();
    process.exit(143);
  });

  let exitCode = 0;
  try {
    console.log('waiting for extension ready...');
    await waitForExtensionReady(vscode.cdp);
    console.log('extension ready');

    switch (opts.action) {
      case 'screenshot':
        await actionScreenshot(vscode, opts.output!);
        break;
      case 'open-task':
        await actionOpenTask(vscode, opts.taskId!, opts.output!);
        break;
      case 'click-link':
        await actionClickLink(vscode, opts.taskId!, opts.linkHref!, opts.outputDir!);
        break;
      case 'custom':
        await actionCustom(vscode, opts.scriptPath!, opts.output);
        break;
    }
  } catch (err) {
    console.error('action failed:', err instanceof Error ? err.message : err);
    exitCode = 1;
    // Best-effort diagnostic screenshot — helps debug activation/render failures.
    try {
      const diag =
        opts.output ??
        (opts.outputDir ? path.join(opts.outputDir, 'failure.png') : 'tmp/failure.png');
      const diagPath = diag.replace(/\.png$/, '-failure.png');
      await cdpScreenshot(vscode.cdp, diagPath);
      console.error(`diagnostic screenshot: ${diagPath}`);
    } catch {
      /* ignore */
    }
  } finally {
    closeVsCode(vscode);
    if (createdWorkspace && !opts.keepWorkspace) {
      cleanupTestWorkspace(workspacePath);
    }
  }

  process.exit(exitCode);
}

void main();

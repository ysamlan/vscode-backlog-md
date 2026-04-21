/**
 * VS Code binary detection, launch, and CDP connection.
 *
 * Extracted and adapted from scripts/screenshots/generate.ts.
 */

import { spawn, execSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CdpClient } from './CdpClient';
import { sleep } from './cdp-helpers';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

export interface VsCodeInstance {
  proc: ChildProcess;
  cdp: CdpClient;
  cdpPort: number;
}

export interface LaunchOptions {
  workspacePath: string;
  cdpPort?: number;
  userDataDir?: string;
  /** Extra CLI args passed to VS Code */
  extraArgs?: string[];
  /**
   * If true (default), verify the cached VS Code binary satisfies the
   * extension's `engines.vscode` requirement and auto-redownload latest
   * stable Linux x64 if it doesn't. Set false to keep whatever's cached
   * (useful for offline/pinned testing). macOS and fallback system binaries
   * are checked but never auto-replaced.
   */
  autoUpgradeBinary?: boolean;
}

/**
 * Read the extension's required VS Code version from the project's
 * package.json (the leading `^` is stripped; semver ranges wider than caret
 * are not supported here — just a minimum floor).
 */
function requiredVsCodeVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')) as {
    engines?: { vscode?: string };
  };
  const raw = pkg.engines?.vscode ?? '';
  return raw.replace(/^[^0-9]*/, '').trim();
}

/** Read the version string out of an extracted VS Code app bundle. */
function readVsCodeBinaryVersion(binaryPath: string): string | null {
  // macOS: .../Contents/MacOS/Electron — package.json is at Contents/Resources/app/package.json.
  // Linux: .../VSCode-linux-x64/code — package.json is at VSCode-linux-x64/resources/app/package.json.
  const candidates = [
    path.join(path.dirname(binaryPath), '..', 'Resources', 'app', 'package.json'),
    path.join(path.dirname(binaryPath), 'resources', 'app', 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const meta = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { version?: string };
      if (meta.version) return meta.version;
    } catch {
      /* try next */
    }
  }
  return null;
}

function compareSemver(a: string, b: string): number {
  const [am, an, ap] = a.split('.').map((n) => parseInt(n, 10) || 0);
  const [bm, bn, bp] = b.split('.').map((n) => parseInt(n, 10) || 0);
  return am - bm || an - bn || ap - bp;
}

/**
 * Download latest stable VS Code for linux-x64 into `.vscode-test/VSCode-linux-x64/`,
 * replacing whatever's there. Used as the auto-fix when the cached binary is
 * older than the extension's engine floor.
 */
function redownloadLinuxVsCode(): string {
  const targetDir = path.join(PROJECT_ROOT, '.vscode-test/VSCode-linux-x64');
  const tmpArchive = path.join(os.tmpdir(), `vscode-latest-${Date.now()}.tar.gz`);
  const extractTo = path.join(PROJECT_ROOT, '.vscode-test');

  console.log('[vscode-launcher] downloading latest-stable VS Code for linux-x64...');
  execSync(
    `curl -fsSL "https://update.code.visualstudio.com/latest/linux-x64/stable" -o "${tmpArchive}"`,
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  execSync(`tar -xzf "${tmpArchive}" -C "${extractTo}"`, {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  fs.rmSync(tmpArchive, { force: true });

  const newBin = path.join(targetDir, 'code');
  if (!fs.existsSync(newBin)) {
    throw new Error(`redownload produced no binary at ${newBin}`);
  }
  const newVersion = readVsCodeBinaryVersion(newBin) ?? 'unknown';
  console.log(`[vscode-launcher] fresh VS Code ${newVersion} installed at ${newBin}`);
  return newBin;
}

/**
 * Ensure the chosen VS Code binary is new enough to run the extension.
 * Returns a possibly-updated binary path (swapped to a fresh download if
 * auto-upgrade was necessary). Throws with a clear, actionable message if
 * upgrade is needed but impossible (wrong platform, `--no-auto-upgrade`, or
 * system binary that we shouldn't touch).
 */
export function ensureCompatibleVsCodeBinary(
  binary: string,
  opts: { autoUpgrade?: boolean } = {}
): string {
  const autoUpgrade = opts.autoUpgrade ?? true;
  const required = requiredVsCodeVersion();
  if (!required) return binary; // no engines.vscode floor declared

  const actual = readVsCodeBinaryVersion(binary);
  if (!actual) {
    console.warn(`[vscode-launcher] could not read version from ${binary}; continuing`);
    return binary;
  }
  if (compareSemver(actual, required) >= 0) {
    return binary;
  }

  const msg =
    `Cached VS Code binary at ${binary} is v${actual}, but this extension requires ` +
    `>= v${required} (package.json engines.vscode). The extension will silently refuse ` +
    `to activate in the dev host, which looks like a generic "extension didn't load" ` +
    `failure.`;

  // Auto-upgrade is only implemented for the project-managed Linux cache;
  // for macOS, system code binaries, and opted-out callers, surface a clear
  // error with the exact remediation.
  const isManagedLinux = binary === path.join(PROJECT_ROOT, '.vscode-test/VSCode-linux-x64/code');
  if (!autoUpgrade || !isManagedLinux) {
    throw new Error(
      `${msg}\n\nFix: download a fresh VS Code into .vscode-test/ (matches what CI does):\n` +
        `  rm -rf .vscode-test/VSCode-linux-x64 && \\\n` +
        `    curl -fsSL https://update.code.visualstudio.com/latest/linux-x64/stable \\\n` +
        `    | tar -xz -C .vscode-test\n` +
        `or pass --auto-upgrade (scripts that use launchVsCode default to on).`
    );
  }

  console.warn(`[vscode-launcher] ${msg}`);
  console.warn('[vscode-launcher] auto-upgrade enabled — redownloading...');
  return redownloadLinuxVsCode();
}

/** Find the VS Code / Code binary for the current platform */
export function findVsCodeBinary(): string {
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';

  if (isMac) {
    const macBin = path.join(
      PROJECT_ROOT,
      '.vscode-test/Visual Studio Code.app/Contents/MacOS/Electron'
    );
    if (fs.existsSync(macBin)) return macBin;
  }

  if (isLinux) {
    const linuxBin = path.join(PROJECT_ROOT, '.vscode-test/VSCode-linux-x64/code');
    if (fs.existsSync(linuxBin)) return linuxBin;
  }

  // Try system VS Code as fallback
  try {
    const systemCode = execSync('which code', { encoding: 'utf-8' }).trim();
    const resolved = fs.realpathSync(systemCode);
    if (isMac) {
      const electronBin = path.join(path.dirname(resolved), '..', 'MacOS', 'Electron');
      if (fs.existsSync(electronBin)) return electronBin;
    }
    return resolved;
  } catch {
    // No system VS Code
  }

  throw new Error(
    `Could not find VS Code binary for ${process.platform}. ` +
      'Run "bun run test:e2e" first to download it.'
  );
}

/** Poll the CDP /json/list endpoint until a page target appears */
export async function waitForCdpReady(port: number, timeoutMs = 30_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = (await resp.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
      const page = list.find((e) => e.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Not ready yet
    }
    await sleep(500);
  }
  throw new Error(`CDP not ready after ${timeoutMs}ms on port ${port}`);
}

/** Launch VS Code with CDP debugging and return a connected instance */
export async function launchVsCode(opts: LaunchOptions): Promise<VsCodeInstance> {
  const initialBinary = findVsCodeBinary();
  const binary = ensureCompatibleVsCodeBinary(initialBinary, {
    autoUpgrade: opts.autoUpgradeBinary ?? true,
  });
  const cdpPort = opts.cdpPort ?? 9340;
  const userDataDir =
    opts.userDataDir ?? path.join(PROJECT_ROOT, '.vscode-test/settings/cdp-tests');

  // Clean user-data-dir to eliminate cached state
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  // Write minimal settings and keybindings
  const userDir = path.join(userDataDir, 'User');
  fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDir, 'settings.json'),
    JSON.stringify(
      {
        'workbench.startupEditor': 'none',
        'extensions.autoUpdate': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'window.restoreWindows': 'none',
        'workbench.tips.enabled': false,
        'workbench.enableExperiments': false,
        'git.enabled': false,
        'chat.commandCenter.enabled': false,
        'chat.editor.enabled': false,
        'chat.agent.enabled': false,
        'workbench.secondarySideBar.showLabels': false,
        'workbench.auxiliaryActivityBar.location': 'hidden',
        'security.workspace.trust.enabled': false,
        'extensions.ignoreRecommendations': true,
      },
      null,
      2
    )
  );

  // Register keybindings for commands used in tests (avoids slow command palette typing)
  fs.writeFileSync(
    path.join(userDir, 'keybindings.json'),
    JSON.stringify(
      [
        { key: 'ctrl+shift+alt+k', command: 'backlog.openKanban' },
        { key: 'ctrl+shift+alt+r', command: 'backlog.refresh' },
        { key: 'ctrl+shift+alt+l', command: 'backlog.showListView' },
        { key: 'ctrl+shift+alt+b', command: 'backlog.showKanbanView' },
        { key: 'ctrl+shift+alt+x', command: 'workbench.action.closeAuxiliaryBar' },
      ],
      null,
      2
    )
  );

  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  if (process.platform === 'linux') {
    env.ELECTRON_DISABLE_GPU = '1';
  }

  const args = [
    opts.workspacePath,
    '--extensionDevelopmentPath=' + PROJECT_ROOT,
    '--user-data-dir=' + userDataDir,
    '--disable-extensions',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--no-sandbox',
    `--remote-debugging-port=${cdpPort}`,
    ...(opts.extraArgs ?? []),
  ];

  const proc = spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.includes('DevTools listening')) {
      console.log(`  ${line.trim()}`);
    }
  });

  const pageWsUrl = await waitForCdpReady(cdpPort);
  const cdp = new CdpClient();
  await cdp.connect(pageWsUrl);

  return { proc, cdp, cdpPort };
}

/** Kill VS Code and close the CDP connection */
export function closeVsCode(instance: VsCodeInstance): void {
  instance.cdp.close();
  instance.proc.kill();
}

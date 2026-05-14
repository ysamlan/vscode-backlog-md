import { readdirSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { resolveBacklogDirectory } from './resolveBacklogDirectory';

export interface BacklogRoot {
  backlogPath: string;
  backlogDir: string;
  configPath?: string;
  workspaceFolder: vscode.WorkspaceFolder;
  label: string;
}

const PERSISTENCE_KEY = 'backlog.activeBacklogPath';

/**
 * Manages multiple backlog roots across workspace folders.
 * Discovers backlogs, handles active selection with persistence,
 * and emits events when the active root changes.
 */
export class BacklogWorkspaceManager implements vscode.Disposable {
  private roots: BacklogRoot[] = [];
  private activeRoot: BacklogRoot | undefined;
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeActiveRoot = new vscode.EventEmitter<BacklogRoot | undefined>();
  readonly onDidChangeActiveRoot = this._onDidChangeActiveRoot.event;

  constructor(private workspaceState: vscode.Memento) {}

  /** Scan all workspace folders for backlog/ subdirectories. */
  discover(): BacklogRoot[] {
    const folders = vscode.workspace.workspaceFolders;
    this.roots = [];
    if (!folders) return this.roots;

    for (const folder of folders) {
      const resolution = resolveBacklogDirectory(folder.uri.fsPath);
      if (resolution.backlogPath) {
        this.roots.push({
          backlogPath: resolution.backlogPath,
          backlogDir: resolution.backlogDir!,
          configPath: resolution.configPath ?? undefined,
          workspaceFolder: folder,
          label: folder.name,
        });
      } else {
        this.scanChildDirectories(folder);
      }
    }
    return this.roots;
  }

  /** Scan direct child directories of a workspace folder for backlog roots. */
  private scanChildDirectories(folder: vscode.WorkspaceFolder): void {
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = readdirSync(folder.uri.fsPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const childPath = join(folder.uri.fsPath, entry.name);
      const resolution = resolveBacklogDirectory(childPath);
      if (!resolution.backlogPath) continue;
      if (this.roots.some((r) => r.backlogPath === resolution.backlogPath)) continue;

      this.roots.push({
        backlogPath: resolution.backlogPath,
        backlogDir: resolution.backlogDir!,
        configPath: resolution.configPath ?? undefined,
        workspaceFolder: folder,
        label: entry.name,
      });
    }
  }

  /** Discover roots and restore or auto-select the active root. */
  initialize(): BacklogRoot | undefined {
    this.discover();

    // Restore persisted selection
    const persistedPath = this.workspaceState.get<string>(PERSISTENCE_KEY);
    if (persistedPath) {
      const match = this.roots.find((r) => r.backlogPath === persistedPath);
      if (match) {
        this.activeRoot = match;
        return this.activeRoot;
      }
    }

    // Fallback: auto-select first
    this.activeRoot = this.roots[0];
    if (this.activeRoot) {
      this.workspaceState.update(PERSISTENCE_KEY, this.activeRoot.backlogPath);
    }
    return this.activeRoot;
  }

  /** Listen for workspace folder changes to re-discover roots. */
  startWatching(): void {
    const disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.discover();

      if (this.roots.length === 0) return;

      if (!this.activeRoot) {
        this.setActiveRoot(this.roots[0]);
        return;
      }

      if (!this.roots.find((r) => r.backlogPath === this.activeRoot!.backlogPath)) {
        this.setActiveRoot(this.roots[0]);
        return;
      }

      // Roots list changed but active root still valid — notify webview
      // without full parser/watcher recreation
      this._onDidChangeActiveRoot.fire(this.activeRoot);
    });
    this.disposables.push(disposable);
  }

  /** Show Quick Pick to select active backlog when multiple exist. */
  async selectBacklog(): Promise<BacklogRoot | undefined> {
    if (this.roots.length === 0) return undefined;
    if (this.roots.length === 1) return this.roots[0];

    const items = this.roots.map((root) => ({
      label: root.label,
      description: root.backlogPath,
      root,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select active backlog',
    });
    if (!picked) return this.activeRoot;

    this.setActiveRoot(picked.root);
    return picked.root;
  }

  /** Set the active root, persist, and fire event. */
  setActiveRoot(root: BacklogRoot | undefined): void {
    this.activeRoot = root;
    this.workspaceState.update(PERSISTENCE_KEY, root?.backlogPath);
    this._onDidChangeActiveRoot.fire(root);
  }

  /** Add a newly-initialized backlog root and make it active. */
  addRoot(root: BacklogRoot): void {
    // Avoid duplicates
    if (!this.roots.find((r) => r.backlogPath === root.backlogPath)) {
      this.roots.push(root);
    }
    this.setActiveRoot(root);
  }

  getActiveRoot(): BacklogRoot | undefined {
    return this.activeRoot;
  }

  getRoots(): BacklogRoot[] {
    return this.roots;
  }

  dispose(): void {
    this._onDidChangeActiveRoot.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

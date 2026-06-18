import * as vscode from 'vscode';
import { WebviewMessage, DataSourceMode } from '../core/types';
import { BacklogParser } from '../core/BacklogParser';
import { TasksController, TasksHost } from './TasksController';
import { getTasksWebviewHtml } from './tasksWebviewHtml';

/**
 * Editor-tab host for the unified Tasks board.
 *
 * Opens the same board as the sidebar (`TasksViewProvider`) in a full editor
 * `WebviewPanel`, driven by a host-agnostic {@link TasksController} with host
 * kind `'editor'`. A single instance owns at most one panel (revealed on
 * re-invocation rather than duplicated).
 *
 * The panel and the sidebar are independent webviews kept in sync through disk:
 * extension.ts fans `refresh()` (and parser/workspace/data-source/active-task
 * updates) out to this provider, which forwards them to its controller when the
 * panel is open and otherwise remembers them for the next open.
 */
export class TasksPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private controller: TasksController | undefined;

  // Remembered so a panel opened later starts from current state.
  private parser: BacklogParser | undefined;
  private workspaceRoot: string | undefined;
  private dataSourceMode: DataSourceMode = 'local-only';
  private dataSourceReason: string | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    parser: BacklogParser | undefined,
    private readonly context: vscode.ExtensionContext
  ) {
    this.parser = parser;
  }

  setParser(parser: BacklogParser): void {
    this.parser = parser;
    this.controller?.setParser(parser);
  }

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
    this.controller?.setWorkspaceRoot(root);
  }

  setDataSourceMode(mode: DataSourceMode, reason?: string): void {
    this.dataSourceMode = mode;
    this.dataSourceReason = reason;
    this.controller?.setDataSourceMode(mode, reason);
  }

  setActiveEditedTaskId(taskId: string | null): void {
    this.controller?.setActiveEditedTaskId(taskId);
  }

  checkAndSendIntegrationState(): Promise<void> {
    return this.controller?.checkAndSendIntegrationState() ?? Promise.resolve();
  }

  refresh(): Promise<void> {
    return this.controller?.refresh() ?? Promise.resolve();
  }

  /** Whether the editor-tab board is currently open. */
  isOpen(): boolean {
    return this.panel !== undefined;
  }

  /**
   * Open the Tasks board in an editor tab, or reveal the existing one.
   */
  reveal(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'backlog.tasksEditor',
      'Backlog',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true,
      }
    );
    this.panel = panel;

    const host: TasksHost = {
      kind: 'editor',
      postMessage: (message) => {
        this.panel?.webview.postMessage(message);
      },
      isReady: () => this.panel !== undefined,
    };
    const controller = new TasksController(host, this.parser, this.context);
    this.controller = controller;

    // Apply remembered cross-cutting state before the first load.
    if (this.workspaceRoot) {
      controller.setWorkspaceRoot(this.workspaceRoot);
    }
    if (this.dataSourceMode !== 'local-only') {
      controller.setDataSourceMode(this.dataSourceMode, this.dataSourceReason);
    }

    panel.webview.html = getTasksWebviewHtml(panel.webview, this.extensionUri, {
      extraBodyClass: 'tasks-editor-page',
    });

    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await controller.handleMessage(message);
    });

    panel.onDidDispose(() => {
      this.panel = undefined;
      this.controller = undefined;
    });

    // Initial load. The webview also posts {type:'refresh'} on mount, so data
    // arrives even if these early messages race the bundle load.
    controller.loadPersistedState();
    controller.refresh();
    controller.checkAndSendIntegrationState();
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    this.controller = undefined;
  }
}

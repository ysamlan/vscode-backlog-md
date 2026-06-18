import * as vscode from 'vscode';
import { WebviewMessage, DataSourceMode } from '../core/types';
import { BacklogParser } from '../core/BacklogParser';
import { TasksController, TasksHost, TasksViewMode, TaskSelectionRef } from './TasksController';
import { getTasksWebviewHtml } from './tasksWebviewHtml';

/**
 * Sidebar (activity-bar) host for the unified Tasks board.
 *
 * Thin `WebviewViewProvider` adapter: it owns the `WebviewView` lifecycle and
 * delegates all data loading and message handling to a host-agnostic
 * {@link TasksController}. The same controller also drives the editor-tab host
 * (`TasksPanelProvider`); see {@link TasksHost}.
 */
export class TasksViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly controller: TasksController;

  constructor(
    private readonly extensionUri: vscode.Uri,
    parser: BacklogParser | undefined,
    context?: vscode.ExtensionContext
  ) {
    const host: TasksHost = {
      kind: 'sidebar',
      postMessage: (message) => {
        this._view?.webview.postMessage(message);
      },
      isReady: () => !!this._view,
    };
    this.controller = new TasksController(host, parser, context);
  }

  setParser(parser: BacklogParser): void {
    this.controller.setParser(parser);
  }

  setTaskSelectionHandler(handler: (taskRef: TaskSelectionRef) => void | Promise<void>): void {
    this.controller.setTaskSelectionHandler(handler);
  }

  setActiveEditedTaskId(taskId: string | null): void {
    this.controller.setActiveEditedTaskId(taskId);
  }

  setWorkspaceRoot(root: string): void {
    this.controller.setWorkspaceRoot(root);
  }

  setDataSourceMode(mode: DataSourceMode, reason?: string): void {
    this.controller.setDataSourceMode(mode, reason);
  }

  getDataSourceMode(): DataSourceMode {
    return this.controller.getDataSourceMode();
  }

  setViewMode(mode: TasksViewMode): void {
    this.controller.setViewMode(mode);
  }

  setFilter(filter: string): void {
    this.controller.setFilter(filter);
  }

  setLabelFilter(label: string): void {
    this.controller.setLabelFilter(label);
  }

  checkAndSendIntegrationState(): Promise<void> {
    return this.controller.checkAndSendIntegrationState();
  }

  refresh(): Promise<void> {
    return this.controller.refresh();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    console.log('[Backlog.md] resolveWebviewView called for backlog.kanban');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getTasksWebviewHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this.controller.handleMessage(message);
    });

    // Load saved view mode / collapse state, then trigger the initial data load
    this.controller.loadPersistedState();
    this.controller.refresh();
  }
}

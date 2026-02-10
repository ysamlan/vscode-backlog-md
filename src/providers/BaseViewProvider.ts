import * as vscode from 'vscode';
import { BacklogParser } from '../core/BacklogParser';
import { WebviewMessage, ExtensionMessage } from '../core/types';

/**
 * Abstract base class for webview providers
 * Handles common functionality like message passing and webview setup
 */
export abstract class BaseViewProvider implements vscode.WebviewViewProvider {
  protected _view?: vscode.WebviewView;

  constructor(
    protected readonly extensionUri: vscode.Uri,
    protected parser: BacklogParser | undefined,
    protected readonly context?: vscode.ExtensionContext
  ) {}

  setParser(parser: BacklogParser): void {
    this.parser = parser;
  }

  /**
   * Get the HTML content for the webview
   */
  protected abstract getHtmlContent(webview: vscode.Webview): string;

  /**
   * Handle messages from the webview
   */
  protected abstract handleMessage(message: WebviewMessage): Promise<void>;

  /**
   * Get the view type identifier
   */
  protected abstract get viewType(): string;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    console.log(`[Backlog.md] resolveWebviewView called for ${this.viewType}`);
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    console.log(`[Backlog.md] Setting webview HTML for ${this.viewType}`);
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      console.log(`[Backlog.md] Received message from ${this.viewType}:`, message.type);
      await this.handleMessage(message);
    });

    // Initial data load
    console.log(`[Backlog.md] Triggering initial refresh for ${this.viewType}`);
    this.refresh();
  }

  /**
   * Refresh the view with current data
   */
  async refresh(): Promise<void> {
    console.log(`[Backlog.md] refresh() called for ${this.viewType}, view exists: ${!!this._view}`);
    if (!this._view) return;

    // If no parser, show empty state
    if (!this.parser) {
      console.log(`[Backlog.md] No parser available, showing empty state`);
      this.postMessage({ type: 'noBacklogFolder' });
      return;
    }

    try {
      console.log(`[Backlog.md] Fetching tasks from parser...`);
      const tasks = await this.parser.getTasks();
      console.log(`[Backlog.md] Got ${tasks.length} tasks, sending to webview`);
      this.postMessage({ type: 'tasksUpdated', tasks });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing view:', error);
      this.postMessage({ type: 'error', message: 'Failed to load tasks' });
    }
  }

  /**
   * Send a message to the webview
   */
  protected postMessage(message: ExtensionMessage): void {
    this._view?.webview.postMessage(message);
  }

  /**
   * Get URI for a resource file
   */
  protected getResourceUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', ...pathSegments)
    );
  }

  /**
   * Generate a nonce for CSP
   */
  protected getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Get common HTML head content with CSP and styles
   */
  protected getHtmlHead(webview: vscode.Webview, title: string): string {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>${title}</title>
</head>`;
  }
}

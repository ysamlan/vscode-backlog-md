import * as vscode from 'vscode';

/**
 * Watches the backlog folder for file changes and notifies listeners
 */
export class FileWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher;
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  /**
   * Event that fires when a task file changes
   */
  readonly onDidChange = this._onDidChange.event;

  constructor(backlogPath: string) {
    // Watch for all markdown files in the backlog folder
    const pattern = new vscode.RelativePattern(backlogPath, '**/*.md');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Forward all change events
    this.watcher.onDidChange((uri) => {
      this._onDidChange.fire(uri);
    });

    this.watcher.onDidCreate((uri) => {
      this._onDidChange.fire(uri);
    });

    this.watcher.onDidDelete((uri) => {
      this._onDidChange.fire(uri);
    });
  }

  dispose() {
    this.watcher.dispose();
    this._onDidChange.dispose();
  }
}

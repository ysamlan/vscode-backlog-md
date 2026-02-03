import * as vscode from 'vscode';
import * as fs from 'fs';
import { KanbanViewProvider } from './providers/KanbanViewProvider';
import { TaskListProvider } from './providers/TaskListProvider';
import { BacklogParser } from './core/BacklogParser';
import { FileWatcher } from './core/FileWatcher';

let fileWatcher: FileWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('[Backlog.md] Extension activating...');
  console.log('[Backlog.md] Extension URI:', context.extensionUri.toString());
  console.log(
    '[Backlog.md] Workspace folders:',
    vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath)
  );

  // Find backlog folder in workspace
  const backlogFolder = findBacklogFolder();
  const hasBacklog = backlogFolder !== undefined;

  if (!hasBacklog) {
    console.log('[Backlog.md] No backlog folder found in workspace');
  } else {
    console.log('[Backlog.md] Found backlog folder:', backlogFolder);
  }

  // Initialize parser (may be undefined if no backlog folder)
  const parser = hasBacklog ? new BacklogParser(backlogFolder) : undefined;
  if (parser) {
    console.log('[Backlog.md] Parser initialized');
  }

  // Initialize file watcher (only if backlog folder exists)
  if (hasBacklog && backlogFolder) {
    fileWatcher = new FileWatcher(backlogFolder);
    console.log('[Backlog.md] File watcher initialized');
    context.subscriptions.push(fileWatcher);
  }

  // Register Kanban view provider (always, even without backlog folder)
  const kanbanProvider = new KanbanViewProvider(context.extensionUri, parser);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.kanban', kanbanProvider)
  );
  console.log('[Backlog.md] Kanban view provider registered');

  // Register Task List view provider (always, even without backlog folder)
  const taskListProvider = new TaskListProvider(context.extensionUri, parser);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.taskList', taskListProvider)
  );
  console.log('[Backlog.md] Task list view provider registered');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openKanban', () => {
      vscode.commands.executeCommand('backlog.kanban.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openTaskList', () => {
      vscode.commands.executeCommand('backlog.taskList.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.refresh', () => {
      kanbanProvider.refresh();
      taskListProvider.refresh();
    })
  );

  // Listen for file changes (only if we have a file watcher)
  if (fileWatcher) {
    fileWatcher.onDidChange(() => {
      console.log('[Backlog.md] File change detected, refreshing views');
      kanbanProvider.refresh();
      taskListProvider.refresh();
    });
  }

  console.log('[Backlog.md] Extension activation complete!');
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
}

function findBacklogFolder(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return undefined;
  }

  for (const folder of workspaceFolders) {
    const backlogPath = vscode.Uri.joinPath(folder.uri, 'backlog').fsPath;
    // Check if the backlog folder actually exists
    if (fs.existsSync(backlogPath)) {
      return backlogPath;
    }
  }

  return undefined;
}

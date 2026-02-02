import * as vscode from 'vscode';
import { KanbanViewProvider } from './providers/KanbanViewProvider';
import { TaskListProvider } from './providers/TaskListProvider';
import { BacklogParser } from './core/BacklogParser';
import { FileWatcher } from './core/FileWatcher';

let fileWatcher: FileWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Backlog.md extension is now active');

  // Find backlog folder in workspace
  const backlogFolder = findBacklogFolder();
  if (!backlogFolder) {
    console.log('No backlog folder found in workspace');
    return;
  }

  // Initialize parser
  const parser = new BacklogParser(backlogFolder);

  // Initialize file watcher
  fileWatcher = new FileWatcher(backlogFolder);

  // Register Kanban view provider
  const kanbanProvider = new KanbanViewProvider(context.extensionUri, parser);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.kanban', kanbanProvider)
  );

  // Register Task List view provider
  const taskListProvider = new TaskListProvider(context.extensionUri, parser);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.taskList', taskListProvider)
  );

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

  // Listen for file changes
  fileWatcher.onDidChange(() => {
    kanbanProvider.refresh();
    taskListProvider.refresh();
  });

  context.subscriptions.push(fileWatcher);
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
    // We'll check if it exists when we try to read from it
    return backlogPath;
  }

  return undefined;
}

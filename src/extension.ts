import * as vscode from 'vscode';
import * as fs from 'fs';
import { KanbanViewProvider } from './providers/KanbanViewProvider';
import { TaskListProvider } from './providers/TaskListProvider';
import { TaskDetailProvider } from './providers/TaskDetailProvider';
import { BacklogParser } from './core/BacklogParser';
import { BacklogWriter, CreateTaskOptions } from './core/BacklogWriter';
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

  // Create Task Detail provider for opening task details in editor
  const taskDetailProvider = new TaskDetailProvider(context.extensionUri, parser);
  console.log('[Backlog.md] Task detail provider created');

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

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openTaskDetail', (taskId: string) => {
      taskDetailProvider.openTask(taskId);
    })
  );

  // Register create task command
  const writer = new BacklogWriter();
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.createTask', async () => {
      if (!backlogFolder) {
        vscode.window.showErrorMessage('No backlog folder found in workspace');
        return;
      }

      // Prompt for title (required)
      const title = await vscode.window.showInputBox({
        prompt: 'Enter task title',
        placeHolder: 'e.g., Implement user authentication',
        validateInput: (value) => {
          if (!value?.trim()) {
            return 'Title is required';
          }
          return undefined;
        },
      });

      if (!title) {
        return; // User cancelled
      }

      // Prompt for description (optional)
      const description = await vscode.window.showInputBox({
        prompt: 'Enter task description (optional)',
        placeHolder: 'Brief description of what needs to be done',
      });

      // Prompt for priority (optional)
      const priorityChoice = await vscode.window.showQuickPick(
        [
          { label: 'None', value: undefined },
          { label: 'High', value: 'high' as const },
          { label: 'Medium', value: 'medium' as const },
          { label: 'Low', value: 'low' as const },
        ],
        {
          placeHolder: 'Select priority (optional)',
        }
      );

      // Prompt for labels (optional)
      const labelsInput = await vscode.window.showInputBox({
        prompt: 'Enter labels (optional, comma-separated)',
        placeHolder: 'e.g., bug, urgent, frontend',
      });
      const labels = labelsInput
        ? labelsInput
            .split(',')
            .map((l) => l.trim())
            .filter((l) => l)
        : undefined;

      // Create the task
      const options: CreateTaskOptions = {
        title: title.trim(),
        description: description?.trim() || undefined,
        priority: priorityChoice?.value,
        labels: labels?.length ? labels : undefined,
      };

      try {
        const result = await writer.createTask(backlogFolder, options);
        vscode.window.showInformationMessage(`Created task ${result.id}`);

        // Refresh views
        kanbanProvider.refresh();
        taskListProvider.refresh();

        // Open the new task
        taskDetailProvider.openTask(result.id);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error}`);
      }
    })
  );

  // Listen for file changes (only if we have a file watcher)
  if (fileWatcher) {
    fileWatcher.onDidChange((uri) => {
      console.log('[Backlog.md] File change detected, refreshing views');
      kanbanProvider.refresh();
      taskListProvider.refresh();
      TaskDetailProvider.onFileChanged(uri, taskDetailProvider);
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

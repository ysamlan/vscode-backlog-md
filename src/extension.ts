import * as vscode from 'vscode';
import * as fs from 'fs';
import { TasksViewProvider } from './providers/TasksViewProvider';
import { TaskDetailProvider } from './providers/TaskDetailProvider';
import { TaskCreatePanel } from './providers/TaskCreatePanel';
import { DashboardViewProvider } from './providers/DashboardViewProvider';
import { BacklogParser } from './core/BacklogParser';
import { BacklogWriter } from './core/BacklogWriter';
import { FileWatcher } from './core/FileWatcher';
import { BacklogCli } from './core/BacklogCli';

let fileWatcher: FileWatcher | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

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

  // Register Tasks view provider (unified Kanban + List view)
  const tasksProvider = new TasksViewProvider(context.extensionUri, parser, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.kanban', tasksProvider)
  );
  console.log('[Backlog.md] Tasks view provider registered');

  // Register Dashboard view provider
  const dashboardProvider = new DashboardViewProvider(context.extensionUri, parser, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.dashboard', dashboardProvider)
  );
  console.log('[Backlog.md] Dashboard view provider registered');

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
    vscode.commands.registerCommand('backlog.openDashboard', () => {
      vscode.commands.executeCommand('backlog.dashboard.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.refresh', () => {
      tasksProvider.refresh();
      dashboardProvider.refresh();
    })
  );

  // Register view mode toggle commands
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showListView', () => {
      tasksProvider.setViewMode('list');
      vscode.commands.executeCommand('setContext', 'backlog.isListView', true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showKanbanView', () => {
      tasksProvider.setViewMode('kanban');
      vscode.commands.executeCommand('setContext', 'backlog.isListView', false);
    })
  );

  // Initialize context for view mode (default is kanban)
  const savedViewMode = context.globalState.get<'kanban' | 'list'>('backlog.viewMode', 'kanban');
  vscode.commands.executeCommand('setContext', 'backlog.isListView', savedViewMode === 'list');

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openTaskDetail', (taskId: string) => {
      taskDetailProvider.openTask(taskId);
    })
  );

  // Register open raw markdown command
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openRawMarkdown', async () => {
      const taskId = TaskDetailProvider.getCurrentTaskId();
      if (!taskId) {
        vscode.window.showInformationMessage('No task is currently open');
        return;
      }
      if (!parser) {
        vscode.window.showErrorMessage('No backlog folder found');
        return;
      }
      const task = await parser.getTask(taskId);
      if (task?.filePath) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(task.filePath));
      }
    })
  );

  // Register create task command
  const writer = new BacklogWriter();
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.createTask', async () => {
      if (!backlogFolder || !parser) {
        vscode.window.showErrorMessage('No backlog folder found in workspace');
        return;
      }

      TaskCreatePanel.show(context.extensionUri, writer, parser, backlogFolder, {
        tasksProvider,
        taskDetailProvider,
      });
    })
  );

  // Listen for file changes (only if we have a file watcher)
  if (fileWatcher) {
    fileWatcher.onDidChange((uri) => {
      console.log('[Backlog.md] File change detected, refreshing views');
      tasksProvider.refresh();
      dashboardProvider.refresh();
      TaskDetailProvider.onFileChanged(uri, taskDetailProvider);
    });
  }

  // Check for cross-branch feature configuration and CLI availability
  if (parser) {
    checkCrossBranchConfig(parser, context, tasksProvider);
  }

  console.log('[Backlog.md] Extension activation complete!');
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

/**
 * Check if cross-branch features are configured.
 * Now uses native git support instead of external CLI.
 * Shows appropriate status bar indicators.
 */
async function checkCrossBranchConfig(
  parser: BacklogParser,
  context: vscode.ExtensionContext,
  tasksProvider: TasksViewProvider
): Promise<void> {
  try {
    const config = await parser.getConfig();
    const crossBranchEnabled = config.check_active_branches === true;

    if (!crossBranchEnabled) {
      // Local-only mode is configured (or default) - hide status bar
      console.log('[Backlog.md] Cross-branch features not enabled in config');
      return;
    }

    // Cross-branch features are enabled - native support is now available
    console.log('[Backlog.md] Cross-branch features enabled, using native git support');

    // Create status bar item
    statusBarItem = BacklogCli.createStatusBarItem();
    context.subscriptions.push(statusBarItem);

    // Update to show cross-branch mode
    BacklogCli.updateStatusBarItem(statusBarItem, 'cross-branch');

    // Notify the tasks provider about the data source mode
    tasksProvider.setDataSourceMode('cross-branch');
  } catch (error) {
    console.error('[Backlog.md] Error checking cross-branch config:', error);
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

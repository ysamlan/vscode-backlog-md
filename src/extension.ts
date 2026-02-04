import * as vscode from 'vscode';
import * as fs from 'fs';
import { TasksViewProvider } from './providers/TasksViewProvider';
import { TaskDetailProvider } from './providers/TaskDetailProvider';
import { TaskCreatePanel } from './providers/TaskCreatePanel';
import { BacklogParser } from './core/BacklogParser';
import { BacklogWriter } from './core/BacklogWriter';
import { FileWatcher } from './core/FileWatcher';
import { BacklogCli } from './core/BacklogCli';
import { DataSourceMode } from './core/types';

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
      tasksProvider.refresh();
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
 * Check if cross-branch features are configured and CLI is available.
 * Shows appropriate warnings and status bar indicators.
 */
async function checkCrossBranchConfig(
  parser: BacklogParser,
  context: vscode.ExtensionContext,
  tasksProvider: TasksViewProvider
): Promise<void> {
  try {
    const config = await parser.getConfig();
    const crossBranchEnabled =
      config.check_active_branches === true || config.remote_operations === true;

    if (!crossBranchEnabled) {
      // Local-only mode is configured (or default) - no warning needed
      console.log('[Backlog.md] Cross-branch features not enabled in config');
      return;
    }

    // Cross-branch features are enabled, check if CLI is available
    console.log('[Backlog.md] Cross-branch features enabled, checking CLI availability...');
    const cliResult = await BacklogCli.isAvailable();

    // Create status bar item
    statusBarItem = BacklogCli.createStatusBarItem();
    context.subscriptions.push(statusBarItem);

    let dataSourceMode: DataSourceMode;
    let reason: string | undefined;

    if (cliResult.available) {
      console.log(
        `[Backlog.md] CLI available at: ${cliResult.path} (version: ${cliResult.version})`
      );
      dataSourceMode = 'cross-branch';
      BacklogCli.updateStatusBarItem(statusBarItem, 'cross-branch');
    } else {
      console.log('[Backlog.md] CLI not available, falling back to local-only mode');
      dataSourceMode = 'local-only';
      reason =
        'Cross-branch features require the backlog CLI. Install from https://github.com/MrLesk/Backlog.md or set checkActiveBranches: false in config.';

      // Show warning notification
      BacklogCli.showCrossbranchWarning();

      // Update status bar to show local-only mode
      BacklogCli.updateStatusBarItem(statusBarItem, 'local-only', reason);
    }

    // Notify the tasks provider about the data source mode
    tasksProvider.setDataSourceMode(dataSourceMode, reason);
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

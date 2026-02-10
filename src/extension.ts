import * as vscode from 'vscode';
import * as fs from 'fs';
import { TasksViewProvider } from './providers/TasksViewProvider';
import { TaskDetailProvider } from './providers/TaskDetailProvider';
import { ContentDetailProvider } from './providers/ContentDetailProvider';
import { TaskPreviewViewProvider } from './providers/TaskPreviewViewProvider';
import { BacklogParser } from './core/BacklogParser';
import { BacklogWriter } from './core/BacklogWriter';
import { TaskCreatePanel } from './providers/TaskCreatePanel';
import { FileWatcher } from './core/FileWatcher';
import { BacklogCli } from './core/BacklogCli';
import { createDebouncedHandler } from './core/debounce';
import type { TaskSource } from './core/types';
import { BACKLOG_DOCUMENT_SELECTOR } from './language/documentSelector';
import { BacklogCompletionProvider } from './language/BacklogCompletionProvider';
import { BacklogDocumentLinkProvider } from './language/BacklogDocumentLinkProvider';
import { BacklogHoverProvider } from './language/BacklogHoverProvider';
import { initializeBacklog, type InitBacklogOptions } from './core/initBacklog';

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
  let backlogFolder = findBacklogFolder();
  let hasBacklog = backlogFolder !== undefined;

  if (!hasBacklog) {
    console.log('[Backlog.md] No backlog folder found in workspace');
  } else {
    console.log('[Backlog.md] Found backlog folder:', backlogFolder);
  }

  // Initialize parser (may be undefined if no backlog folder)
  let parser = hasBacklog ? new BacklogParser(backlogFolder!) : undefined;
  let languageProvidersRegistered = false;

  function registerLanguageProviders(activeParser: BacklogParser) {
    if (languageProvidersRegistered) return;
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        BACKLOG_DOCUMENT_SELECTOR,
        new BacklogCompletionProvider(activeParser),
        '-' // Trigger on '-' for task ID prefixes like TASK-
      )
    );
    context.subscriptions.push(
      vscode.languages.registerDocumentLinkProvider(
        BACKLOG_DOCUMENT_SELECTOR,
        new BacklogDocumentLinkProvider(activeParser)
      )
    );
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        BACKLOG_DOCUMENT_SELECTOR,
        new BacklogHoverProvider(activeParser)
      )
    );
    languageProvidersRegistered = true;
    console.log('[Backlog.md] Language providers registered');
  }

  if (parser) {
    console.log('[Backlog.md] Parser initialized');
    registerLanguageProviders(parser);
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

  const taskPreviewProvider = new TaskPreviewViewProvider(
    context.extensionUri,
    parser,
    context,
    () => tasksProvider.refresh()
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('backlog.taskPreview', taskPreviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  tasksProvider.setTaskSelectionHandler((taskRef) => taskPreviewProvider.selectTask(taskRef));
  console.log('[Backlog.md] Task preview view provider registered');

  // Create Task Detail provider for opening task details in editor
  const taskDetailProvider = new TaskDetailProvider(context.extensionUri, parser);
  console.log('[Backlog.md] Task detail provider created');

  // Track active edited task for sidebar highlighting and routing
  TaskDetailProvider.onActiveTaskChanged((taskId) => {
    tasksProvider.setActiveEditedTaskId(taskId);
  });

  // Create Content Detail provider for opening docs/decisions in editor
  const contentDetailProvider = new ContentDetailProvider(context.extensionUri, parser);
  console.log('[Backlog.md] Content detail provider created');

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
      tasksProvider.setViewMode('dashboard');
      vscode.commands.executeCommand('backlog.kanban.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.refresh', () => {
      tasksProvider.refresh();
    })
  );

  // Register 3-way view mode toggle commands (kanban | list | drafts)
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showListView', () => {
      tasksProvider.setViewMode('list');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'list');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showKanbanView', () => {
      tasksProvider.setViewMode('kanban');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'kanban');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showDraftsView', () => {
      tasksProvider.setViewMode('drafts');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'drafts');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showArchivedView', () => {
      tasksProvider.setViewMode('archived');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'archived');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showDocsView', () => {
      tasksProvider.setViewMode('docs');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'docs');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.showDecisionsView', () => {
      tasksProvider.setViewMode('decisions');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'decisions');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openDocumentDetail', (docId: string) => {
      contentDetailProvider.openDocument(docId);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openDecisionDetail', (decisionId: string) => {
      contentDetailProvider.openDecision(decisionId);
    })
  );

  // Initialize context for view mode: derive from saved state
  const savedDraftsMode = context.globalState.get<boolean>('backlog.showingDrafts', false);
  const savedViewMode = savedDraftsMode
    ? 'drafts'
    : context.globalState.get<
        'kanban' | 'list' | 'drafts' | 'archived' | 'dashboard' | 'docs' | 'decisions'
      >('backlog.viewMode', 'kanban');
  vscode.commands.executeCommand('setContext', 'backlog.viewMode', savedViewMode);

  // Register filter by status command (used by dashboard clickable cards)
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.filterByStatus', (status: string) => {
      const filter = status ? `status:${status}` : 'all';

      // Switch to list view and apply filter
      tasksProvider.setViewMode('list');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'list');
      tasksProvider.setFilter(filter);
    })
  );

  // Register filter by label command (used by task detail clickable labels)
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.filterByLabel', (label: string) => {
      // Switch to list view and apply label filter
      tasksProvider.setViewMode('list');
      vscode.commands.executeCommand('setContext', 'backlog.viewMode', 'list');
      tasksProvider.setLabelFilter(label);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'backlog.openTaskDetail',
      (
        task: string | { taskId: string; filePath?: string; source?: TaskSource; branch?: string },
        options?: { preserveFocus?: boolean }
      ) => {
        taskDetailProvider.openTask(task, options);
      }
    )
  );

  // Register open markdown command
  const openMarkdownCommand = async () => {
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
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openMarkdown', openMarkdownCommand)
  );

  // Backward-compatible alias for older keybindings/macros
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.openRawMarkdown', openMarkdownCommand)
  );

  // Register backlog init command
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.init', async (args?: { defaults?: boolean }) => {
      // Check if backlog already exists
      const existingBacklog = findBacklogFolder();
      if (existingBacklog) {
        vscode.window.showInformationMessage('A backlog folder already exists in this workspace.');
        return;
      }

      // Get workspace root
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
        return;
      }

      let workspaceRoot: string;
      if (workspaceFolders.length === 1) {
        workspaceRoot = workspaceFolders[0].uri.fsPath;
      } else {
        const picked = await vscode.window.showWorkspaceFolderPick({
          placeHolder: 'Select workspace folder to initialize backlog in',
        });
        if (!picked) return;
        workspaceRoot = picked.uri.fsPath;
      }

      let options: InitBacklogOptions;

      if (args?.defaults) {
        // Quick init with defaults
        const folderName = workspaceRoot.split(/[\\/]/).pop() || 'My Project';
        options = {
          projectName: folderName,
          taskPrefix: 'task',
          statuses: ['To Do', 'In Progress', 'Done'],
        };
      } else {
        // Customization wizard
        const folderName = workspaceRoot.split(/[\\/]/).pop() || 'My Project';

        const projectName = await vscode.window.showInputBox({
          prompt: 'Project name',
          value: folderName,
          validateInput: (value) => (value.trim() ? null : 'Project name cannot be empty'),
        });
        if (projectName === undefined) return;

        const taskPrefix = await vscode.window.showInputBox({
          prompt: 'Task ID prefix (letters only, e.g. "task" → TASK-1)',
          value: 'task',
          validateInput: (value) =>
            /^[a-zA-Z]+$/.test(value) ? null : 'Prefix must contain only letters (a-z, A-Z)',
        });
        if (taskPrefix === undefined) return;

        const statusesInput = await vscode.window.showInputBox({
          prompt: 'Statuses (comma-separated)',
          value: 'To Do, In Progress, Done',
          validateInput: (value) => {
            const items = value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            return items.length >= 2 ? null : 'At least 2 statuses required';
          },
        });
        if (statusesInput === undefined) return;

        options = {
          projectName: projectName.trim(),
          taskPrefix: taskPrefix.trim(),
          statuses: statusesInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };

        // Advanced settings wizard (matches upstream advanced-config-wizard flow)
        const advancedChoice = await vscode.window.showQuickPick(['No', 'Yes'], {
          placeHolder: 'Configure advanced settings now?',
        });
        if (advancedChoice === undefined) return;

        if (advancedChoice === 'Yes') {
          // Cross-branch tracking
          const crossBranch = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Check task states across active branches?',
          });
          if (crossBranch === undefined) return;
          options.checkActiveBranches = crossBranch === 'Yes';

          if (options.checkActiveBranches) {
            const remoteOps = await vscode.window.showQuickPick(['Yes', 'No'], {
              placeHolder: 'Check task states in remote branches?',
            });
            if (remoteOps === undefined) return;
            options.remoteOperations = remoteOps === 'Yes';

            const branchDays = await vscode.window.showInputBox({
              prompt: 'How many days should a branch be considered active?',
              value: '30',
              validateInput: (value) => {
                const n = parseInt(value, 10);
                return n >= 1 && n <= 365 ? null : 'Enter a number between 1 and 365';
              },
            });
            if (branchDays === undefined) return;
            options.activeBranchDays = parseInt(branchDays, 10);
          }

          // Git settings
          const bypassHooks = await vscode.window.showQuickPick(['No', 'Yes'], {
            placeHolder: 'Bypass git hooks when committing?',
          });
          if (bypassHooks === undefined) return;
          options.bypassGitHooks = bypassHooks === 'Yes';

          const autoCommit = await vscode.window.showQuickPick(['No', 'Yes'], {
            placeHolder: 'Enable automatic commits for Backlog operations?',
          });
          if (autoCommit === undefined) return;
          options.autoCommit = autoCommit === 'Yes';

          // Zero-padded IDs
          const zeroPadded = await vscode.window.showQuickPick(['No', 'Yes'], {
            placeHolder: 'Enable zero-padded IDs for consistent formatting? (e.g. TASK-001)',
          });
          if (zeroPadded === undefined) return;

          if (zeroPadded === 'Yes') {
            const padWidth = await vscode.window.showInputBox({
              prompt: 'Number of digits for zero-padding (e.g. 3 → TASK-001)',
              value: '3',
              validateInput: (value) => {
                const n = parseInt(value, 10);
                return n >= 1 && n <= 10 ? null : 'Enter a number between 1 and 10';
              },
            });
            if (padWidth === undefined) return;
            options.zeroPaddedIds = parseInt(padWidth, 10);
          }

          // Editor
          const editorCmd = await vscode.window.showInputBox({
            prompt: 'Default editor command (leave blank to use system default)',
            placeHolder: "e.g. 'code --wait', 'vim', 'nano'",
            value: '',
          });
          if (editorCmd === undefined) return;
          if (editorCmd.trim()) {
            options.defaultEditor = editorCmd.trim();
          }

          // Web UI settings
          const webUi = await vscode.window.showQuickPick(['No', 'Yes'], {
            placeHolder: 'Configure web UI settings now?',
          });
          if (webUi === undefined) return;

          if (webUi === 'Yes') {
            const port = await vscode.window.showInputBox({
              prompt: 'Default web UI port',
              value: '6420',
              validateInput: (value) => {
                const n = parseInt(value, 10);
                return n >= 1 && n <= 65535 ? null : 'Enter a port between 1 and 65535';
              },
            });
            if (port === undefined) return;
            options.defaultPort = parseInt(port, 10);

            const autoOpen = await vscode.window.showQuickPick(['Yes', 'No'], {
              placeHolder: 'Automatically open browser when starting web UI?',
            });
            if (autoOpen === undefined) return;
            options.autoOpenBrowser = autoOpen === 'Yes';
          }
        }
      }

      try {
        const newBacklogPath = initializeBacklog(workspaceRoot, options);
        console.log('[Backlog.md] Backlog initialized at:', newBacklogPath);

        // Reinitialize the extension with the new backlog
        backlogFolder = newBacklogPath;
        hasBacklog = true;

        // Create new parser
        parser = new BacklogParser(newBacklogPath);

        // Dispose old file watcher if any, create new one
        if (fileWatcher) {
          fileWatcher.dispose();
        }
        fileWatcher = new FileWatcher(newBacklogPath);
        context.subscriptions.push(fileWatcher);

        // Wire up debounced refresh for the new file watcher
        const debouncedRefresh = createDebouncedHandler((uri: vscode.Uri) => {
          console.log('[Backlog.md] Debounced refresh triggered (post-init)');
          tasksProvider.refresh();
          TaskDetailProvider.onFileChanged(uri, taskDetailProvider);
        }, 300);
        fileWatcher.onDidChange((uri) => {
          debouncedRefresh(uri);
        });

        // Update all providers with the new parser
        tasksProvider.setParser(parser);
        taskPreviewProvider.setParser(parser);
        taskDetailProvider.setParser(parser);
        contentDetailProvider.setParser(parser);

        // Register language providers if not already registered
        registerLanguageProviders(parser);

        // Refresh the tasks view to clear the empty state
        await tasksProvider.refresh();

        vscode.window.showInformationMessage(`Backlog initialized in ${newBacklogPath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize backlog: ${error}`);
      }
    })
  );

  // Register create task command (opens form to create a draft)
  const writer = new BacklogWriter();
  context.subscriptions.push(
    vscode.commands.registerCommand('backlog.createTask', () => {
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
    const debouncedRefresh = createDebouncedHandler((uri: vscode.Uri) => {
      console.log('[Backlog.md] Debounced refresh triggered');
      tasksProvider.refresh();
      TaskDetailProvider.onFileChanged(uri, taskDetailProvider);
    }, 300);
    fileWatcher.onDidChange((uri) => {
      console.log('[Backlog.md] File change detected, scheduling refresh');
      debouncedRefresh(uri);
    });
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('backlog.taskIdDisplay')) {
        tasksProvider.refresh();
      }
    })
  );

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

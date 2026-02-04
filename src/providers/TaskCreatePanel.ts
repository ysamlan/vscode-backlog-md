import * as vscode from 'vscode';
import { BacklogParser } from '../core/BacklogParser';
import { BacklogWriter, CreateTaskOptions } from '../core/BacklogWriter';
import { TaskDetailProvider } from './TaskDetailProvider';

interface ViewProviders {
  tasksProvider: { refresh: () => void };
  taskDetailProvider: TaskDetailProvider;
}

/**
 * Provides a webview panel for creating new tasks with a simple form
 */
export class TaskCreatePanel {
  private static currentPanel: TaskCreatePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly writer: BacklogWriter;
  private readonly parser: BacklogParser;
  private readonly backlogPath: string;
  private readonly providers: ViewProviders;

  private constructor(
    extensionUri: vscode.Uri,
    writer: BacklogWriter,
    parser: BacklogParser,
    backlogPath: string,
    providers: ViewProviders
  ) {
    this.extensionUri = extensionUri;
    this.writer = writer;
    this.parser = parser;
    this.backlogPath = backlogPath;
    this.providers = providers;

    this.panel = vscode.window.createWebviewPanel(
      'backlog.createTask',
      'Create New Task',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: false,
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    this.panel.onDidDispose(() => {
      TaskCreatePanel.currentPanel = undefined;
    });
  }

  /**
   * Show the task creation panel, creating it if necessary
   */
  public static show(
    extensionUri: vscode.Uri,
    writer: BacklogWriter,
    parser: BacklogParser,
    backlogPath: string,
    providers: ViewProviders
  ): void {
    if (TaskCreatePanel.currentPanel) {
      TaskCreatePanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    TaskCreatePanel.currentPanel = new TaskCreatePanel(
      extensionUri,
      writer,
      parser,
      backlogPath,
      providers
    );
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: {
    type: string;
    title?: string;
    description?: string;
  }): Promise<void> {
    switch (message.type) {
      case 'createTask':
        await this.handleCreateTask(message.title || '', message.description || '');
        break;

      case 'cancel':
        this.panel.dispose();
        break;
    }
  }

  /**
   * Handle task creation request
   */
  private async handleCreateTask(title: string, description: string): Promise<void> {
    // Validate title
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      await this.panel.webview.postMessage({
        type: 'validationError',
        field: 'title',
        message: 'Title is required',
      });
      return;
    }

    // Build task options with defaults
    const options: CreateTaskOptions = {
      title: trimmedTitle,
      description: description.trim() || undefined,
      status: 'To Do',
      priority: 'medium',
    };

    try {
      const result = await this.writer.createTask(this.backlogPath, options, this.parser);

      vscode.window.showInformationMessage(`Created task ${result.id}`);

      // Refresh views
      this.providers.tasksProvider.refresh();

      // Dispose panel first, then open task detail
      this.panel.dispose();

      // Open the new task in detail view
      this.providers.taskDetailProvider.openTask(result.id);
    } catch (error) {
      await this.panel.webview.postMessage({
        type: 'error',
        message: `Failed to create task: ${error}`,
      });
    }
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate the webview HTML content
   */
  private getWebviewContent(): string {
    const nonce = this.getNonce();
    const webview = this.panel.webview;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Create New Task</title>
    <style>
        body {
            padding: 20px;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.5;
            max-width: 600px;
        }
        h2 {
            margin-top: 0;
            margin-bottom: 24px;
            font-weight: 600;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            font-size: 13px;
        }
        .required-indicator {
            color: var(--vscode-errorForeground, #f14c4c);
            margin-left: 2px;
        }
        .editable-title {
            width: 100%;
            padding: 8px 12px;
            font-size: 16px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: inherit;
            font-family: inherit;
            box-sizing: border-box;
        }
        .editable-title:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .editable-title.error {
            border-color: var(--vscode-errorForeground, #f14c4c);
        }
        .description-textarea {
            width: 100%;
            min-height: 150px;
            padding: 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.5;
            resize: vertical;
            box-sizing: border-box;
        }
        .description-textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .error-message {
            color: var(--vscode-errorForeground, #f14c4c);
            font-size: 12px;
            margin-top: 4px;
        }
        .hidden {
            display: none !important;
        }
        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
        .primary-button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .primary-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .primary-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .secondary-button {
            padding: 8px 16px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        .secondary-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .global-error {
            background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
            border: 1px solid var(--vscode-inputValidation-errorBorder, #f14c4c);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
            color: var(--vscode-errorForeground, #f14c4c);
        }
        .hint-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <h2>Create New Task</h2>

    <div id="globalError" class="global-error hidden"></div>

    <div class="form-group">
        <label for="titleInput">Title <span class="required-indicator">*</span></label>
        <input type="text" id="titleInput" class="editable-title"
               placeholder="e.g., Implement user authentication" required autofocus />
        <div id="titleError" class="error-message hidden">Title is required</div>
    </div>

    <div class="form-group">
        <label for="descriptionTextarea">Description</label>
        <textarea id="descriptionTextarea" class="description-textarea"
                  placeholder="Brief description of what needs to be done (Markdown supported)"></textarea>
        <div class="hint-text">Markdown formatting is supported</div>
    </div>

    <div class="button-group">
        <button id="createBtn" class="primary-button">Create Task</button>
        <button id="cancelBtn" class="secondary-button">Cancel</button>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const titleInput = document.getElementById('titleInput');
        const descriptionTextarea = document.getElementById('descriptionTextarea');
        const createBtn = document.getElementById('createBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const titleError = document.getElementById('titleError');
        const globalError = document.getElementById('globalError');

        // Clear title error on input
        titleInput.addEventListener('input', () => {
            titleInput.classList.remove('error');
            titleError.classList.add('hidden');
        });

        // Create task
        createBtn.addEventListener('click', () => {
            const title = titleInput.value.trim();
            const description = descriptionTextarea.value;

            // Client-side validation
            if (!title) {
                titleInput.classList.add('error');
                titleError.classList.remove('hidden');
                titleInput.focus();
                return;
            }

            // Disable button while creating
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';

            vscode.postMessage({
                type: 'createTask',
                title: title,
                description: description
            });
        });

        // Cancel
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'cancel' });
        });

        // Handle Enter key in title to create
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                createBtn.click();
            }
        });

        // Handle Escape to cancel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                vscode.postMessage({ type: 'cancel' });
            }
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.type) {
                case 'validationError':
                    if (message.field === 'title') {
                        titleInput.classList.add('error');
                        titleError.textContent = message.message;
                        titleError.classList.remove('hidden');
                        titleInput.focus();
                    }
                    // Re-enable button
                    createBtn.disabled = false;
                    createBtn.textContent = 'Create Task';
                    break;

                case 'error':
                    globalError.textContent = message.message;
                    globalError.classList.remove('hidden');
                    // Re-enable button
                    createBtn.disabled = false;
                    createBtn.textContent = 'Create Task';
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

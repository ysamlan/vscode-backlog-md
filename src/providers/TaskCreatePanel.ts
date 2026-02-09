import * as vscode from 'vscode';
import * as fs from 'fs';
import { BacklogParser } from '../core/BacklogParser';
import { BacklogWriter } from '../core/BacklogWriter';
import { TaskDetailProvider } from './TaskDetailProvider';

interface ViewProviders {
  tasksProvider: { refresh: () => void };
  taskDetailProvider: TaskDetailProvider;
}

/**
 * Provides a webview panel for creating new tasks with a simple form.
 * Creates a draft immediately on open, autosaves as the user types,
 * and promotes the draft to a real task on submit.
 */
export class TaskCreatePanel {
  private static currentPanel: TaskCreatePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly writer: BacklogWriter;
  private readonly parser: BacklogParser;
  private readonly backlogPath: string;
  private readonly providers: ViewProviders;

  private draftId: string | undefined;
  private hasContent = false;
  private closedIntentionally = false;

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
      this.handleDispose();
    });

    this.initDraft();
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
   * Create a draft file immediately so autosave has a target
   */
  private async initDraft(): Promise<void> {
    try {
      const result = await this.writer.createDraft(this.backlogPath, this.parser);
      // Panel may have been disposed during the async init
      if (this.closedIntentionally) return;
      this.draftId = result.id;
    } catch {
      // Draft creation failed — submit will still work by creating inline
    }
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

      case 'autosave':
        await this.handleAutosave(message.title || '', message.description || '');
        break;

      case 'discardDraft':
        await this.handleDiscardDraft();
        break;
    }
  }

  /**
   * Handle autosave: update the draft file with current form contents
   */
  private async handleAutosave(title: string, description: string): Promise<void> {
    if (!this.draftId) return;

    try {
      const trimmedTitle = title.trim();
      await this.writer.updateTask(
        this.draftId,
        {
          title: trimmedTitle || undefined,
          description: description.trim() || undefined,
        },
        this.parser
      );
      if (trimmedTitle) {
        this.hasContent = true;
      }
      await this.panel.webview.postMessage({ type: 'autosaved' });
    } catch {
      // Autosave failures are silent — user can still submit
    }
  }

  /**
   * Handle task creation: promote the draft to a real task
   */
  private async handleCreateTask(title: string, description: string): Promise<void> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      await this.panel.webview.postMessage({
        type: 'validationError',
        field: 'title',
        message: 'Title is required',
      });
      return;
    }

    try {
      let newTaskId: string;
      if (this.draftId) {
        // Save final content to the draft, then promote it
        await this.writer.updateTask(
          this.draftId,
          { title: trimmedTitle, description: description.trim() || undefined },
          this.parser
        );
        newTaskId = await this.writer.promoteDraft(this.draftId, this.parser);
      } else {
        // Fallback: no draft was created (init failed), create+promote inline
        const result = await this.writer.createDraft(this.backlogPath, this.parser);
        await this.writer.updateTask(
          result.id,
          { title: trimmedTitle, description: description.trim() || undefined },
          this.parser
        );
        newTaskId = await this.writer.promoteDraft(result.id, this.parser);
      }

      vscode.window.showInformationMessage(`Created task "${trimmedTitle}"`);

      this.providers.tasksProvider.refresh();

      this.closedIntentionally = true;
      this.panel.dispose();

      this.providers.taskDetailProvider.openTask(newTaskId);
    } catch (error) {
      await this.panel.webview.postMessage({
        type: 'error',
        message: `Failed to create task: ${error}`,
      });
    }
  }

  /**
   * Handle discard: always delete the draft, regardless of content
   */
  private async handleDiscardDraft(): Promise<void> {
    if (this.draftId) {
      await this.deleteDraft();
    }
    this.closedIntentionally = true;
    this.panel.dispose();
  }

  /**
   * Handle passive panel close (X button, tab close, navigating away).
   * Deletes empty drafts, keeps drafts with content.
   */
  private async handleDispose(): Promise<void> {
    TaskCreatePanel.currentPanel = undefined;

    // If closed intentionally (submit/discard), cleanup already handled
    if (this.closedIntentionally) return;

    // Passive close: delete empty drafts, keep drafts with content
    if (this.draftId && !this.hasContent) {
      await this.deleteDraft();
    }
  }

  /**
   * Delete the current draft file from disk
   */
  private async deleteDraft(): Promise<void> {
    if (!this.draftId) return;
    try {
      const task = await this.parser.getTask(this.draftId);
      if (task?.filePath && fs.existsSync(task.filePath)) {
        fs.unlinkSync(task.filePath);
      }
    } catch {
      // Best-effort cleanup
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
        .save-indicator {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-left: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .save-indicator.visible {
            opacity: 1;
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
        <button id="discardBtn" class="secondary-button">Discard Draft</button>
        <span id="saveIndicator" class="save-indicator">Saved</span>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const titleInput = document.getElementById('titleInput');
        const descriptionTextarea = document.getElementById('descriptionTextarea');
        const createBtn = document.getElementById('createBtn');
        const discardBtn = document.getElementById('discardBtn');
        const titleError = document.getElementById('titleError');
        const globalError = document.getElementById('globalError');
        const saveIndicator = document.getElementById('saveIndicator');

        let autosaveTimer = null;

        function scheduleAutosave() {
            if (autosaveTimer) clearTimeout(autosaveTimer);
            autosaveTimer = setTimeout(() => {
                saveIndicator.textContent = 'Saving...';
                saveIndicator.classList.add('visible');
                vscode.postMessage({
                    type: 'autosave',
                    title: titleInput.value,
                    description: descriptionTextarea.value
                });
            }, 1000);
        }

        // Clear title error on input + schedule autosave
        titleInput.addEventListener('input', () => {
            titleInput.classList.remove('error');
            titleError.classList.add('hidden');
            scheduleAutosave();
        });

        // Autosave on description input
        descriptionTextarea.addEventListener('input', () => {
            scheduleAutosave();
        });

        // Create task (promote draft)
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

        // Discard draft
        discardBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'discardDraft' });
        });

        // Handle Enter key in title to create
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                createBtn.click();
            }
        });

        // Handle Escape to discard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                vscode.postMessage({ type: 'discardDraft' });
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

                case 'autosaved':
                    saveIndicator.textContent = 'Saved';
                    saveIndicator.classList.add('visible');
                    setTimeout(() => {
                        saveIndicator.classList.remove('visible');
                    }, 2000);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

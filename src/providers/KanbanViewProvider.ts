import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { WebviewMessage } from '../core/types';
import { BacklogWriter } from '../core/BacklogWriter';

/**
 * Provides the Kanban board webview
 */
export class KanbanViewProvider extends BaseViewProvider {
  protected get viewType(): string {
    return 'backlog.kanban';
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Kanban Board</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .kanban-board {
            display: flex;
            gap: 12px;
            padding: 12px;
            min-height: 100vh;
            overflow-x: auto;
        }
        .kanban-column {
            flex: 1;
            min-width: 200px;
            max-width: 300px;
            background: var(--vscode-sideBar-background);
            border-radius: 8px;
            padding: 12px;
        }
        .column-header {
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .column-count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }
        .task-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 50px;
        }
        .task-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 10px;
            cursor: grab;
            transition: all 0.15s ease;
        }
        .task-card:hover {
            border-color: var(--vscode-focusBorder);
            transform: translateY(-1px);
        }
        .task-card.dragging {
            opacity: 0.5;
            cursor: grabbing;
        }
        .task-card-title {
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 6px;
        }
        .task-card-meta {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            align-items: center;
        }
        .priority-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .priority-high {
            background: #dc262620;
            color: #dc2626;
        }
        .priority-medium {
            background: #f59e0b20;
            color: #f59e0b;
        }
        .priority-low {
            background: #10b98120;
            color: #10b981;
        }
        .task-label {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .empty-state {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            text-align: center;
            padding: 20px;
        }
        .drop-zone {
            border: 2px dashed var(--vscode-focusBorder);
            border-radius: 6px;
            min-height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .drop-zone.active {
            opacity: 1;
        }
    </style>
</head>
<body>
    <div id="app" class="kanban-board">
        <div class="empty-state">Loading tasks...</div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let tasks = [];

        const columns = [
            { status: 'To Do', label: 'To Do' },
            { status: 'In Progress', label: 'In Progress' },
            { status: 'Done', label: 'Done' }
        ];

        function render() {
            const app = document.getElementById('app');

            if (tasks.length === 0) {
                app.innerHTML = '<div class="empty-state">No tasks found. Create tasks in your backlog/ folder.</div>';
                return;
            }

            app.innerHTML = columns.map(col => {
                const columnTasks = tasks.filter(t => t.status === col.status);
                return \`
                    <div class="kanban-column" data-status="\${col.status}">
                        <div class="column-header">
                            <span>\${col.label}</span>
                            <span class="column-count">\${columnTasks.length}</span>
                        </div>
                        <div class="task-list" data-status="\${col.status}">
                            \${columnTasks.map(task => renderTaskCard(task)).join('')}
                        </div>
                    </div>
                \`;
            }).join('');

            setupDragAndDrop();
        }

        function renderTaskCard(task) {
            const priorityClass = task.priority ? \`priority-\${task.priority}\` : '';
            const priorityBadge = task.priority ?
                \`<span class="priority-badge \${priorityClass}">\${task.priority}</span>\` : '';

            const labels = task.labels.slice(0, 2).map(l =>
                \`<span class="task-label">\${l}</span>\`
            ).join('');

            return \`
                <div class="task-card" draggable="true" data-task-id="\${task.id}">
                    <div class="task-card-title">\${escapeHtml(task.title)}</div>
                    <div class="task-card-meta">
                        \${priorityBadge}
                        \${labels}
                    </div>
                </div>
            \`;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function setupDragAndDrop() {
            const cards = document.querySelectorAll('.task-card');
            const lists = document.querySelectorAll('.task-list');

            cards.forEach(card => {
                card.addEventListener('dragstart', e => {
                    card.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', card.dataset.taskId);
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                });

                card.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'openTask',
                        taskId: card.dataset.taskId
                    });
                });
            });

            lists.forEach(list => {
                list.addEventListener('dragover', e => {
                    e.preventDefault();
                    list.classList.add('drop-target');
                });

                list.addEventListener('dragleave', () => {
                    list.classList.remove('drop-target');
                });

                list.addEventListener('drop', e => {
                    e.preventDefault();
                    list.classList.remove('drop-target');

                    const taskId = e.dataTransfer.getData('text/plain');
                    const newStatus = list.dataset.status;

                    vscode.postMessage({
                        type: 'updateTaskStatus',
                        taskId: taskId,
                        status: newStatus
                    });
                });
            });
        }

        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'tasksUpdated':
                    tasks = message.tasks;
                    render();
                    break;
                case 'error':
                    console.error(message.message);
                    break;
            }
        });

        // Request initial data
        vscode.postMessage({ type: 'refresh' });
    </script>
</body>
</html>`;
  }

  protected async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'refresh':
        await this.refresh();
        break;

      case 'openTask': {
        // Open task detail - we'll implement this later
        const task = await this.parser.getTask(message.taskId);
        if (task) {
          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(task.filePath));
        }
        break;
      }

      case 'updateTaskStatus':
        try {
          const writer = new BacklogWriter();
          await writer.updateTaskStatus(message.taskId, message.status, this.parser);
          await this.refresh();
        } catch (error) {
          console.error('Error updating task status:', error);
          this.postMessage({ type: 'error', message: 'Failed to update task status' });
        }
        break;
    }
  }
}

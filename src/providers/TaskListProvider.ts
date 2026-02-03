import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { WebviewMessage } from '../core/types';

/**
 * Provides the task list/table webview
 */
export class TaskListProvider extends BaseViewProvider {
  protected get viewType(): string {
    return 'backlog.taskList';
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
    <title>Task List</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .task-list-container {
            padding: 12px;
        }
        .search-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
        .search-input {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
        }
        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .filter-buttons {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }
        .filter-btn {
            padding: 4px 10px;
            font-size: 11px;
            border: 1px solid var(--vscode-button-secondaryBackground, var(--vscode-widget-border));
            background: var(--vscode-button-secondaryBackground, transparent);
            color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
            border-radius: 4px;
            cursor: pointer;
        }
        .filter-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
        }
        .filter-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .task-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .task-table th {
            text-align: left;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-widget-border);
            color: var(--vscode-descriptionForeground);
            font-weight: 600;
            cursor: pointer;
            user-select: none;
        }
        .task-table th:hover {
            color: var(--vscode-foreground);
        }
        .task-table td {
            padding: 8px;
            border-bottom: 1px solid var(--vscode-widget-border);
            vertical-align: middle;
        }
        .task-table tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .task-table tr {
            cursor: pointer;
        }
        /* Status and priority badge styles are defined in styles.css for theme support */
        .empty-state {
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 40px 20px;
        }
        .sort-indicator {
            margin-left: 4px;
        }
    </style>
</head>
<body>
    <div class="task-list-container">
        <div class="search-bar">
            <input type="text" class="search-input" placeholder="Search tasks..." id="searchInput">
        </div>
        <div class="filter-buttons">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="todo">To Do</button>
            <button class="filter-btn" data-filter="in-progress">In Progress</button>
            <button class="filter-btn" data-filter="done">Done</button>
            <button class="filter-btn" data-filter="high-priority">High Priority</button>
        </div>
        <div id="taskList">
            <div class="empty-state">Loading tasks...</div>
        </div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let tasks = [];
        let currentFilter = 'all';
        let currentSort = { field: 'status', direction: 'asc' };
        let searchQuery = '';

        function render() {
            const container = document.getElementById('taskList');
            let filteredTasks = filterTasks(tasks);
            filteredTasks = sortTasks(filteredTasks);

            if (filteredTasks.length === 0) {
                container.innerHTML = '<div class="empty-state">No tasks found</div>';
                return;
            }

            container.innerHTML = \`
                <table class="task-table">
                    <thead>
                        <tr>
                            <th data-sort="title">Title \${getSortIndicator('title')}</th>
                            <th data-sort="status">Status \${getSortIndicator('status')}</th>
                            <th data-sort="priority">Priority \${getSortIndicator('priority')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${filteredTasks.map(task => renderTaskRow(task)).join('')}
                    </tbody>
                </table>
            \`;

            setupEventListeners();
        }

        function renderTaskRow(task) {
            const statusClass = task.status.toLowerCase().replace(' ', '-');
            const priorityClass = task.priority ? \`priority-\${task.priority}\` : '';

            return \`
                <tr data-task-id="\${task.id}">
                    <td>\${escapeHtml(task.title)}</td>
                    <td><span class="status-badge status-\${statusClass}">\${task.status}</span></td>
                    <td>\${task.priority ? \`<span class="priority-badge \${priorityClass}">\${task.priority}</span>\` : '-'}</td>
                </tr>
            \`;
        }

        function filterTasks(tasks) {
            let filtered = tasks;

            // Apply status filter
            switch (currentFilter) {
                case 'todo':
                    filtered = filtered.filter(t => t.status === 'To Do');
                    break;
                case 'in-progress':
                    filtered = filtered.filter(t => t.status === 'In Progress');
                    break;
                case 'done':
                    filtered = filtered.filter(t => t.status === 'Done');
                    break;
                case 'high-priority':
                    filtered = filtered.filter(t => t.priority === 'high');
                    break;
            }

            // Apply search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(t =>
                    t.title.toLowerCase().includes(query) ||
                    (t.description && t.description.toLowerCase().includes(query))
                );
            }

            return filtered;
        }

        function sortTasks(tasks) {
            return [...tasks].sort((a, b) => {
                let aVal = a[currentSort.field] || '';
                let bVal = b[currentSort.field] || '';

                if (currentSort.field === 'priority') {
                    const order = { high: 0, medium: 1, low: 2, '': 3 };
                    aVal = order[aVal] ?? 3;
                    bVal = order[bVal] ?? 3;
                }

                if (currentSort.field === 'status') {
                    const order = { 'To Do': 0, 'In Progress': 1, 'Done': 2 };
                    aVal = order[aVal] ?? 0;
                    bVal = order[bVal] ?? 0;
                }

                if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        function getSortIndicator(field) {
            if (currentSort.field !== field) return '';
            return currentSort.direction === 'asc' ? '↑' : '↓';
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function setupEventListeners() {
            // Table header sorting
            document.querySelectorAll('.task-table th[data-sort]').forEach(th => {
                th.addEventListener('click', () => {
                    const field = th.dataset.sort;
                    if (currentSort.field === field) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.field = field;
                        currentSort.direction = 'asc';
                    }
                    render();
                });
            });

            // Row click to open task
            document.querySelectorAll('.task-table tr[data-task-id]').forEach(row => {
                row.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'openTask',
                        taskId: row.dataset.taskId
                    });
                });
            });
        }

        // Search input handler
        document.getElementById('searchInput').addEventListener('input', e => {
            searchQuery = e.target.value;
            render();
        });

        // Filter button handlers
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                render();
            });
        });

        function renderNoBacklogState() {
            const container = document.getElementById('taskList');
            container.innerHTML = \`
                <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                    <h3 style="margin: 0 0 8px 0; font-weight: 600;">No Backlog Found</h3>
                    <p style="margin: 0 0 16px 0; color: var(--vscode-descriptionForeground);">
                        This workspace doesn't have a <code>backlog/</code> folder.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        To use Backlog.md, create a <code>backlog/tasks/</code> folder<br>
                        in your project root with markdown task files.
                    </p>
                </div>
            \`;
        }

        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'tasksUpdated':
                    tasks = message.tasks;
                    render();
                    break;
                case 'noBacklogFolder':
                    renderNoBacklogState();
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
        vscode.commands.executeCommand('backlog.openTaskDetail', message.taskId);
        break;
      }
    }
  }
}

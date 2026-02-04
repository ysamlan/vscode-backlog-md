import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { WebviewMessage } from '../core/types';
import { BacklogWriter } from '../core/BacklogWriter';

/**
 * Provides a unified tasks webview with toggle between Kanban and List views
 */
export class TasksViewProvider extends BaseViewProvider {
  private viewMode: 'kanban' | 'list' = 'kanban';

  protected get viewType(): string {
    return 'backlog.kanban';
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    resolveContext: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    // Load saved view mode from globalState
    if (this.context) {
      this.viewMode = this.context.globalState.get('backlog.viewMode', 'kanban');
    }
    return super.resolveWebviewView(webviewView, resolveContext, token);
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const styleUri = this.getResourceUri(webview, 'styles.css');

    // Lucide icons for toggle button
    const kanbanIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`;
    const listIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Tasks</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .view-header {
            display: flex;
            justify-content: flex-end;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .toggle-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-radius: 4px;
        }
        .toggle-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        .view-content {
            display: block;
        }
        .view-content.hidden {
            display: none;
        }
        /* Kanban styles */
        .kanban-board {
            display: flex;
            gap: 12px;
            padding: 12px;
            min-height: calc(100vh - 45px);
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
            position: relative;
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
        .task-label {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
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
        /* List view styles */
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
        .task-table tr[data-task-id] {
            cursor: pointer;
        }
        .empty-state {
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 40px 20px;
        }
        .sort-indicator {
            margin-left: 4px;
        }
        /* Optimistic UI styles */
        .task-card.saving {
            opacity: 0.7;
            pointer-events: none;
        }
        .task-card.saving::after {
            content: '';
            position: absolute;
            top: 4px;
            right: 4px;
            width: 8px;
            height: 8px;
            border: 2px solid var(--vscode-descriptionForeground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            color: var(--vscode-errorForeground, #f48771);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: fadeInOut 3s forwards;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            90% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
        /* Keyboard navigation focus styles */
        .task-card:focus-visible {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }
        .task-table tr:focus-visible {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: -2px;
        }
    </style>
</head>
<body>
    <div class="view-header">
        <button id="toggleView" class="toggle-btn" title="Toggle view">
            ${this.viewMode === 'kanban' ? listIcon : kanbanIcon}
        </button>
    </div>
    <div id="kanban-view" class="view-content ${this.viewMode === 'kanban' ? '' : 'hidden'}">
        <div id="kanban-app" class="kanban-board">
            <div class="empty-state">Loading tasks...</div>
        </div>
    </div>
    <div id="list-view" class="view-content ${this.viewMode === 'list' ? '' : 'hidden'}">
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
            <div id="taskListContent">
                <div class="empty-state">Loading tasks...</div>
            </div>
        </div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let tasks = [];
        let viewMode = '${this.viewMode}';
        let columns = [
            { status: 'To Do', label: 'To Do' },
            { status: 'In Progress', label: 'In Progress' },
            { status: 'Done', label: 'Done' }
        ];
        let currentFilter = 'all';
        let currentSort = { field: 'status', direction: 'asc' };
        let searchQuery = '';

        // Icon SVGs for toggle button
        const kanbanIcon = \`${kanbanIcon}\`;
        const listIcon = \`${listIcon}\`;

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateColumnCounts() {
            document.querySelectorAll('.kanban-column').forEach(col => {
                const status = col.dataset.status;
                const count = col.querySelectorAll('.task-card').length;
                const countEl = col.querySelector('.column-count');
                if (countEl) countEl.textContent = count;
            });
        }

        function showToast(message) {
            // Remove existing toast
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = message;
            document.body.appendChild(toast);

            // Remove after animation
            setTimeout(() => toast.remove(), 3000);
        }

        // ===== Kanban View Functions =====
        function renderKanban() {
            const app = document.getElementById('kanban-app');

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

            setupKanbanDragAndDrop();
        }

        function renderTaskCard(task) {
            const priorityClass = task.priority ? \`priority-\${task.priority}\` : '';
            const priorityBadge = task.priority ?
                \`<span class="priority-badge \${priorityClass}">\${task.priority}</span>\` : '';

            const labels = task.labels.slice(0, 2).map(l =>
                \`<span class="task-label">\${l}</span>\`
            ).join('');

            return \`
                <div class="task-card" tabindex="0" draggable="true" data-task-id="\${task.id}">
                    <div class="task-card-title">\${escapeHtml(task.title)}</div>
                    <div class="task-card-meta">
                        \${priorityBadge}
                        \${labels}
                    </div>
                </div>
            \`;
        }

        function setupKanbanDragAndDrop() {
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
                    const card = document.querySelector(\`[data-task-id="\${taskId}"]\`);
                    if (!card) return;

                    const originalColumn = card.closest('.task-list');
                    const originalStatus = originalColumn?.dataset.status;
                    const newStatus = list.dataset.status;

                    // If same column, no status change needed
                    if (originalStatus === newStatus) return;

                    // Optimistic move - move card immediately
                    card.classList.add('saving');
                    card.dataset.originalStatus = originalStatus || '';
                    list.appendChild(card);
                    updateColumnCounts();

                    vscode.postMessage({
                        type: 'updateTaskStatus',
                        taskId: taskId,
                        status: newStatus
                    });
                });
            });
        }

        // ===== List View Functions =====
        function renderList() {
            const container = document.getElementById('taskListContent');
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

            setupListEventListeners();
        }

        function renderTaskRow(task) {
            const statusClass = task.status.toLowerCase().replace(' ', '-');
            const priorityClass = task.priority ? \`priority-\${task.priority}\` : '';

            return \`
                <tr data-task-id="\${task.id}" tabindex="0">
                    <td>\${escapeHtml(task.title)}</td>
                    <td><span class="status-badge status-\${statusClass}">\${task.status}</span></td>
                    <td>\${task.priority ? \`<span class="priority-badge \${priorityClass}">\${task.priority}</span>\` : '-'}</td>
                </tr>
            \`;
        }

        function filterTasks(tasks) {
            let filtered = tasks;

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
            return currentSort.direction === 'asc' ? '\\u2191' : '\\u2193';
        }

        function setupListEventListeners() {
            document.querySelectorAll('.task-table th[data-sort]').forEach(th => {
                th.addEventListener('click', () => {
                    const field = th.dataset.sort;
                    if (currentSort.field === field) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.field = field;
                        currentSort.direction = 'asc';
                    }
                    renderList();
                });
            });

            document.querySelectorAll('.task-table tr[data-task-id]').forEach(row => {
                row.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'openTask',
                        taskId: row.dataset.taskId
                    });
                });
            });
        }

        // ===== View Toggle =====
        function updateViewMode(newMode) {
            viewMode = newMode;
            const kanbanView = document.getElementById('kanban-view');
            const listView = document.getElementById('list-view');
            const toggleBtn = document.getElementById('toggleView');

            if (viewMode === 'kanban') {
                kanbanView.classList.remove('hidden');
                listView.classList.add('hidden');
                toggleBtn.innerHTML = listIcon;
                toggleBtn.title = 'Switch to list view';
            } else {
                kanbanView.classList.add('hidden');
                listView.classList.remove('hidden');
                toggleBtn.innerHTML = kanbanIcon;
                toggleBtn.title = 'Switch to kanban view';
            }
        }

        function render() {
            if (viewMode === 'kanban') {
                renderKanban();
            } else {
                renderList();
            }
        }

        function renderNoBacklogState() {
            const kanbanApp = document.getElementById('kanban-app');
            const listContent = document.getElementById('taskListContent');
            const html = \`
                <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">&#128203;</div>
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
            kanbanApp.innerHTML = html;
            listContent.innerHTML = html;
        }

        // ===== Event Handlers =====
        document.getElementById('toggleView').addEventListener('click', () => {
            vscode.postMessage({ type: 'toggleViewMode' });
        });

        document.getElementById('searchInput').addEventListener('input', e => {
            searchQuery = e.target.value;
            renderList();
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderList();
            });
        });

        // ===== Keyboard Navigation =====
        document.addEventListener('keydown', e => {
            const focused = document.activeElement;

            // Kanban view: task cards
            if (focused && focused.classList.contains('task-card')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    vscode.postMessage({ type: 'openTask', taskId: focused.dataset.taskId });
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = focused.nextElementSibling;
                    if (next && next.classList.contains('task-card')) next.focus();
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = focused.previousElementSibling;
                    if (prev && prev.classList.contains('task-card')) prev.focus();
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const col = focused.closest('.kanban-column');
                    const nextCol = col?.nextElementSibling;
                    const cards = nextCol?.querySelectorAll('.task-card');
                    if (cards && cards.length) cards[0].focus();
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const col = focused.closest('.kanban-column');
                    const prevCol = col?.previousElementSibling;
                    const cards = prevCol?.querySelectorAll('.task-card');
                    if (cards && cards.length) cards[0].focus();
                }
            }

            // List view: table rows
            if (focused && focused.tagName === 'TR' && focused.dataset.taskId) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    vscode.postMessage({ type: 'openTask', taskId: focused.dataset.taskId });
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = focused.nextElementSibling;
                    if (next && next.dataset.taskId) next.focus();
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = focused.previousElementSibling;
                    if (prev && prev.dataset.taskId) prev.focus();
                }
            }
        });

        // Scroll focused element into view
        document.addEventListener('focus', e => {
            if (e.target && (e.target.classList?.contains('task-card') || (e.target.tagName === 'TR' && e.target.dataset?.taskId))) {
                e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, true);

        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'statusesUpdated':
                    columns = message.statuses.map(status => ({
                        status: status,
                        label: status
                    }));
                    break;
                case 'tasksUpdated':
                    tasks = message.tasks;
                    render();
                    break;
                case 'viewModeChanged':
                    updateViewMode(message.viewMode);
                    render();
                    break;
                case 'taskUpdateSuccess': {
                    const card = document.querySelector(\`[data-task-id="\${message.taskId}"]\`);
                    if (card) {
                        card.classList.remove('saving');
                        delete card.dataset.originalStatus;
                    }
                    break;
                }
                case 'taskUpdateError': {
                    const card = document.querySelector(\`[data-task-id="\${message.taskId}"]\`);
                    if (card) {
                        card.classList.remove('saving');
                        // Move back to original column
                        const origList = document.querySelector(\`.task-list[data-status="\${message.originalStatus}"]\`);
                        if (origList) {
                            origList.appendChild(card);
                            updateColumnCounts();
                        }
                        delete card.dataset.originalStatus;
                    }
                    showToast(message.message || 'Failed to update task');
                    break;
                }
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

  /**
   * Override refresh to also send statuses from config
   */
  async refresh(): Promise<void> {
    if (!this._view) return;

    if (!this.parser) {
      this.postMessage({ type: 'noBacklogFolder' });
      return;
    }

    try {
      const [tasks, statuses] = await Promise.all([
        this.parser.getTasks(),
        this.parser.getStatuses(),
      ]);

      this.postMessage({ type: 'statusesUpdated', statuses });
      this.postMessage({ type: 'tasksUpdated', tasks });
    } catch (error) {
      console.error('[Backlog.md] Error refreshing Tasks view:', error);
      this.postMessage({ type: 'error', message: 'Failed to load tasks' });
    }
  }

  protected async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'refresh':
        await this.refresh();
        break;

      case 'toggleViewMode':
        this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
        if (this.context) {
          await this.context.globalState.update('backlog.viewMode', this.viewMode);
        }
        this.postMessage({ type: 'viewModeChanged', viewMode: this.viewMode });
        break;

      case 'openTask': {
        vscode.commands.executeCommand('backlog.openTaskDetail', message.taskId);
        break;
      }

      case 'updateTaskStatus': {
        if (!this.parser) break;
        const taskId = message.taskId;
        // Get original status before update for rollback
        const task = await this.parser.getTask(taskId);
        const originalStatus = task?.status || 'To Do';

        try {
          const writer = new BacklogWriter();
          await writer.updateTaskStatus(taskId, message.status, this.parser);
          // Send success - no need to refresh since we did optimistic update
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
        } catch (error) {
          console.error('Error updating task status:', error);
          this.postMessage({
            type: 'taskUpdateError',
            taskId,
            originalStatus,
            message: 'Failed to update task status',
          });
        }
        break;
      }

      case 'archiveTask': {
        if (!this.parser || !message.taskId) break;
        const task = await this.parser.getTask(message.taskId);
        const confirmation = await vscode.window.showWarningMessage(
          `Archive task "${task?.title}"?`,
          { modal: true },
          'Archive'
        );

        if (confirmation === 'Archive') {
          try {
            const writer = new BacklogWriter();
            await writer.archiveTask(message.taskId, this.parser);
            await this.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive: ${error}`);
          }
        }
        break;
      }
    }
  }
}

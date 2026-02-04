import * as vscode from 'vscode';
import { BaseViewProvider } from './BaseViewProvider';
import { WebviewMessage, DataSourceMode } from '../core/types';
import { BacklogWriter } from '../core/BacklogWriter';

/**
 * Provides a unified tasks webview with toggle between Kanban and List views
 */
export class TasksViewProvider extends BaseViewProvider {
  private viewMode: 'kanban' | 'list' = 'kanban';
  private dataSourceMode: DataSourceMode = 'local-only';
  private dataSourceReason?: string;
  private collapsedColumns: Set<string> = new Set();

  protected get viewType(): string {
    return 'backlog.kanban';
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    resolveContext: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    // Load saved view mode and collapsed columns from globalState
    if (this.context) {
      this.viewMode = this.context.globalState.get('backlog.viewMode', 'kanban');
      const savedCollapsed = this.context.globalState.get<string[]>('backlog.collapsedColumns', []);
      this.collapsedColumns = new Set(savedCollapsed);
    }
    return super.resolveWebviewView(webviewView, resolveContext, token);
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
    <title>Tasks</title>
</head>
<body>
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
        let collapsedColumns = new Set(${JSON.stringify(Array.from(this.collapsedColumns))});

        // Arrow icons for dependency indicators
        const arrowLeftIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>\`;
        const arrowRightIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 5 7 7-7 7"/><path d="M5 12h14"/></svg>\`;

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
                const columnTasks = tasks
                    .filter(t => t.status === col.status)
                    .sort((a, b) => {
                        // Tasks with ordinal come before tasks without
                        const aOrd = a.ordinal;
                        const bOrd = b.ordinal;
                        if (aOrd !== undefined && bOrd === undefined) return -1;
                        if (aOrd === undefined && bOrd !== undefined) return 1;
                        if (aOrd !== undefined && bOrd !== undefined) return aOrd - bOrd;
                        // Both undefined: sort by ID
                        return a.id.localeCompare(b.id);
                    });
                const isCollapsed = collapsedColumns.has(col.status);
                return \`
                    <div class="kanban-column\${isCollapsed ? ' collapsed' : ''}" data-status="\${col.status}">
                        <div class="column-header" data-status="\${col.status}">
                            <span class="collapse-icon">\${isCollapsed ? '▸' : '▾'}</span>
                            <span class="column-title">\${col.label}</span>
                            <span class="column-count">\${columnTasks.length}</span>
                        </div>
                        <div class="task-list" data-status="\${col.status}">
                            \${columnTasks.map(task => renderTaskCard(task)).join('')}
                        </div>
                    </div>
                \`;
            }).join('');

            setupKanbanDragAndDrop();
            setupColumnCollapse();
        }

        function setupColumnCollapse() {
            document.querySelectorAll('.column-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    // Don't collapse when clicking on task cards (drag events)
                    if (e.target.closest('.task-card')) return;
                    const status = header.dataset.status;
                    vscode.postMessage({ type: 'toggleColumnCollapse', status });
                });
            });
        }

        function renderTaskCard(task) {
            const priorityClass = task.priority ? \`priority-\${task.priority}\` : '';
            const priorityBadge = task.priority ?
                \`<span class="priority-badge \${priorityClass}">\${task.priority}</span>\` : '';

            const labels = task.labels.slice(0, 2).map(l =>
                \`<span class="task-label">\${l}</span>\`
            ).join('');

            // Build dependency indicators (tasks this task depends on)
            const depsHtml = task.dependencies && task.dependencies.length > 0
                ? \`<span class="task-deps">
                    \${arrowLeftIcon}
                    \${task.dependencies.slice(0, 2).map(id =>
                        \`<a href="#" class="dep-link" data-task-id="\${escapeHtml(id)}">\${escapeHtml(id)}</a>\`
                    ).join(', ')}
                    \${task.dependencies.length > 2 ? \`<span class="dep-overflow">+\${task.dependencies.length - 2}</span>\` : ''}
                   </span>\`
                : '';

            // Build blocks indicators (tasks that depend on this task)
            const blocksHtml = task.blocksTaskIds && task.blocksTaskIds.length > 0
                ? \`<span class="task-deps">
                    \${arrowRightIcon}
                    \${task.blocksTaskIds.slice(0, 2).map(id =>
                        \`<a href="#" class="dep-link" data-task-id="\${escapeHtml(id)}">\${escapeHtml(id)}</a>\`
                    ).join(', ')}
                    \${task.blocksTaskIds.length > 2 ? \`<span class="dep-overflow">+\${task.blocksTaskIds.length - 2}</span>\` : ''}
                   </span>\`
                : '';

            const depsSection = (depsHtml || blocksHtml)
                ? \`<div class="task-card-deps">\${depsHtml}\${blocksHtml}</div>\`
                : '';

            return \`
                <div class="task-card" tabindex="0" draggable="true" data-task-id="\${task.id}" data-ordinal="\${task.ordinal || 0}">
                    <div class="task-card-title">\${escapeHtml(task.title)}</div>
                    <div class="task-card-meta">
                        \${priorityBadge}
                        \${labels}
                    </div>
                    \${depsSection}
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

                card.addEventListener('click', (e) => {
                    // Check if click was on a dependency link
                    const depLink = e.target.closest('.dep-link');
                    if (depLink) {
                        e.preventDefault();
                        e.stopPropagation();
                        vscode.postMessage({
                            type: 'openTask',
                            taskId: depLink.dataset.taskId
                        });
                        return;
                    }
                    // Regular card click
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

                    if (originalStatus === newStatus) {
                        // Same column - reorder within column
                        const dropTarget = getDropTarget(e, list, card);
                        if (!dropTarget && card === list.lastElementChild) return; // No change

                        const newOrdinal = calculateNewOrdinal(dropTarget, list, card);

                        // Optimistic reorder
                        card.classList.add('saving');
                        if (dropTarget) {
                            list.insertBefore(card, dropTarget);
                        } else {
                            list.appendChild(card);
                        }
                        card.dataset.ordinal = String(newOrdinal);

                        vscode.postMessage({
                            type: 'reorderTask',
                            taskId: taskId,
                            ordinal: newOrdinal
                        });
                    } else {
                        // Different column - status change
                        card.classList.add('saving');
                        card.dataset.originalStatus = originalStatus || '';
                        list.appendChild(card);
                        updateColumnCounts();

                        vscode.postMessage({
                            type: 'updateTaskStatus',
                            taskId: taskId,
                            status: newStatus
                        });
                    }
                });
            });
        }

        function getDropTarget(e, list, draggedCard) {
            const cards = [...list.querySelectorAll('.task-card:not(.dragging)')].filter(c => c !== draggedCard);
            return cards.find(card => {
                const rect = card.getBoundingClientRect();
                return e.clientY < rect.top + rect.height / 2;
            }) || null;
        }

        function calculateNewOrdinal(dropTarget, list, draggedCard) {
            const DEFAULT_STEP = 1000;
            const cards = [...list.querySelectorAll('.task-card')].filter(c => c !== draggedCard);

            if (!dropTarget) {
                // Dropping at end
                if (cards.length === 0) return DEFAULT_STEP;
                const lastCard = cards[cards.length - 1];
                const lastOrdinal = parseFloat(lastCard.dataset.ordinal) || 0;
                return lastOrdinal + DEFAULT_STEP;
            }

            const targetIndex = cards.indexOf(dropTarget);
            const nextOrdinal = parseFloat(dropTarget.dataset.ordinal) || DEFAULT_STEP;

            if (targetIndex === 0) {
                // Dropping at start
                return nextOrdinal / 2;
            }

            const prevCard = cards[targetIndex - 1];
            const prevOrdinal = parseFloat(prevCard.dataset.ordinal) || 0;
            return (prevOrdinal + nextOrdinal) / 2;
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

            // Compact dependency indicator for list view
            const depsCount = (task.dependencies || []).length;
            const blocksCount = (task.blocksTaskIds || []).length;
            const depsIndicator = (depsCount > 0 || blocksCount > 0)
                ? \`<span class="deps-indicator" title="Blocked by: \${depsCount}, Blocks: \${blocksCount}">
                    \${depsCount > 0 ? \`\${arrowLeftIcon}\${depsCount}\` : ''}
                    \${blocksCount > 0 ? \`\${arrowRightIcon}\${blocksCount}\` : ''}
                   </span>\`
                : '';

            return \`
                <tr data-task-id="\${task.id}" tabindex="0">
                    <td>\${escapeHtml(task.title)} \${depsIndicator}</td>
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

            if (viewMode === 'kanban') {
                kanbanView.classList.remove('hidden');
                listView.classList.add('hidden');
            } else {
                kanbanView.classList.add('hidden');
                listView.classList.remove('hidden');
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
                case 'columnCollapseChanged':
                    collapsedColumns = new Set(message.collapsedColumns);
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

  /**
   * Override refresh to also send statuses from config.
   * Uses cross-branch loading when configured.
   */
  async refresh(): Promise<void> {
    if (!this._view) return;

    if (!this.parser) {
      this.postMessage({ type: 'noBacklogFolder' });
      return;
    }

    try {
      // Use cross-branch loading when in cross-branch mode
      const taskLoader =
        this.dataSourceMode === 'cross-branch'
          ? this.parser.getTasksWithCrossBranch()
          : this.parser.getTasks();

      const [tasks, statuses] = await Promise.all([taskLoader, this.parser.getStatuses()]);

      // Compute reverse dependencies (blocksTaskIds) for each task
      const tasksWithBlocks = await Promise.all(
        tasks.map(async (task) => ({
          ...task,
          blocksTaskIds: await this.parser!.getBlockedByThisTask(task.id),
        }))
      );

      this.postMessage({ type: 'statusesUpdated', statuses });
      this.postMessage({ type: 'tasksUpdated', tasks: tasksWithBlocks });
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

      case 'reorderTask': {
        if (!this.parser) break;
        const taskId = message.taskId;
        try {
          const writer = new BacklogWriter();
          await writer.updateTask(taskId, { ordinal: message.ordinal }, this.parser);
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
        } catch (error) {
          console.error('Error reordering task:', error);
          // For reorder errors, just remove saving state - no need to restore position
          // since the UI already shows the new position optimistically
          this.postMessage({ type: 'taskUpdateSuccess', taskId });
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

      case 'toggleColumnCollapse': {
        const status = message.status;
        if (this.collapsedColumns.has(status)) {
          this.collapsedColumns.delete(status);
        } else {
          this.collapsedColumns.add(status);
        }
        // Persist to globalState
        if (this.context) {
          await this.context.globalState.update(
            'backlog.collapsedColumns',
            Array.from(this.collapsedColumns)
          );
        }
        // Notify webview
        this.postMessage({
          type: 'columnCollapseChanged',
          collapsedColumns: Array.from(this.collapsedColumns),
        });
        break;
      }
    }
  }

  /**
   * Set the data source mode and notify the webview
   */
  setDataSourceMode(mode: DataSourceMode, reason?: string): void {
    this.dataSourceMode = mode;
    this.dataSourceReason = reason;
    this.postMessage({ type: 'dataSourceChanged', mode, reason });
  }

  /**
   * Get the current data source mode
   */
  getDataSourceMode(): DataSourceMode {
    return this.dataSourceMode;
  }

  /**
   * Set the view mode (kanban or list) from external command
   */
  setViewMode(mode: 'kanban' | 'list'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (this.context) {
      this.context.globalState.update('backlog.viewMode', mode);
    }
    this.postMessage({ type: 'viewModeChanged', viewMode: mode });
  }
}

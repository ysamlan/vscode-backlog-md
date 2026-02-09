<script lang="ts">
  import { getReadOnlyTaskContext, type Task, type Milestone, type TaskStatus, type DashboardStats, type TabMode, type BacklogDocument, type BacklogDecision, type TaskIdDisplayMode } from '../../lib/types';
  import { vscode, onMessage } from '../../stores/vscode.svelte';
  import KanbanBoard from '../kanban/KanbanBoard.svelte';
  import ListView from '../list/ListView.svelte';
  import Dashboard from '../dashboard/Dashboard.svelte';
  import DocumentsList from '../docs/DocumentsList.svelte';
  import DecisionsList from '../decisions/DecisionsList.svelte';
  import TabBar from '../shared/TabBar.svelte';
  import Toast from '../shared/Toast.svelte';
  import KeyboardShortcutsPopup from '../shared/KeyboardShortcutsPopup.svelte';
  import { onMount } from 'svelte';
  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface StatusColumn {
    status: string;
    label: string;
  }

  // State
  let activeTab = $state<TabMode>('kanban');
  let tasks = $state<TaskWithBlocks[]>([]);
  let completedTasks = $state<TaskWithBlocks[]>([]);
  let columns = $state<StatusColumn[]>([
    { status: 'To Do', label: 'To Do' },
    { status: 'In Progress', label: 'In Progress' },
    { status: 'Done', label: 'Done' },
  ]);
  let configMilestones = $state<Milestone[]>([]);
  let statuses = $derived(columns.map((c) => c.status));
  let milestoneGrouping = $state(false);
  let collapsedColumns = $state(new Set<string>());
  let collapsedMilestones = $state(new Set<string>());
  let noBacklog = $state(false);

  // Dashboard state
  let dashboardStats = $state<DashboardStats | null>(null);

  // Config state
  let projectName = $state<string | undefined>(undefined);

  // Documents & Decisions state
  let documents = $state<BacklogDocument[]>([]);
  let decisions = $state<BacklogDecision[]>([]);

  // List view state
  let currentFilter = $state('all');
  let currentMilestone = $state('');
  let currentLabel = $state('');
  let searchQuery = $state('');

  // Toast state
  let toastMessage = $state<string | null>(null);

  // Draft count for tab badge
  let draftCount = $state(0);
  let taskIdDisplay = $state<TaskIdDisplayMode>('full');

  // Keyboard shortcuts popup state
  let showShortcuts = $state(false);

  // Message handlers
  onMessage((message) => {
    switch (message.type) {
      case 'statusesUpdated':
        columns = message.statuses.map((status: string) => ({
          status,
          label: status,
        }));
        break;

      case 'milestonesUpdated':
        configMilestones = message.milestones;
        break;

      case 'tasksUpdated':
        tasks = message.tasks;
        noBacklog = false;
        break;

      case 'activeTabChanged':
        activeTab = message.tab;
        break;

      // Backward compatibility with old messages
      case 'viewModeChanged':
        if (activeTab !== 'drafts' && activeTab !== 'archived') {
          activeTab = message.viewMode;
        }
        break;

      case 'draftsModeChanged':
        if (message.enabled) {
          activeTab = 'drafts';
        } else if (activeTab === 'drafts') {
          activeTab = 'kanban';
        }
        break;

      case 'taskUpdateSuccess': {
        // Remove saving state from card
        const card = document.querySelector(`[data-task-id="${message.taskId}"]`);
        if (card) {
          card.classList.remove('saving');
        }
        break;
      }

      case 'taskUpdateError': {
        const card = document.querySelector(`[data-task-id="${message.taskId}"]`);
        if (card) {
          card.classList.remove('saving');
          // Move back to original column
          const origList = document.querySelector(
            `.task-list[data-status="${message.originalStatus}"]`
          );
          if (origList) {
            origList.appendChild(card);
          }
        }
        showToast(message.message || 'Failed to update task');
        break;
      }

      case 'noBacklogFolder':
        noBacklog = true;
        break;

      case 'columnCollapseChanged':
        collapsedColumns = new Set(message.collapsedColumns);
        break;

      case 'milestoneCollapseChanged':
        collapsedMilestones = new Set(message.collapsedMilestones);
        break;

      case 'milestoneGroupingChanged':
        milestoneGrouping = message.enabled;
        break;

      case 'setFilter':
        currentFilter = message.filter;
        break;

      case 'setLabelFilter':
        currentLabel = message.label;
        currentFilter = 'all';
        break;

      case 'completedTasksUpdated':
        completedTasks = message.tasks;
        break;

      case 'draftCountUpdated':
        draftCount = message.count;
        break;

      case 'settingsUpdated':
        taskIdDisplay = message.settings.taskIdDisplay;
        break;

      case 'statsUpdated':
        dashboardStats = message.stats;
        break;

      case 'documentsUpdated':
        documents = message.documents as BacklogDocument[];
        break;

      case 'decisionsUpdated':
        decisions = message.decisions as BacklogDecision[];
        break;

      case 'configUpdated':
        projectName = message.config?.projectName;
        break;

      case 'error':
        console.error('[Tasks]', message.message);
        break;
    }
  });

  function focusSibling(selector: string, direction: 1 | -1) {
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    if (elements.length === 0) return;
    const focused = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(focused);
    const nextIndex = currentIndex + direction;
    const target = elements[nextIndex] ?? elements[direction === 1 ? 0 : elements.length - 1];
    target?.focus();
  }

  function focusAdjacentColumn(direction: 1 | -1) {
    const cols = Array.from(document.querySelectorAll('.kanban-column')) as HTMLElement[];
    if (cols.length === 0) return;
    const focused = document.activeElement as HTMLElement;
    const currentCol = focused?.closest('.kanban-column') as HTMLElement;
    const currentIndex = currentCol ? cols.indexOf(currentCol) : -1;
    const nextIndex = currentIndex + direction;
    const targetCol = cols[nextIndex] ?? cols[direction === 1 ? 0 : cols.length - 1];
    const firstCard = targetCol?.querySelector('[data-task-id]') as HTMLElement;
    firstCard?.focus();
  }

  onMount(() => {
    vscode.postMessage({ type: 'refresh' });

    function handleGlobalKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        showShortcuts = false;
        return;
      }

      if (e.key === '?') {
        showShortcuts = !showShortcuts;
        return;
      }

      // All other shortcuts are suppressed while the popup is open
      if (showShortcuts) return;

      switch (e.key) {
        case 'z': handleTabChange('kanban'); break;
        case 'x': handleTabChange('list'); break;
        case 'c': handleTabChange('drafts'); break;
        case 'v': handleTabChange('archived'); break;
        case 'd': handleTabChange('dashboard'); break;
        case 'b': handleTabChange('docs'); break;
        case 'm': handleTabChange('decisions'); break;
        case 'j': focusSibling('[data-task-id]', 1); break;
        case 'k': focusSibling('[data-task-id]', -1); break;
        case 'h': focusAdjacentColumn(-1); break;
        case 'l': focusAdjacentColumn(1); break;
        case 'n': vscode.postMessage({ type: 'requestCreateTask' }); break;
        case 'r': vscode.postMessage({ type: 'refresh' }); break;
        case '/': {
          e.preventDefault();
          const searchInput = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
          searchInput?.focus();
          break;
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });

  function handleTabChange(tab: TabMode) {
    activeTab = tab;
    vscode.postMessage({ type: 'setViewMode', mode: tab });
  }

  function showToast(message: string) {
    toastMessage = message;
  }

  function hideToast() {
    toastMessage = null;
  }

  // Kanban handlers
  function handleOpenTask(
    taskId: string,
    taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>
  ) {
    const message: {
      type: 'openTask';
      taskId: string;
      filePath?: string;
      source?: Task['source'];
      branch?: string;
    } = { type: 'openTask', taskId };

    if (taskMeta?.filePath) {
      message.filePath = taskMeta.filePath;
    }
    if (taskMeta?.source) {
      message.source = taskMeta.source;
    }
    if (taskMeta?.branch) {
      message.branch = taskMeta.branch;
    }

    vscode.postMessage(message);
  }

  function handleSelectTask(taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) {
    vscode.postMessage({
      type: 'selectTask',
      taskId,
      filePath: taskMeta?.filePath,
      source: taskMeta?.source,
      branch: taskMeta?.branch,
    });
  }

  function handleToggleColumnCollapse(status: string) {
    vscode.postMessage({ type: 'toggleColumnCollapse', status });
  }

  function handleToggleMilestoneCollapse(milestone: string) {
    vscode.postMessage({ type: 'toggleMilestoneCollapse', milestone });
  }

  function handleReorderTasks(updates: Array<{ taskId: string; ordinal: number }>) {
    // Mark cards as saving
    for (const update of updates) {
      const card = document.querySelector(`[data-task-id="${update.taskId}"]`);
      if (card) {
        card.classList.add('saving');
        (card as HTMLElement).dataset.ordinal = String(update.ordinal);
      }
    }
    vscode.postMessage({ type: 'reorderTasks', updates });
  }

  function handleUpdateTaskStatus(
    taskId: string,
    status: string,
    ordinal: number | undefined,
    additionalUpdates: Array<{ taskId: string; ordinal: number }>
  ) {
    // Mark card as saving
    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
      card.classList.add('saving');
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        (card as HTMLElement).dataset.originalStatus = task.status;
      }
      if (ordinal !== undefined) {
        (card as HTMLElement).dataset.ordinal = String(ordinal);
      }
    }

    // Update additional cards
    for (const update of additionalUpdates) {
      const c = document.querySelector(`[data-task-id="${update.taskId}"]`);
      if (c) {
        (c as HTMLElement).dataset.ordinal = String(update.ordinal);
      }
    }

    vscode.postMessage({
      type: 'updateTaskStatus',
      taskId,
      status: status as TaskStatus,
      ordinal,
      additionalOrdinalUpdates: additionalUpdates,
    });
  }

  function handleToggleMilestoneGrouping(enabled: boolean) {
    milestoneGrouping = enabled;
    vscode.postMessage({ type: 'toggleMilestoneGrouping', enabled });
  }

  // List handlers
  function handleFilterChange(filter: string) {
    currentFilter = filter;
  }

  function handleMilestoneChange(milestone: string) {
    currentMilestone = milestone;
  }

  function handleSearchChange(query: string) {
    searchQuery = query;
  }

  function handleLabelChange(label: string) {
    currentLabel = label;
  }

  function handleRequestCompletedTasks() {
    vscode.postMessage({ type: 'requestCompletedTasks' });
  }

  function handleReadOnlyDragAttempt(task: TaskWithBlocks) {
    showToast(`Cannot reorder task: ${task.id} is read-only from ${getReadOnlyTaskContext(task)}.`);
  }
</script>

<TabBar
  {activeTab}
  {draftCount}
  onTabChange={handleTabChange}
  onCreateTask={() => vscode.postMessage({ type: 'requestCreateTask' })}
  onRefresh={() => vscode.postMessage({ type: 'refresh' })}
/>

{#if noBacklog}
  <div class="empty-state">
    <div class="empty-state-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 18v-1"/><path d="M14 18v-3"/><path d="M10 13V8l4 5V8"/></svg>
    </div>
    <h3>No Backlog Found</h3>
    <p>
      This workspace doesn't have a <code>backlog/</code> folder.
    </p>
    <p>
      To use Backlog.md, create a <code>backlog/tasks/</code> folder<br />
      in your project root with markdown task files.
    </p>
  </div>
{:else if activeTab === 'kanban'}
  <div id="kanban-view" class="view-content">
    <div class="kanban-toolbar">
      <div class="grouping-toggle">
        <button
          class="grouping-btn"
          class:active={!milestoneGrouping}
          data-grouping="none"
          onclick={() => handleToggleMilestoneGrouping(false)}
        >
          All Tasks
        </button>
        <button
          class="grouping-btn"
          class:active={milestoneGrouping}
          data-grouping="milestone"
          onclick={() => handleToggleMilestoneGrouping(true)}
        >
          By Milestone
        </button>
      </div>
    </div>
    <div id="kanban-app">
      <KanbanBoard
        {tasks}
        {columns}
        {milestoneGrouping}
        {configMilestones}
        {collapsedColumns}
        {collapsedMilestones}
        {taskIdDisplay}
        onSelectTask={handleSelectTask}
        onOpenTask={handleOpenTask}
        onToggleColumnCollapse={handleToggleColumnCollapse}
        onToggleMilestoneCollapse={handleToggleMilestoneCollapse}
        onReadOnlyDragAttempt={handleReadOnlyDragAttempt}
        onReorderTasks={handleReorderTasks}
        onUpdateTaskStatus={handleUpdateTaskStatus}
      />
    </div>
  </div>
{:else if activeTab === 'list' || activeTab === 'drafts'}
  <div id="list-view" class="view-content">
    <ListView
      {tasks}
      {statuses}
      milestones={configMilestones}
      {taskIdDisplay}
      {currentFilter}
      {currentMilestone}
      {currentLabel}
      {searchQuery}
      isDraftsView={activeTab === 'drafts'}
      {completedTasks}
      onSelectTask={handleSelectTask}
      onOpenTask={handleOpenTask}
      onFilterChange={handleFilterChange}
      onMilestoneChange={handleMilestoneChange}
      onLabelChange={handleLabelChange}
      onSearchChange={handleSearchChange}
      onReorderTasks={handleReorderTasks}
      onReadOnlyDragAttempt={handleReadOnlyDragAttempt}
      onRequestCompletedTasks={handleRequestCompletedTasks}
    />
  </div>
{:else if activeTab === 'archived'}
  <div id="archived-view" class="view-content">
    <ListView
      {tasks}
      {statuses}
      milestones={configMilestones}
      {taskIdDisplay}
      {currentFilter}
      {currentMilestone}
      {currentLabel}
      {searchQuery}
      isArchivedView={true}
      onSelectTask={handleSelectTask}
      onOpenTask={handleOpenTask}
      onFilterChange={handleFilterChange}
      onMilestoneChange={handleMilestoneChange}
      onLabelChange={handleLabelChange}
      onSearchChange={handleSearchChange}
    />
  </div>
{:else if activeTab === 'dashboard'}
  <div id="dashboard-view" class="view-content">
    <Dashboard stats={dashboardStats} {noBacklog} {projectName} />
  </div>
{:else if activeTab === 'docs'}
  <div id="docs-view" class="view-content">
    <DocumentsList {documents} />
  </div>
{:else if activeTab === 'decisions'}
  <div id="decisions-view" class="view-content">
    <DecisionsList {decisions} />
  </div>
{/if}

{#if toastMessage}
  <Toast message={toastMessage} onDismiss={hideToast} />
{/if}

<button
  class="shortcuts-help-btn"
  data-testid="shortcuts-help-btn"
  onclick={() => showShortcuts = !showShortcuts}
  title="Keyboard shortcuts (?)"
>?</button>

<KeyboardShortcutsPopup isOpen={showShortcuts} onClose={() => showShortcuts = false} />

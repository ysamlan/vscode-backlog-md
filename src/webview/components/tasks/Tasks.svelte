<script lang="ts">
  import type { Task, Milestone, TaskStatus } from '../../lib/types';
  import { vscode, onMessage } from '../../stores/vscode.svelte';
  import KanbanBoard from '../kanban/KanbanBoard.svelte';
  import ListView from '../list/ListView.svelte';
  import Toast from '../shared/Toast.svelte';
  import { onMount } from 'svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface StatusColumn {
    status: string;
    label: string;
  }

  // State
  let viewMode = $state<'kanban' | 'list'>('kanban');
  let draftsMode = $state(false);
  let tasks = $state<TaskWithBlocks[]>([]);
  let completedTasks = $state<TaskWithBlocks[]>([]);
  let columns = $state<StatusColumn[]>([
    { status: 'To Do', label: 'To Do' },
    { status: 'In Progress', label: 'In Progress' },
    { status: 'Done', label: 'Done' },
  ]);
  let configMilestones = $state<Milestone[]>([]);
  let milestoneGrouping = $state(false);
  let collapsedColumns = $state(new Set<string>());
  let collapsedMilestones = $state(new Set<string>());
  let noBacklog = $state(false);

  // List view state
  let currentFilter = $state('all');
  let currentMilestone = $state('');
  let searchQuery = $state('');

  // Toast state
  let toastMessage = $state<string | null>(null);

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

      case 'viewModeChanged':
        viewMode = message.viewMode;
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

      case 'draftsModeChanged':
        draftsMode = message.enabled;
        break;

      case 'completedTasksUpdated':
        completedTasks = message.tasks;
        break;

      case 'error':
        console.error('[Tasks]', message.message);
        break;
    }
  });

  onMount(() => {
    vscode.postMessage({ type: 'refresh' });
  });

  function showToast(message: string) {
    toastMessage = message;
  }

  function hideToast() {
    toastMessage = null;
  }

  // Kanban handlers
  function handleOpenTask(taskId: string) {
    vscode.postMessage({ type: 'openTask', taskId });
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

  function handleCompleteTask(taskId: string) {
    vscode.postMessage({ type: 'completeTask', taskId });
  }

  function handlePromoteDraft(taskId: string) {
    vscode.postMessage({ type: 'promoteDraft', taskId });
  }

  function handleRequestCompletedTasks() {
    vscode.postMessage({ type: 'requestCompletedTasks' });
  }
</script>

<div id="kanban-view" class="view-content" class:hidden={viewMode !== 'kanban' || draftsMode}>
  {#if noBacklog}
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <h3>No Backlog Found</h3>
      <p>
        This workspace doesn't have a <code>backlog/</code> folder.
      </p>
      <p>
        To use Backlog.md, create a <code>backlog/tasks/</code> folder<br />
        in your project root with markdown task files.
      </p>
    </div>
  {:else}
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
        onOpenTask={handleOpenTask}
        onToggleColumnCollapse={handleToggleColumnCollapse}
        onToggleMilestoneCollapse={handleToggleMilestoneCollapse}
        onReorderTasks={handleReorderTasks}
        onUpdateTaskStatus={handleUpdateTaskStatus}
      />
    </div>
  {/if}
</div>

<div id="list-view" class="view-content" class:hidden={viewMode !== 'list' && !draftsMode}>
  {#if noBacklog}
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <h3>No Backlog Found</h3>
      <p>
        This workspace doesn't have a <code>backlog/</code> folder.
      </p>
      <p>
        To use Backlog.md, create a <code>backlog/tasks/</code> folder<br />
        in your project root with markdown task files.
      </p>
    </div>
  {:else}
    <ListView
      {tasks}
      milestones={configMilestones}
      {currentFilter}
      {currentMilestone}
      {searchQuery}
      isDraftsView={draftsMode}
      {completedTasks}
      onOpenTask={handleOpenTask}
      onFilterChange={handleFilterChange}
      onMilestoneChange={handleMilestoneChange}
      onSearchChange={handleSearchChange}
      onReorderTasks={handleReorderTasks}
      onCompleteTask={handleCompleteTask}
      onPromoteDraft={handlePromoteDraft}
      onRequestCompletedTasks={handleRequestCompletedTasks}
    />
  {/if}
</div>

{#if toastMessage}
  <Toast message={toastMessage} onDismiss={hideToast} />
{/if}

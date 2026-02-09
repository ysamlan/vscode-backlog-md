<script lang="ts">
  import {
    isReadOnlyTask,
    getReadOnlyTaskContext,
    type Task,
    type Milestone,
    type TaskIdDisplayMode,
  } from '../../lib/types';
  import { statusToClass, customStatusStyle } from '../../lib/statusColors';
  import { formatTaskIdForDisplay } from '../../lib/taskIdDisplay';
  import { compareByOrdinal, calculateOrdinalsForDrop, type CardData } from '../../../core/ordinalUtils';
  import PriorityIcon from '../shared/PriorityIcon.svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface Props {
    tasks: TaskWithBlocks[];
    statuses: string[];
    milestones: Milestone[];
    taskIdDisplay: TaskIdDisplayMode;
    currentFilter: string;
    currentMilestone: string;
    currentLabel: string;
    searchQuery: string;
    isDraftsView?: boolean;
    isArchivedView?: boolean;
    completedTasks?: TaskWithBlocks[];
    onSelectTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onFilterChange: (filter: string) => void;
    onMilestoneChange: (milestone: string) => void;
    onLabelChange: (label: string) => void;
    onSearchChange: (query: string) => void;
    onReorderTasks?: (updates: Array<{ taskId: string; ordinal: number }>) => void;
    onReadOnlyDragAttempt?: (task: TaskWithBlocks) => void;
    onRequestCompletedTasks?: () => void;
  }

  let {
    tasks,
    statuses = [],
    milestones,
    taskIdDisplay,
    currentFilter,
    currentMilestone,
    currentLabel,
    searchQuery,
    isDraftsView = false,
    isArchivedView = false,
    completedTasks = [],
    onSelectTask,
    onOpenTask,
    onFilterChange,
    onMilestoneChange,
    onLabelChange,
    onSearchChange,
    onReorderTasks,
    onReadOnlyDragAttempt,
    onRequestCompletedTasks,
  }: Props = $props();

  let statusOrder = $derived(
    Object.fromEntries(statuses.map((status, index) => [status, index])) as Record<string, number>
  );

  let currentSort = $state<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'status',
    direction: 'asc',
  });
  let showingCompleted = $state(false);
  let completedRequested = $state(false);

  const LEGACY_FILTER_TO_STATUS: Record<string, string> = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    done: 'Done',
  };

  function getFilterStatus(filter: string): string | null {
    if (filter.startsWith('status:')) {
      return filter.slice('status:'.length);
    }
    return LEGACY_FILTER_TO_STATUS[filter] ?? null;
  }

  function isStatusFilterActive(status: string): boolean {
    return getFilterStatus(currentFilter) === status && !showingCompleted;
  }

  function taskRowKey(task: TaskWithBlocks): string {
    // filePath is unique across local and cross-branch task sources.
    return task.filePath || `${task.id}:${task.source ?? 'local'}:${task.branch ?? ''}`;
  }

  // Get unique labels from tasks (for dropdown)
  let allLabels = $derived([...new Set(tasks.flatMap((t) => t.labels))].sort());

  // Get unique milestones from tasks (for dropdown)
  let taskMilestones = $derived([...new Set(tasks.map((t) => t.milestone).filter(Boolean))] as string[]);
  let configMilestoneNames = $derived(milestones.map((m) => m.name));
  let allMilestones = $derived([
    ...configMilestoneNames,
    ...taskMilestones.filter((m) => !configMilestoneNames.includes(m)),
  ]);

  // Filter tasks
  let filteredTasks = $derived.by(() => {
    // When showing completed tasks, use that list instead
    if (showingCompleted) {
      let filtered: TaskWithBlocks[] = completedTasks;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            (t.description && t.description.toLowerCase().includes(query))
        );
      }
      return filtered;
    }

    let filtered = tasks;

    // In drafts/archived view, show all tasks (no status filtering)
    if (!isDraftsView && !isArchivedView) {
      const filterStatus = getFilterStatus(currentFilter);
      if (filterStatus) {
        filtered = filtered.filter((t) => t.status === filterStatus);
      } else if (currentFilter === 'high-priority') {
        filtered = filtered.filter((t) => t.priority === 'high');
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query))
      );
    }

    if (currentMilestone) {
      filtered = filtered.filter((t) => t.milestone === currentMilestone);
    }

    if (currentLabel) {
      filtered = filtered.filter((t) => t.labels.includes(currentLabel));
    }

    return filtered;
  });

  // Sort tasks
  let sortedTasks = $derived.by(() => {
    return [...filteredTasks].sort((a, b) => {
      let aVal: string | number = (a as Record<string, unknown>)[currentSort.field] as string ?? '';
      let bVal: string | number = (b as Record<string, unknown>)[currentSort.field] as string ?? '';

      if (currentSort.field === 'priority') {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2, '': 3 };
        aVal = order[aVal as string] ?? 3;
        bVal = order[bVal as string] ?? 3;
      }

      if (currentSort.field === 'status') {
        aVal = statusOrder[aVal as string] ?? statuses.length;
        bVal = statusOrder[bVal as string] ?? statuses.length;
      }

      if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;

      // Ordinal tiebreaker when sorting by status (matches kanban ordering)
      if (currentSort.field === 'status') {
        const cardA: CardData = { taskId: a.id, ordinal: a.ordinal };
        const cardB: CardData = { taskId: b.id, ordinal: b.ordinal };
        return compareByOrdinal(cardA, cardB);
      }

      return 0;
    });
  });

  // Build hierarchical display list: insert subtasks directly after their parent
  type DisplayEntry = { task: TaskWithBlocks; isSubtask: boolean };
  let displayTasks = $derived.by((): DisplayEntry[] => {
    // Build a lookup of parentTaskId -> children present in sortedTasks
    const childrenByParent: Record<string, TaskWithBlocks[]> = {};
    const subtaskIds: Record<string, true> = {};

    for (const task of sortedTasks) {
      if (task.parentTaskId) {
        subtaskIds[task.id] = true;
        (childrenByParent[task.parentTaskId] ??= []).push(task);
      }
    }

    // If there are no subtasks at all, skip the extra work
    if (Object.keys(subtaskIds).length === 0) {
      return sortedTasks.map((task) => ({ task, isSubtask: false }));
    }

    const result: DisplayEntry[] = [];
    for (const task of sortedTasks) {
      // Skip subtasks in their original sorted position; they will be
      // inserted after their parent instead.
      if (subtaskIds[task.id]) continue;

      result.push({ task, isSubtask: false });

      // Append any children of this task immediately after it
      const children = childrenByParent[task.id];
      if (children) {
        for (const child of children) {
          result.push({ task: child, isSubtask: true });
        }
      }
    }

    // Append orphaned subtasks whose parent is not in the current list
    for (const task of sortedTasks) {
      if (subtaskIds[task.id] && !result.some((e) => e.task.id === task.id)) {
        result.push({ task, isSubtask: true });
      }
    }

    return result;
  });

  function getSortIndicator(field: string): string {
    if (currentSort.field !== field) return '';
    return currentSort.direction === 'asc' ? '↑' : '↓';
  }

  function handleSort(field: string) {
    if (currentSort.field === field) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.field = field;
      currentSort.direction = 'asc';
    }
  }

  function handleRowKeydown(e: KeyboardEvent, task: TaskWithBlocks) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (e.target as HTMLElement).nextElementSibling as HTMLElement;
      if (next?.dataset.taskId) next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (e.target as HTMLElement).previousElementSibling as HTMLElement;
      if (prev?.dataset.taskId) prev.focus();
    }
  }

  function getStatusBadgeStyle(status: string): string {
    return customStatusStyle(status);
  }

  // Drag-and-drop state
  let isDragEnabled = $derived(currentSort.field === 'status');
  let draggedTaskId = $state<string | null>(null);
  let dropTargetTaskId = $state<string | null>(null);
  let dropPosition = $state<'before' | 'after' | null>(null);
  let justDragged = $state(false);

  function handleDragStart(e: DragEvent, taskId: string) {
    if (!isDragEnabled) return;
    const task = sortedTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (isReadOnlyTask(task)) {
      onReadOnlyDragAttempt?.(task);
      e.preventDefault();
      return;
    }
    draggedTaskId = taskId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
    }
  }

  function handleDragEnd() {
    draggedTaskId = null;
    dropTargetTaskId = null;
    dropPosition = null;
    // Suppress row click after drag
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
  }

  function handleDragOver(e: DragEvent, taskId: string) {
    if (!isDragEnabled || !draggedTaskId || draggedTaskId === taskId) return;

    // Only allow reordering within the same status group
    const draggedTask = sortedTasks.find((t) => t.id === draggedTaskId);
    const targetTask = sortedTasks.find((t) => t.id === taskId);
    if (
      !draggedTask ||
      !targetTask ||
      draggedTask.status !== targetTask.status ||
      isReadOnlyTask(draggedTask) ||
      isReadOnlyTask(targetTask)
    ) {
      return;
    }

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    // Determine drop position based on mouse Y within row
    const row = (e.target as HTMLElement).closest('tr');
    if (row) {
      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      dropTargetTaskId = taskId;
      dropPosition = e.clientY < midY ? 'before' : 'after';
    }
  }

  function handleDragLeave(e: DragEvent) {
    // Only clear if leaving the tbody entirely
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !related.closest?.('tbody')) {
      dropTargetTaskId = null;
      dropPosition = null;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!isDragEnabled || !draggedTaskId || !dropTargetTaskId || !dropPosition || !onReorderTasks) {
      handleDragEnd();
      return;
    }

    const draggedTask = sortedTasks.find((t) => t.id === draggedTaskId);
    const targetTask = sortedTasks.find((t) => t.id === dropTargetTaskId);
    if (
      !draggedTask ||
      !targetTask ||
      draggedTask.status !== targetTask.status ||
      isReadOnlyTask(draggedTask) ||
      isReadOnlyTask(targetTask)
    ) {
      handleDragEnd();
      return;
    }

    // Get tasks in the same status group (in current sorted order)
    const statusGroup = sortedTasks.filter((t) => t.status === draggedTask.status);

    // Build card data for the status group
    const existingCards: CardData[] = statusGroup.map((t) => ({
      taskId: t.id,
      ordinal: t.ordinal,
    }));

    // Calculate drop index
    const targetIndex = statusGroup.findIndex((t) => t.id === dropTargetTaskId);
    const dropIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex;

    const droppedCard: CardData = { taskId: draggedTaskId, ordinal: draggedTask.ordinal };
    const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

    if (updates.length > 0) {
      onReorderTasks(updates);
    }

    handleDragEnd();
  }

  function handleRowClickGuarded(task: TaskWithBlocks) {
    if (justDragged) return;
    onSelectTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
  }

  function handleCompletedFilter() {
    showingCompleted = !showingCompleted;
    if (showingCompleted && !completedRequested && onRequestCompletedTasks) {
      completedRequested = true;
      onRequestCompletedTasks();
    }
  }

</script>

<div class="task-list-container">
  <div class="search-bar">
    <input
      type="text"
      class="search-input"
      placeholder="Search tasks..."
      value={searchQuery}
      oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
      data-testid="search-input"
    />
  </div>

  {#if isArchivedView}
    <div class="filter-buttons">
      <span class="drafts-label" data-testid="archived-label">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>
        </svg>
        Archived
      </span>
    </div>
  {:else if isDraftsView}
    <div class="filter-buttons">
      <span class="drafts-label" data-testid="drafts-label">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>
        </svg>
        Drafts
      </span>
    </div>
  {:else}
    <div class="filter-buttons">
      <button
        class="filter-btn"
        class:active={currentFilter === 'all' && !showingCompleted}
        data-filter="all"
        onclick={() => { showingCompleted = false; onFilterChange('all'); }}
      >
        All
      </button>
      {#each statuses as status (status)}
        <button
          class="filter-btn"
          class:active={isStatusFilterActive(status)}
          data-filter={"status:" + status}
          onclick={() => { showingCompleted = false; onFilterChange(`status:${status}`); }}
        >
          {status}
        </button>
      {/each}
      <button
        class="filter-btn"
        class:active={currentFilter === 'high-priority' && !showingCompleted}
        data-filter="high-priority"
        onclick={() => { showingCompleted = false; onFilterChange('high-priority'); }}
      >
        High Priority
      </button>
      <button
        class="filter-btn"
        class:active={showingCompleted}
        data-filter="completed"
        data-testid="completed-filter"
        onclick={handleCompletedFilter}
      >
        Completed
      </button>
      <select
        class="milestone-filter"
        value={currentMilestone}
        onchange={(e) => onMilestoneChange((e.target as HTMLSelectElement).value)}
        data-testid="milestone-filter"
      >
        <option value="">All Milestones</option>
        {#each allMilestones as milestone (milestone)}
          <option value={milestone}>{milestone}</option>
        {/each}
      </select>
      {#if allLabels.length > 0}
        <select
          class="label-filter"
          value={currentLabel}
          onchange={(e) => onLabelChange((e.target as HTMLSelectElement).value)}
          data-testid="label-filter"
        >
          <option value="">All Labels</option>
          {#each allLabels as label (label)}
            <option value={label}>{label}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/if}

  <div id="taskListContent">
    {#if displayTasks.length === 0}
      <div class="empty-state" data-testid="empty-state">
        {#if isArchivedView}
          No archived tasks. Tasks you archive will appear here.
        {:else}
          No tasks found
        {/if}
      </div>
    {:else}
      <table class="task-table">
        <thead>
          <tr>
            {#if isDragEnabled}
              <th class="drag-handle-header"></th>
            {/if}
            <th
              data-sort="title"
              onclick={() => handleSort('title')}
              onkeydown={(e) => e.key === 'Enter' && handleSort('title')}
              role="button"
              tabindex="0"
            >
              Title {getSortIndicator('title')}
            </th>
            <th
              data-sort="status"
              onclick={() => handleSort('status')}
              onkeydown={(e) => e.key === 'Enter' && handleSort('status')}
              role="button"
              tabindex="0"
            >
              Status {getSortIndicator('status')}
            </th>
            <th
              data-sort="priority"
              onclick={() => handleSort('priority')}
              onkeydown={(e) => e.key === 'Enter' && handleSort('priority')}
              role="button"
              tabindex="0"
            >
              Priority {getSortIndicator('priority')}
            </th>
          </tr>
        </thead>
        <tbody
          ondragover={(e) => { if (isDragEnabled) e.preventDefault(); }}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
        >
          {#each displayTasks as { task, isSubtask } (taskRowKey(task))}
            {@const blockerCount = task.blockingDependencyIds?.length ?? 0}
            {@const isReadOnly = isReadOnlyTask(task)}
            <tr
              data-task-id={task.id}
              data-testid="task-row-{task.id}"
              tabindex="0"
              draggable={isDragEnabled && !isDraftsView && !isArchivedView && !showingCompleted && !isSubtask ? 'true' : undefined}
              class:dragging={draggedTaskId === task.id}
              class:drop-before={dropTargetTaskId === task.id && dropPosition === 'before'}
              class:drop-after={dropTargetTaskId === task.id && dropPosition === 'after'}
              class:completed-row={showingCompleted || task.source === 'completed'}
              class:draft-row={isDraftsView}
              class:archived-row={isArchivedView}
              class:subtask-row={isSubtask}
              class:readonly-row={isReadOnly}
              onclick={() => handleRowClickGuarded(task)}
              onkeydown={(e) => handleRowKeydown(e, task)}
              ondragstart={(e) => handleDragStart(e, task.id)}
              ondragend={handleDragEnd}
              ondragover={(e) => handleDragOver(e, task.id)}
            >
              {#if isDragEnabled && !isDraftsView && !isArchivedView && !showingCompleted}
                {#if isSubtask}
                  <td class="drag-handle drag-handle-blank"></td>
                {:else}
                  <td
                    class="drag-handle"
                    class:drag-handle-readonly={isReadOnly}
                    data-testid="drag-handle-{task.id}"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                  </td>
                {/if}
              {/if}
              <td>
                {#if isSubtask}
                  <span class="subtask-connector" aria-hidden="true">└</span>
                {/if}
                {#if isDraftsView}
                  <span class="draft-badge">DRAFT</span>
                {/if}
                {#if taskIdDisplay !== 'hidden'}
                  <span class="list-task-id" data-testid="task-row-id-{task.id}">
                    {formatTaskIdForDisplay(task.id, taskIdDisplay)}
                  </span>
                {/if}
                {task.title}
                {#if isReadOnly}
                  <span
                    class="readonly-indicator"
                    data-testid="readonly-indicator-{task.id}"
                    title="Read-only task from {getReadOnlyTaskContext(task)}"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 0-3-3H6"/><path d="M6 15h9a3 3 0 1 1 0 6h-3"/></svg>
                    {getReadOnlyTaskContext(task)}
                  </span>
                {/if}
                {#if blockerCount > 0}
                  <span
                    class="blocked-indicator"
                    data-testid="blocked-indicator-{task.id}"
                    title="Blocked by: {task.blockingDependencyIds!.join(', ')}"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    </svg>
                  </span>
                {/if}
                {#if task.labels.length > 0}
                  <span class="row-labels" data-testid="row-labels-{task.id}">
                    {#each task.labels as label (label)}
                      <span class="task-label">{label}</span>
                    {/each}
                  </span>
                {/if}
              </td>
              <td>
                <span class="status-badge status-{statusToClass(task.status)}" style={getStatusBadgeStyle(task.status)}>{task.status}</span>
              </td>
              <td>
                {#if task.priority}
                  <PriorityIcon priority={task.priority} size={14} />
                {:else}
                  -
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

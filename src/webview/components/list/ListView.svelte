<script lang="ts">
  import type { Task, Milestone } from '../../lib/types';
  import { statusToClass, customStatusStyle } from '../../lib/statusColors';
  import { compareByOrdinal, calculateOrdinalsForDrop, type CardData } from '../../../core/ordinalUtils';
  import PriorityIcon from '../shared/PriorityIcon.svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface Props {
    tasks: TaskWithBlocks[];
    statuses: string[];
    milestones: Milestone[];
    currentFilter: string;
    currentMilestone: string;
    currentLabel: string;
    searchQuery: string;
    isDraftsView?: boolean;
    isArchivedView?: boolean;
    completedTasks?: TaskWithBlocks[];
    onOpenTask: (taskId: string) => void;
    onFilterChange: (filter: string) => void;
    onMilestoneChange: (milestone: string) => void;
    onLabelChange: (label: string) => void;
    onSearchChange: (query: string) => void;
    onReorderTasks?: (updates: Array<{ taskId: string; ordinal: number }>) => void;
    onCompleteTask?: (taskId: string) => void;
    onPromoteDraft?: (taskId: string) => void;
    onRestoreTask?: (taskId: string) => void;
    onDeleteTask?: (taskId: string) => void;
    onRequestCompletedTasks?: () => void;
  }

  let {
    tasks,
    statuses = [],
    milestones,
    currentFilter,
    currentMilestone,
    currentLabel,
    searchQuery,
    isDraftsView = false,
    isArchivedView = false,
    completedTasks = [],
    onOpenTask,
    onFilterChange,
    onMilestoneChange,
    onLabelChange,
    onSearchChange,
    onReorderTasks,
    onCompleteTask,
    onPromoteDraft,
    onRestoreTask,
    onDeleteTask,
    onRequestCompletedTasks,
  }: Props = $props();

  // The "done" status is the last one in the configured statuses list
  let doneStatus = $derived(statuses.length > 0 ? statuses[statuses.length - 1] : 'Done');

  let currentSort = $state<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'status',
    direction: 'asc',
  });
  let showingCompleted = $state(false);
  let completedRequested = $state(false);

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
      switch (currentFilter) {
        case 'todo':
          filtered = filtered.filter((t) => t.status === 'To Do');
          break;
        case 'in-progress':
          filtered = filtered.filter((t) => t.status === 'In Progress');
          break;
        case 'done':
          filtered = filtered.filter((t) => t.status === 'Done');
          break;
        case 'high-priority':
          filtered = filtered.filter((t) => t.priority === 'high');
          break;
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
        const order: Record<string, number> = { 'To Do': 0, 'In Progress': 1, Done: 2 };
        aVal = order[aVal as string] ?? 0;
        bVal = order[bVal as string] ?? 0;
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
    const childrenByParent = new Map<string, TaskWithBlocks[]>();
    const subtaskIds = new Set<string>();

    for (const task of sortedTasks) {
      if (task.parentTaskId) {
        subtaskIds.add(task.id);
        const siblings = childrenByParent.get(task.parentTaskId) ?? [];
        siblings.push(task);
        childrenByParent.set(task.parentTaskId, siblings);
      }
    }

    // If there are no subtasks at all, skip the extra work
    if (subtaskIds.size === 0) {
      return sortedTasks.map((task) => ({ task, isSubtask: false }));
    }

    const result: DisplayEntry[] = [];
    for (const task of sortedTasks) {
      // Skip subtasks in their original sorted position; they will be
      // inserted after their parent instead.
      if (subtaskIds.has(task.id)) continue;

      result.push({ task, isSubtask: false });

      // Append any children of this task immediately after it
      const children = childrenByParent.get(task.id);
      if (children) {
        for (const child of children) {
          result.push({ task: child, isSubtask: true });
        }
      }
    }

    // Append orphaned subtasks whose parent is not in the current list
    for (const task of sortedTasks) {
      if (subtaskIds.has(task.id) && !result.some((e) => e.task.id === task.id)) {
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

  function handleRowKeydown(e: KeyboardEvent, taskId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenTask(taskId);
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
    if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status) return;

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
    if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status) {
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

  function handleRowClickGuarded(taskId: string) {
    if (justDragged) return;
    onOpenTask(taskId);
  }

  function handleCompletedFilter() {
    showingCompleted = !showingCompleted;
    if (showingCompleted && !completedRequested && onRequestCompletedTasks) {
      completedRequested = true;
      onRequestCompletedTasks();
    }
  }

  function handleCompleteClick(e: Event, taskId: string) {
    e.stopPropagation();
    onCompleteTask?.(taskId);
  }

  function handlePromoteClick(e: Event, taskId: string) {
    e.stopPropagation();
    onPromoteDraft?.(taskId);
  }

  function handleRestoreClick(e: Event, taskId: string) {
    e.stopPropagation();
    onRestoreTask?.(taskId);
  }

  function handleDeleteClick(e: Event, taskId: string) {
    e.stopPropagation();
    onDeleteTask?.(taskId);
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
      <button
        class="filter-btn"
        class:active={currentFilter === 'todo' && !showingCompleted}
        data-filter="todo"
        onclick={() => { showingCompleted = false; onFilterChange('todo'); }}
      >
        To Do
      </button>
      <button
        class="filter-btn"
        class:active={currentFilter === 'in-progress' && !showingCompleted}
        data-filter="in-progress"
        onclick={() => { showingCompleted = false; onFilterChange('in-progress'); }}
      >
        In Progress
      </button>
      <button
        class="filter-btn"
        class:active={currentFilter === 'done' && !showingCompleted}
        data-filter="done"
        onclick={() => { showingCompleted = false; onFilterChange('done'); }}
      >
        Done
      </button>
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
            {#if isDraftsView || isArchivedView || !showingCompleted}
              <th class="actions-header">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody
          ondragover={(e) => { if (isDragEnabled) e.preventDefault(); }}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
        >
          {#each displayTasks as { task, isSubtask } (task.id)}
            {@const depsCount = task.dependencies?.length ?? 0}
            {@const blocksCount = task.blocksTaskIds?.length ?? 0}
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
              onclick={() => handleRowClickGuarded(task.id)}
              onkeydown={(e) => handleRowKeydown(e, task.id)}
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
                {task.title}
                {#if depsCount > 0 || blocksCount > 0}
                  <span
                    class="deps-indicator"
                    title="Blocked by: {depsCount}, Blocks: {blocksCount}"
                  >
                    {#if depsCount > 0}
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
                      </svg>{depsCount}
                    {/if}
                    {#if blocksCount > 0}
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="m12 5 7 7-7 7"/><path d="M5 12h14"/>
                      </svg>{blocksCount}
                    {/if}
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
              {#if isArchivedView}
                <td class="actions-cell archived-actions">
                  <button
                    class="action-btn restore-btn"
                    data-testid="restore-btn-{task.id}"
                    title="Restore to Tasks"
                    onclick={(e) => handleRestoreClick(e, task.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                    </svg>
                  </button>
                  <button
                    class="action-btn delete-btn"
                    data-testid="delete-btn-{task.id}"
                    title="Delete Permanently"
                    onclick={(e) => handleDeleteClick(e, task.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </td>
              {:else if isDraftsView}
                <td class="actions-cell">
                  <button
                    class="action-btn promote-btn"
                    data-testid="promote-btn-{task.id}"
                    title="Promote to Task"
                    onclick={(e) => handlePromoteClick(e, task.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
                    </svg>
                  </button>
                </td>
              {:else if !showingCompleted && task.status === doneStatus}
                <td class="actions-cell">
                  <button
                    class="action-btn complete-btn"
                    data-testid="complete-btn-{task.id}"
                    title="Move to Completed"
                    onclick={(e) => handleCompleteClick(e, task.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
                    </svg>
                  </button>
                </td>
              {:else if !showingCompleted}
                <td class="actions-cell"></td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

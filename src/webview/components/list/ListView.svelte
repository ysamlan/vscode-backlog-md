<script lang="ts">
  import type { Task, Milestone } from '../../lib/types';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface Props {
    tasks: TaskWithBlocks[];
    milestones: Milestone[];
    currentFilter: string;
    currentMilestone: string;
    searchQuery: string;
    onOpenTask: (taskId: string) => void;
    onFilterChange: (filter: string) => void;
    onMilestoneChange: (milestone: string) => void;
    onSearchChange: (query: string) => void;
  }

  let {
    tasks,
    milestones,
    currentFilter,
    currentMilestone,
    searchQuery,
    onOpenTask,
    onFilterChange,
    onMilestoneChange,
    onSearchChange,
  }: Props = $props();

  let currentSort = $state<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'status',
    direction: 'asc',
  });

  // Get unique milestones from tasks (for dropdown)
  let taskMilestones = $derived([...new Set(tasks.map((t) => t.milestone).filter(Boolean))] as string[]);
  let configMilestoneNames = $derived(milestones.map((m) => m.name));
  let allMilestones = $derived([
    ...configMilestoneNames,
    ...taskMilestones.filter((m) => !configMilestoneNames.includes(m)),
  ]);

  // Filter tasks
  let filteredTasks = $derived.by(() => {
    let filtered = tasks;

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
      return 0;
    });
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

  function handleRowClick(taskId: string) {
    onOpenTask(taskId);
  }

  function handleRowKeydown(e: KeyboardEvent, taskId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenTask(taskId);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (e.target as HTMLElement).nextElementSibling as HTMLElement;
      if (next?.dataset.taskId) next.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (e.target as HTMLElement).previousElementSibling as HTMLElement;
      if (prev?.dataset.taskId) prev.focus();
    }
  }

  function getStatusClass(status: string): string {
    return status.toLowerCase().replace(' ', '-');
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

  <div class="filter-buttons">
    <button
      class="filter-btn"
      class:active={currentFilter === 'all'}
      data-filter="all"
      onclick={() => onFilterChange('all')}
    >
      All
    </button>
    <button
      class="filter-btn"
      class:active={currentFilter === 'todo'}
      data-filter="todo"
      onclick={() => onFilterChange('todo')}
    >
      To Do
    </button>
    <button
      class="filter-btn"
      class:active={currentFilter === 'in-progress'}
      data-filter="in-progress"
      onclick={() => onFilterChange('in-progress')}
    >
      In Progress
    </button>
    <button
      class="filter-btn"
      class:active={currentFilter === 'done'}
      data-filter="done"
      onclick={() => onFilterChange('done')}
    >
      Done
    </button>
    <button
      class="filter-btn"
      class:active={currentFilter === 'high-priority'}
      data-filter="high-priority"
      onclick={() => onFilterChange('high-priority')}
    >
      High Priority
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
  </div>

  <div id="taskListContent">
    {#if sortedTasks.length === 0}
      <div class="empty-state">No tasks found</div>
    {:else}
      <table class="task-table">
        <thead>
          <tr>
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
        <tbody>
          {#each sortedTasks as task (task.id)}
            {@const depsCount = task.dependencies?.length ?? 0}
            {@const blocksCount = task.blocksTaskIds?.length ?? 0}
            <tr
              data-task-id={task.id}
              data-testid="task-row-{task.id}"
              tabindex="0"
              onclick={() => handleRowClick(task.id)}
              onkeydown={(e) => handleRowKeydown(e, task.id)}
            >
              <td>
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
              </td>
              <td>
                <span class="status-badge status-{getStatusClass(task.status)}">{task.status}</span>
              </td>
              <td>
                {#if task.priority}
                  <span class="priority-badge priority-{task.priority}">{task.priority}</span>
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

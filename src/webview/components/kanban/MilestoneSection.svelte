<script lang="ts">
  import type { Task, Milestone, TaskIdDisplayMode } from '../../lib/types';
  import KanbanColumn from './KanbanColumn.svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface StatusColumn {
    status: string;
    label: string;
  }

  interface Props {
    milestoneName: string | null;
    tasks: TaskWithBlocks[];
    columns: StatusColumn[];
    collapsed: boolean;
    taskIdDisplay: TaskIdDisplayMode;
    onToggleCollapse: (milestone: string) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onReadOnlyDragAttempt?: (task: Task) => void;
    onDrop: (taskId: string, newStatus: string, dropIndex: number, taskListElement: HTMLElement) => void;
  }

  let {
    milestoneName,
    tasks,
    columns,
    collapsed,
    taskIdDisplay,
    onToggleCollapse,
    onOpenTask,
    onReadOnlyDragAttempt,
    onDrop,
  }: Props =
    $props();

  // Milestone key for tracking
  let milestoneKey = $derived(milestoneName ?? '__uncategorized__');
  let displayName = $derived(milestoneName ?? 'Uncategorized');

  // Progress calculation
  let doneTasks = $derived(tasks.filter((t) => t.status === 'Done').length);
  let totalTasks = $derived(tasks.length);
  let progressPct = $derived(totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0);

  function handleHeaderClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.task-card')) return;
    onToggleCollapse(milestoneKey);
  }

  function handleHeaderKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleCollapse(milestoneKey);
    }
  }

  // Don't collapse columns inside milestone - they're mini headers
  function noOpToggle(_status: string) {}
</script>

<div
  class="milestone-section"
  class:collapsed
  data-milestone={milestoneKey}
  data-testid="milestone-{milestoneKey}"
>
  <div
    class="milestone-header"
    data-milestone={milestoneKey}
    onclick={handleHeaderClick}
    onkeydown={handleHeaderKeydown}
    role="button"
    tabindex="0"
  >
    <span class="collapse-icon">{collapsed ? '▸' : '▾'}</span>
    <span class="milestone-title">{displayName}</span>
    <span class="milestone-count">{totalTasks}</span>
    <div class="milestone-progress">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progressPct}%"></div>
      </div>
      <span class="progress-text">{progressPct}%</span>
    </div>
  </div>
  <div class="milestone-content">
    <div class="kanban-board nested">
      {#each columns as col (col.status)}
        {@const columnTasks = tasks.filter((t) => t.status === col.status)}
        <KanbanColumn
          status={col.status}
          label={col.label}
          tasks={columnTasks}
          collapsed={false}
          {taskIdDisplay}
          milestone={milestoneKey}
          mini={true}
          onToggleCollapse={noOpToggle}
          {onOpenTask}
          {onReadOnlyDragAttempt}
          {onDrop}
        />
      {/each}
    </div>
  </div>
</div>

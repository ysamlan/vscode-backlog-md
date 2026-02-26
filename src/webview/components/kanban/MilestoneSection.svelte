<script lang="ts">
  import type { Task, Milestone, TaskIdDisplayMode } from '../../lib/types';
  import KanbanColumn from './KanbanColumn.svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface StatusColumn {
    status: string;
    label: string;
  }

  interface Props {
    milestoneId: string | null;
    milestoneLabel: string;
    tasks: TaskWithBlocks[];
    columns: StatusColumn[];
    collapsed: boolean;
    taskIdDisplay: TaskIdDisplayMode;
    activeEditedTaskId?: string | null;
    onToggleCollapse: (milestone: string) => void;
    onSelectTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onReadOnlyDragAttempt?: (task: Task) => void;
    onDrop: (taskId: string, newStatus: string, dropIndex: number, taskListElement: HTMLElement) => void;
  }

  let {
    milestoneId,
    milestoneLabel,
    tasks,
    columns,
    collapsed,
    taskIdDisplay,
    activeEditedTaskId = null,
    onToggleCollapse,
    onSelectTask,
    onOpenTask,
    onReadOnlyDragAttempt,
    onDrop,
  }: Props =
    $props();

  // Milestone key for tracking
  let milestoneKey = $derived(milestoneId ?? '__uncategorized__');
  let displayName = $derived(milestoneLabel);

  // Progress calculation
  let doneTasks = $derived(tasks.filter((t) => t.status.toLowerCase() === 'done').length);
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
        {@const columnTasks = tasks.filter((t) => t.status.toLowerCase() === col.status.toLowerCase())}
        <KanbanColumn
          status={col.status}
          label={col.label}
          tasks={columnTasks}
          collapsed={false}
          {taskIdDisplay}
          {activeEditedTaskId}
          milestone={milestoneKey}
          mini={true}
          onToggleCollapse={noOpToggle}
          {onSelectTask}
          {onOpenTask}
          {onReadOnlyDragAttempt}
          {onDrop}
        />
      {/each}
    </div>
  </div>
</div>

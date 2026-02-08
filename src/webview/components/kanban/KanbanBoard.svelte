<script lang="ts">
  import type { Task, Milestone } from '../../lib/types';
  import KanbanColumn from './KanbanColumn.svelte';
  import MilestoneSection from './MilestoneSection.svelte';
  import { calculateOrdinalsForDrop, type CardData } from '../../../core/ordinalUtils';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface StatusColumn {
    status: string;
    label: string;
  }

  interface Props {
    tasks: TaskWithBlocks[];
    columns: StatusColumn[];
    milestoneGrouping: boolean;
    configMilestones: Milestone[];
    collapsedColumns: Set<string>;
    collapsedMilestones: Set<string>;
    onOpenTask: (taskId: string) => void;
    onToggleColumnCollapse: (status: string) => void;
    onToggleMilestoneCollapse: (milestone: string) => void;
    onReadOnlyDragAttempt?: (task: Task) => void;
    onReorderTasks: (updates: Array<{ taskId: string; ordinal: number }>) => void;
    onUpdateTaskStatus: (
      taskId: string,
      status: string,
      ordinal: number | undefined,
      additionalUpdates: Array<{ taskId: string; ordinal: number }>
    ) => void;
  }

  let {
    tasks,
    columns,
    milestoneGrouping,
    configMilestones,
    collapsedColumns,
    collapsedMilestones,
    onOpenTask,
    onToggleColumnCollapse,
    onToggleMilestoneCollapse,
    onReadOnlyDragAttempt,
    onReorderTasks,
    onUpdateTaskStatus,
  }: Props = $props();

  // Filter out subtasks (they are represented by progress on parent cards)
  let topLevelTasks = $derived(tasks.filter((t) => !t.parentTaskId));

  // Group tasks by milestone
  let milestoneGroups = $derived.by(() => {
    const milestoneMap: Record<string, TaskWithBlocks[]> = {};
    const uncategorized: TaskWithBlocks[] = [];

    for (const task of topLevelTasks) {
      if (task.milestone) {
        (milestoneMap[task.milestone] ??= []).push(task);
      } else {
        uncategorized.push(task);
      }
    }

    // Sort milestones: config milestones first (in order), then others alphabetically
    const configMilestoneNames = configMilestones.map((m) => m.name);
    const milestoneNames = Object.keys(milestoneMap).sort((a, b) => {
      const aIdx = configMilestoneNames.indexOf(a);
      const bIdx = configMilestoneNames.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });

    const groups = milestoneNames.map((name) => ({
      name,
      tasks: milestoneMap[name],
    }));

    if (uncategorized.length > 0) {
      groups.push({ name: null, tasks: uncategorized });
    }

    return groups;
  });

  function handleDrop(
    taskId: string,
    newStatus: string,
    dropIndex: number,
    taskListElement: HTMLElement
  ) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const originalStatus = task.status;

    // Get existing cards in the target column from DOM (current visual order)
    const existingCardsFromDom = [
      ...taskListElement.querySelectorAll('.task-card:not(.dragging)'),
    ].map((el) => ({
      taskId: (el as HTMLElement).dataset.taskId!,
      ordinal: (el as HTMLElement).dataset.ordinal
        ? parseFloat((el as HTMLElement).dataset.ordinal!)
        : undefined,
    }));

    // Filter out the dragged card if it's in the same column
    const existingCards: CardData[] = existingCardsFromDom.filter((c) => c.taskId !== taskId);

    const droppedCard: CardData = { taskId, ordinal: task.ordinal };

    // Calculate ordinals
    const ordinalUpdates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

    if (originalStatus === newStatus) {
      // Same column - reorder
      if (ordinalUpdates.length === 0) return;
      onReorderTasks(ordinalUpdates);
    } else {
      // Different column - status change
      const droppedCardUpdate = ordinalUpdates.find((u) => u.taskId === taskId);
      const additionalUpdates = ordinalUpdates.filter((u) => u.taskId !== taskId);
      onUpdateTaskStatus(taskId, newStatus, droppedCardUpdate?.ordinal, additionalUpdates);
    }
  }
</script>

{#if topLevelTasks.length === 0}
  <div class="empty-state">No tasks found. Create tasks in your backlog/ folder.</div>
{:else if milestoneGrouping}
  <div class="kanban-board milestone-grouped">
    {#each milestoneGroups as group (group.name ?? '__uncategorized__')}
      <MilestoneSection
        milestoneName={group.name}
        tasks={group.tasks}
        {columns}
        collapsed={collapsedMilestones.has(group.name ?? '__uncategorized__')}
        onToggleCollapse={onToggleMilestoneCollapse}
        {onOpenTask}
        {onReadOnlyDragAttempt}
        onDrop={handleDrop}
      />
    {/each}
  </div>
{:else}
  <div class="kanban-board">
    {#each columns as col (col.status)}
      {@const columnTasks = topLevelTasks.filter((t) => t.status === col.status)}
      <KanbanColumn
        status={col.status}
        label={col.label}
        tasks={columnTasks}
        collapsed={collapsedColumns.has(col.status)}
        onToggleCollapse={onToggleColumnCollapse}
        {onOpenTask}
        {onReadOnlyDragAttempt}
        onDrop={handleDrop}
      />
    {/each}
  </div>
{/if}

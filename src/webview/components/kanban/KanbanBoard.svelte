<script lang="ts">
  import type { Task, Milestone, TaskIdDisplayMode } from '../../lib/types';
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
    taskIdDisplay: TaskIdDisplayMode;
    activeEditedTaskId?: string | null;
    onSelectTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
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
    onRequestCreateMilestone?: () => void;
  }

  let {
    tasks,
    columns,
    milestoneGrouping,
    configMilestones,
    collapsedColumns,
    collapsedMilestones,
    taskIdDisplay,
    activeEditedTaskId = null,
    onSelectTask,
    onOpenTask,
    onToggleColumnCollapse,
    onToggleMilestoneCollapse,
    onReadOnlyDragAttempt,
    onReorderTasks,
    onUpdateTaskStatus,
    onRequestCreateMilestone,
  }: Props = $props();

  // Filter out subtasks (they are represented by progress on parent cards)
  let topLevelTasks = $derived(tasks.filter((t) => !t.parentTaskId));

  // Group tasks by milestone
  let milestoneGroups = $derived.by(() => {
    const milestoneMap: Record<string, TaskWithBlocks[]> = {};
    const uncategorized: TaskWithBlocks[] = [];
    const milestoneLabels = new Map(configMilestones.map((milestone) => [milestone.id, milestone.name]));

    for (const task of topLevelTasks) {
      if (task.milestone) {
        (milestoneMap[task.milestone] ??= []).push(task);
      } else {
        uncategorized.push(task);
      }
    }

    // Include all configured milestones (even empty ones)
    for (const m of configMilestones) {
      if (!milestoneMap[m.id]) {
        milestoneMap[m.id] = [];
      }
    }

    // Sort milestones: non-empty first, then empty; within each group,
    // configured IDs in order first, then others alphabetically by display label
    const configMilestoneIds = configMilestones.map((m) => m.id);
    const milestoneIds = Object.keys(milestoneMap).sort((a, b) => {
      const aEmpty = milestoneMap[a].length === 0 ? 1 : 0;
      const bEmpty = milestoneMap[b].length === 0 ? 1 : 0;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      const aIdx = configMilestoneIds.indexOf(a);
      const bIdx = configMilestoneIds.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return (milestoneLabels.get(a) || a).localeCompare(milestoneLabels.get(b) || b);
    });

    const groups = milestoneIds.map((id) => ({
      id,
      label: milestoneLabels.get(id) || id,
      tasks: milestoneMap[id],
    }));

    if (uncategorized.length > 0) {
      // Insert before empty milestones, after non-empty ones
      const firstEmptyIdx = groups.findIndex((g) => g.tasks.length === 0);
      const insertIdx = firstEmptyIdx === -1 ? groups.length : firstEmptyIdx;
      groups.splice(insertIdx, 0, { id: null, label: 'Uncategorized', tasks: uncategorized });
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
    {#each milestoneGroups as group (group.id ?? '__uncategorized__')}
        <MilestoneSection
          milestoneId={group.id}
          milestoneLabel={group.label}
          tasks={group.tasks}
          {columns}
          collapsed={collapsedMilestones.has(group.id ?? '__uncategorized__')}
          {taskIdDisplay}
          {activeEditedTaskId}
          onToggleCollapse={onToggleMilestoneCollapse}
        {onSelectTask}
        {onOpenTask}
        {onReadOnlyDragAttempt}
        onDrop={handleDrop}
      />
    {/each}
    {#if onRequestCreateMilestone}
      <button
        type="button"
        class="add-milestone-btn"
        data-testid="create-milestone-btn"
        onclick={onRequestCreateMilestone}
      >
        + Milestone
      </button>
    {/if}
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
        {taskIdDisplay}
        {activeEditedTaskId}
        onToggleCollapse={onToggleColumnCollapse}
        {onSelectTask}
        {onOpenTask}
        {onReadOnlyDragAttempt}
        onDrop={handleDrop}
      />
    {/each}
  </div>
{/if}

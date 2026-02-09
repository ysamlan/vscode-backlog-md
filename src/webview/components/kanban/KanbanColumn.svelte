<script lang="ts">
  import { isReadOnlyTask, type Task } from '../../lib/types';
  import TaskCard from '../shared/TaskCard.svelte';
  import { sortCardsByOrdinal, type CardData } from '../../../core/ordinalUtils';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface Props {
    status: string;
    label: string;
    tasks: TaskWithBlocks[];
    collapsed: boolean;
    milestone?: string;
    mini?: boolean;
    onToggleCollapse: (status: string) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onReadOnlyDragAttempt?: (task: Task) => void;
    onDrop: (taskId: string, newStatus: string, dropIndex: number, taskListElement: HTMLElement) => void;
  }

  let {
    status,
    label,
    tasks,
    collapsed,
    milestone,
    mini = false,
    onToggleCollapse,
    onOpenTask,
    onReadOnlyDragAttempt,
    onDrop,
  }: Props = $props();

  let dropIndicatorIndex = $state<number | null>(null);

  // Sort tasks by ordinal (tasks with ordinal first, then by ID)
  let sortedTasks = $derived.by(() => {
    const cardData: CardData[] = tasks.map((t) => ({
      taskId: t.id,
      ordinal: t.ordinal,
    }));
    const sortedData = sortCardsByOrdinal(cardData);
    return sortedData.map((cd) => tasks.find((t) => t.id === cd.taskId)!);
  });

  function handleHeaderClick(e: MouseEvent) {
    // Don't collapse when clicking on task cards
    if ((e.target as HTMLElement).closest('.task-card')) return;
    onToggleCollapse(status);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    const draggingCard = document.querySelector('.task-card.dragging');
    if (!draggingCard) return;
    const taskListElement = e.currentTarget as HTMLElement | null;
    if (!taskListElement) return;

    const dropTarget = getDropTarget(taskListElement, e, draggingCard as HTMLElement);
    dropIndicatorIndex = getDropIndex(taskListElement, dropTarget);
  }

  function handleDragLeave(e: DragEvent) {
    // Only clear if leaving the list entirely
    const taskListElement = e.currentTarget as HTMLElement | null;
    if (taskListElement && !taskListElement.contains(e.relatedTarget as Node)) {
      clearDropIndicators();
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    clearDropIndicators();

    const taskId = e.dataTransfer?.getData('text/plain');
    if (!taskId) return;
    const taskListElement = e.currentTarget as HTMLElement | null;
    if (!taskListElement) return;
    const droppedTask = sortedTasks.find((t) => t.id === taskId);
    if (droppedTask && isReadOnlyTask(droppedTask)) {
      onReadOnlyDragAttempt?.(droppedTask);
      return;
    }

    const draggingCard = document.querySelector('.task-card.dragging');
    if (!draggingCard) return;

    const dropTarget = getDropTarget(taskListElement, e, draggingCard as HTMLElement);
    const dropIndex = getDropIndex(taskListElement, dropTarget);

    onDrop(taskId, status, dropIndex, taskListElement);
  }

  function getDropTarget(
    taskListElement: HTMLElement,
    e: DragEvent,
    draggedCard: HTMLElement
  ): HTMLElement | null {
    const cards = [...taskListElement.querySelectorAll('.task-card:not(.dragging)')].filter(
      (c) => c !== draggedCard
    );
    return (
      (cards.find((card) => {
        const rect = card.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      }) as HTMLElement) || null
    );
  }

  function getDropIndex(taskListElement: HTMLElement, dropTarget: HTMLElement | null): number {
    if (!dropTarget) return sortedTasks.length;
    const cards = [...taskListElement.querySelectorAll('.task-card:not(.dragging)')];
    return cards.indexOf(dropTarget);
  }

  function clearDropIndicators() {
    dropIndicatorIndex = null;
  }
</script>

<div
  class="kanban-column"
  class:collapsed
  data-status={status}
  data-milestone={milestone}
  data-testid="column-{status}"
>
  {#if mini}
    <div class="column-header-mini">
      <span class="column-title">{label}</span>
      <span class="column-count">{tasks.length}</span>
    </div>
  {:else}
    <div
      class="column-header"
      data-status={status}
      onclick={handleHeaderClick}
      onkeydown={(e) => e.key === 'Enter' && handleHeaderClick(e as unknown as MouseEvent)}
      role="button"
      tabindex="0"
    >
      <span class="collapse-icon">{collapsed ? '▸' : '▾'}</span>
      <span class="column-title">{label}</span>
      <span class="column-count">{tasks.length}</span>
    </div>
  {/if}
  <div
    class="task-list"
    class:drop-target={dropIndicatorIndex !== null}
    data-status={status}
    data-milestone={milestone}
    data-testid="task-list-{status}"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    role="list"
  >
    {#each sortedTasks as task, index (task.id)}
      {#if dropIndicatorIndex === index}
        <div class="drop-indicator"></div>
      {/if}
      <TaskCard {task} {onOpenTask} {onReadOnlyDragAttempt} />
    {/each}
    {#if dropIndicatorIndex === sortedTasks.length}
      <div class="drop-indicator"></div>
    {/if}
  </div>
</div>

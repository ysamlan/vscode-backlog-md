<script lang="ts">
  import { isReadOnlyTask, type Task, type TaskIdDisplayMode } from '../../lib/types';
  import TaskCard from '../shared/TaskCard.svelte';
  import { sortCardsByOrdinal, type CardData } from '../../../core/ordinalUtils';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface Props {
    status: string;
    label: string;
    tasks: TaskWithBlocks[];
    taskIdDisplay: TaskIdDisplayMode;
    activeEditedTaskId?: string | null;
    collapsed: boolean;
    milestone?: string;
    mini?: boolean;
    onToggleCollapse: (status: string) => void;
    onSelectTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onReadOnlyDragAttempt?: (task: Task) => void;
    onDrop: (taskId: string, newStatus: string, dropIndex: number, taskListElement: HTMLElement) => void;
  }

  let {
    status,
    label,
    tasks,
    taskIdDisplay,
    activeEditedTaskId = null,
    collapsed,
    milestone,
    mini = false,
    onToggleCollapse,
    onSelectTask,
    onOpenTask,
    onReadOnlyDragAttempt,
    onDrop,
  }: Props = $props();

  let dropIndicatorIndex = $state<number | null>(null);

  // Detect "done"/"complete" columns for special sorting
  let isDoneColumn = $derived(/done|complete/i.test(status));

  // Sort tasks: done/complete columns by updatedAt DESC, others by ordinal
  let sortedTasks = $derived.by(() => {
    if (isDoneColumn) {
      return [...tasks].sort((a, b) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        // Both without dates go to end, sorted by ID
        if (!aDate && !bDate) return a.id.localeCompare(b.id);
        // Tasks without dates go to end
        if (!aDate) return 1;
        if (!bDate) return -1;
        // Newest first (descending)
        return bDate - aDate;
      });
    }
    const cardData: CardData[] = tasks.map((t) => ({
      taskId: t.id,
      ordinal: t.ordinal,
      priority: t.priority,
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
      <TaskCard {task} {taskIdDisplay} isActiveEdited={activeEditedTaskId === task.id} {onSelectTask} {onOpenTask} {onReadOnlyDragAttempt} />
    {/each}
    {#if dropIndicatorIndex === sortedTasks.length}
      <div class="drop-indicator"></div>
    {/if}
  </div>
</div>

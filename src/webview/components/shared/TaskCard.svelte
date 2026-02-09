<script lang="ts">
  import {
    isReadOnlyTask,
    getReadOnlyTaskContext,
    type Task,
    type TaskIdDisplayMode,
  } from '../../lib/types';
  import { formatTaskIdForDisplay } from '../../lib/taskIdDisplay';
  import PriorityIcon from './PriorityIcon.svelte';

  interface Props {
    task: Task & { blocksTaskIds?: string[]; subtaskProgress?: { total: number; done: number } };
    taskIdDisplay: TaskIdDisplayMode;
    onSelectTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onOpenTask: (taskId: string, taskMeta?: Pick<Task, 'filePath' | 'source' | 'branch'>) => void;
    onReadOnlyDragAttempt?: (task: Task) => void;
    ondragstart?: (e: DragEvent) => void;
    ondragend?: (e: DragEvent) => void;
  }

  let {
    task,
    taskIdDisplay,
    onSelectTask,
    onReadOnlyDragAttempt,
    ondragstart,
    ondragend,
  }: Props = $props();

  let isSaving = $state(false);

  // Expose saving state for parent to control
  export function setSaving(saving: boolean) {
    isSaving = saving;
  }

  function handleClick() {
    onSelectTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
  }

  function handleFocus() {
    onSelectTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault();
      onSelectTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
    }
  }

  function handleDragStart(e: DragEvent) {
    if (isReadOnlyTask(task)) {
      onReadOnlyDragAttempt?.(task);
      e.preventDefault();
      return;
    }
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    const card = e.currentTarget as HTMLElement | null;
    // Small delay for visual effect
    setTimeout(() => {
      card?.classList.add('dragging');
    }, 0);
    ondragstart?.(e);
  }

  function handleDragEnd(e: DragEvent) {
    const card = e.currentTarget as HTMLElement | null;
    card?.classList.remove('dragging');
    ondragend?.(e);
  }

  // Compute derived values
  let displayLabels = $derived(task.labels?.slice(0, 2) ?? []);
  let hasBlockingDependencies = $derived((task.blockingDependencyIds?.length ?? 0) > 0);
  let blockingDependencyTitle = $derived(
    hasBlockingDependencies ? `Blocked by: ${task.blockingDependencyIds!.join(', ')}` : ''
  );
  let hasSubtaskProgress = $derived(task.subtaskProgress !== undefined && task.subtaskProgress.total > 0);
  let readOnlyContext = $derived(getReadOnlyTaskContext(task));
  let displayTaskId = $derived(formatTaskIdForDisplay(task.id, taskIdDisplay));
  let showTaskId = $derived(taskIdDisplay !== 'hidden');
</script>

<div
  class="task-card"
  class:saving={isSaving}
  class:readonly-task={isReadOnlyTask(task)}
  tabindex="0"
  draggable="true"
  data-task-id={task.id}
  data-ordinal={task.ordinal !== undefined ? task.ordinal : ''}
  data-testid="task-{task.id}"
  onclick={handleClick}
  onfocus={handleFocus}
  onkeydown={handleKeydown}
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
  role="button"
>
  {#if showTaskId}
    <div class="task-card-id-row">
      <div class="task-card-id" data-testid="task-id-{task.id}">{displayTaskId}</div>
      {#if task.priority}
        <PriorityIcon priority={task.priority} size={14} />
      {/if}
    </div>
  {/if}
  <div class="task-card-title">{task.title}</div>
  <div class="task-card-meta">
    {#if task.priority && !showTaskId}
      <PriorityIcon priority={task.priority} size={14} />
    {/if}
    {#each displayLabels as label (label)}
      <span class="task-label">{label}</span>
    {/each}
    {#if isReadOnlyTask(task)}
      <span
        class="readonly-indicator"
        data-testid="readonly-indicator-{task.id}"
        title="Read-only task from {readOnlyContext}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 0-3-3H6"/><path d="M6 15h9a3 3 0 1 1 0 6h-3"/></svg>
        {readOnlyContext}
      </span>
    {/if}
    {#if hasBlockingDependencies}
      <span
        class="blocked-indicator"
        data-testid="blocked-indicator-{task.id}"
        title={blockingDependencyTitle}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
      </span>
    {/if}
  </div>
  {#if hasSubtaskProgress}
    <div class="task-card-subtasks" data-testid="subtask-progress-{task.id}">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m21 12-7 7-7-7"/><path d="M14 5v14"/><path d="M3 5v14"/>
      </svg>
      <span class="subtask-count">{task.subtaskProgress!.done}/{task.subtaskProgress!.total}</span>
      <span class="subtask-bar">
        <span class="subtask-bar-fill" style="width: {(task.subtaskProgress!.done / task.subtaskProgress!.total) * 100}%"></span>
      </span>
    </div>
  {/if}
</div>

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
    onOpenTask,
    onReadOnlyDragAttempt,
    ondragstart,
    ondragend,
  }: Props = $props();

  let isSaving = $state(false);

  // Expose saving state for parent to control
  export function setSaving(saving: boolean) {
    isSaving = saving;
  }

  function handleClick(e: MouseEvent) {
    // Check if click was on a dependency link
    const target = e.target as HTMLElement;
    if (target.closest('.dep-link')) {
      return; // Let the dep link handler deal with it
    }
    onSelectTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenTask(task.id, { filePath: task.filePath, source: task.source, branch: task.branch });
    }
  }

  function handleDepClick(e: MouseEvent, taskId: string) {
    e.preventDefault();
    e.stopPropagation();
    onOpenTask(taskId);
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
  let hasDependencies = $derived((task.dependencies?.length ?? 0) > 0);
  let hasBlocks = $derived((task.blocksTaskIds?.length ?? 0) > 0);
  let showDepsSection = $derived(hasDependencies || hasBlocks);
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
  </div>
  {#if showDepsSection}
    <div class="task-card-deps">
      {#if hasDependencies}
        <span class="task-deps">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
          </svg>
          {#each task.dependencies.slice(0, 2) as depId, i (depId)}
            {#if i > 0}, {/if}
            <button
              type="button"
              class="dep-link"
              onclick={(e) => handleDepClick(e, depId)}
            >
              {depId}
            </button>
          {/each}
          {#if task.dependencies.length > 2}
            <span class="dep-overflow">+{task.dependencies.length - 2}</span>
          {/if}
        </span>
      {/if}
      {#if hasBlocks}
        <span class="task-deps">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="m12 5 7 7-7 7"/><path d="M5 12h14"/>
          </svg>
          {#each task.blocksTaskIds!.slice(0, 2) as blockId, i (blockId)}
            {#if i > 0}, {/if}
            <button
              type="button"
              class="dep-link"
              onclick={(e) => handleDepClick(e, blockId)}
            >
              {blockId}
            </button>
          {/each}
          {#if task.blocksTaskIds!.length > 2}
            <span class="dep-overflow">+{task.blocksTaskIds!.length - 2}</span>
          {/if}
        </span>
      {/if}
    </div>
  {/if}
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

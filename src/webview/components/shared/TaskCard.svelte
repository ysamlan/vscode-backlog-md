<script lang="ts">
  import type { Task } from '../../lib/types';

  interface Props {
    task: Task & { blocksTaskIds?: string[] };
    onOpenTask: (taskId: string) => void;
    ondragstart?: (e: DragEvent) => void;
    ondragend?: (e: DragEvent) => void;
  }

  let { task, onOpenTask, ondragstart, ondragend }: Props = $props();

  let isSaving = $state(false);
  let cardElement: HTMLDivElement;

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
    onOpenTask(task.id);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenTask(task.id);
    }
  }

  function handleDepClick(e: MouseEvent, taskId: string) {
    e.preventDefault();
    e.stopPropagation();
    onOpenTask(taskId);
  }

  function handleDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay for visual effect
    setTimeout(() => {
      cardElement?.classList.add('dragging');
    }, 0);
    ondragstart?.(e);
  }

  function handleDragEnd(e: DragEvent) {
    cardElement?.classList.remove('dragging');
    ondragend?.(e);
  }

  // Compute derived values
  let displayLabels = $derived(task.labels?.slice(0, 2) ?? []);
  let hasDependencies = $derived((task.dependencies?.length ?? 0) > 0);
  let hasBlocks = $derived((task.blocksTaskIds?.length ?? 0) > 0);
  let showDepsSection = $derived(hasDependencies || hasBlocks);
</script>

<div
  bind:this={cardElement}
  class="task-card"
  class:saving={isSaving}
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
  <div class="task-card-title">{task.title}</div>
  <div class="task-card-meta">
    {#if task.priority}
      <span class="priority-badge priority-{task.priority}">{task.priority}</span>
    {/if}
    {#each displayLabels as label (label)}
      <span class="task-label">{label}</span>
    {/each}
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
</div>

<style>
  .dep-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    text-decoration: none;
  }

  .dep-link:hover {
    text-decoration: underline;
  }
</style>

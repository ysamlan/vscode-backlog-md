<script lang="ts">
  import type { TaskStatus, TaskPriority } from '../../lib/types';
  import { statusToClass, customStatusStyle } from '../../lib/statusColors';

  interface Props {
    taskId: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority | undefined;
    statuses: string[];
    isBlocked: boolean;
    onUpdateTitle: (title: string) => void;
    onUpdateStatus: (status: string) => void;
    onUpdatePriority: (priority: string | undefined) => void;
  }

  let {
    taskId,
    title,
    status,
    priority,
    statuses,
    isBlocked,
    onUpdateTitle,
    onUpdateStatus,
    onUpdatePriority,
  }: Props = $props();

  let titleValue = $state('');
  let originalTitle = $state('');

  // Sync when title prop changes (on initial load and after save)
  $effect(() => {
    titleValue = title;
    originalTitle = title;
  });

  const statusClass = $derived(statusToClass(status));
  const statusInlineStyle = $derived(customStatusStyle(status));
  const priorityClass = $derived(priority ? `priority-${priority}` : '');
  const priorities = ['high', 'medium', 'low'];

  function handleTitleBlur() {
    const newTitle = titleValue.trim();
    if (newTitle && newTitle !== originalTitle) {
      originalTitle = newTitle;
      onUpdateTitle(newTitle);
    }
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      titleValue = originalTitle;
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleStatusChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    onUpdateStatus(value);
  }

  function handlePriorityChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value || undefined;
    onUpdatePriority(value);
  }
</script>

<div class="task-header">
  <div class="task-id" data-testid="task-id">{taskId}</div>
  <input
    type="text"
    class="editable-title"
    data-testid="title-input"
    bind:value={titleValue}
    onblur={handleTitleBlur}
    onkeydown={handleTitleKeydown}
  />
  <div class="task-badges">
    <select
      class="dropdown-select status-select status-{statusClass}"
      style={statusInlineStyle}
      data-testid="status-select"
      value={status}
      onchange={handleStatusChange}
    >
      {#each statuses as s (s)}
        <option value={s}>{s}</option>
      {/each}
    </select>
    <select
      class="dropdown-select priority-select {priorityClass}"
      data-testid="priority-select"
      value={priority || ''}
      onchange={handlePriorityChange}
    >
      <option value="">No Priority</option>
      {#each priorities as p (p)}
        <option value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
      {/each}
    </select>
    {#if isBlocked}
      <span class="blocked-badge" data-testid="blocked-badge">Blocked</span>
    {/if}
  </div>
</div>

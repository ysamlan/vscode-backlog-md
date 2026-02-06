<script lang="ts">
  interface SubtaskSummary {
    id: string;
    title: string;
    status: string;
  }

  interface Props {
    subtasks: SubtaskSummary[];
    onOpenTask: (taskId: string) => void;
    onCreateSubtask: () => void;
  }

  let { subtasks, onOpenTask, onCreateSubtask }: Props = $props();

  let doneCount = $derived(subtasks.filter((s) => s.status === 'Done').length);

  function getStatusDotClass(status: string): string {
    return status.toLowerCase().replace(' ', '-');
  }
</script>

<div class="section" data-testid="subtasks-section">
  <div class="section-title">
    Subtasks
    <span class="subtasks-progress-label">({doneCount}/{subtasks.length})</span>
  </div>
  <div class="subtasks-list">
    {#each subtasks as subtask (subtask.id)}
      <div class="subtask-item" data-testid="subtask-item-{subtask.id}">
        <span class="subtask-status-dot status-dot-{getStatusDotClass(subtask.status)}" title={subtask.status}></span>
        <button
          type="button"
          class="subtask-link"
          data-testid="subtask-link-{subtask.id}"
          onclick={() => onOpenTask(subtask.id)}
        >
          {subtask.id}
        </button>
        <span class="subtask-title">{subtask.title}</span>
        <span class="subtask-status-badge status-badge status-{getStatusDotClass(subtask.status)}">{subtask.status}</span>
      </div>
    {/each}
  </div>
  <button
    type="button"
    class="add-subtask-btn"
    data-testid="add-subtask-btn"
    onclick={onCreateSubtask}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
    Add Subtask
  </button>
</div>

<script lang="ts">
  import { statusToClass, customStatusStyle } from '../../lib/statusColors';

  interface SubtaskSummary {
    id: string;
    title: string;
    status: string;
  }

  interface Props {
    subtasks: SubtaskSummary[];
    statuses?: string[];
    onOpenTask: (taskId: string) => void;
    onCreateSubtask: () => void;
    isReadOnly?: boolean;
  }

  let { subtasks, statuses = [], onOpenTask, onCreateSubtask, isReadOnly = false }: Props = $props();

  // The last configured status is treated as "done"
  let doneStatus = $derived(statuses.length > 0 ? statuses[statuses.length - 1] : 'Done');
  let doneCount = $derived(subtasks.filter((s) => s.status === doneStatus).length);
</script>

<div class="section" data-testid="subtasks-section">
  <div class="section-title">
    Subtasks
    <span class="subtasks-progress-label">({doneCount}/{subtasks.length})</span>
  </div>
  <div class="subtasks-list">
    {#each subtasks as subtask (subtask.id)}
      <button
        type="button"
        class="subtask-item"
        data-testid="subtask-item-{subtask.id}"
        onclick={() => onOpenTask(subtask.id)}
        title={`Open ${subtask.id}`}
      >
        <span class="subtask-status-dot status-dot-{statusToClass(subtask.status)}" style={customStatusStyle(subtask.status)} title={subtask.status}></span>
        <span class="subtask-link" data-testid="subtask-link-{subtask.id}">
          {subtask.id}
        </span>
        <span class="subtask-title">{subtask.title}</span>
        <span class="subtask-status-badge status-badge status-{statusToClass(subtask.status)}" style={customStatusStyle(subtask.status)}>{subtask.status}</span>
      </button>
    {/each}
  </div>
  <button
    type="button"
    class="add-subtask-btn"
    data-testid="add-subtask-btn"
    onclick={() => !isReadOnly && onCreateSubtask()}
    disabled={isReadOnly}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
    Add Subtask
  </button>
</div>

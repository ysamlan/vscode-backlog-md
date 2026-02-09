<script lang="ts">
  import { getReadOnlyTaskContext, isReadOnlyTask, type Task, type TaskPriority } from '../../lib/types';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  interface Props {
    task: TaskWithBlocks | null;
    statuses: string[];
    onOpenFull: (task: TaskWithBlocks) => void;
    onUpdateStatus: (task: TaskWithBlocks, status: string) => void;
    onUpdatePriority: (task: TaskWithBlocks, priority: TaskPriority | undefined) => void;
  }

  let { task, statuses, onOpenFull, onUpdateStatus, onUpdatePriority }: Props = $props();

  let isReadOnly = $derived(task ? isReadOnlyTask(task) : false);
  let readOnlyContext = $derived(task ? getReadOnlyTaskContext(task) : '');
</script>

<div class="compact-details-pane" data-testid="compact-details-pane">
  {#if !task}
    <div class="compact-empty">Select a task to view details.</div>
  {:else}
    <div class="compact-header">
      <div class="compact-identity">
        <span class="compact-id" data-testid="compact-details-task-id">{task.id}</span>
        <h3 class="compact-title" data-testid="compact-details-title">{task.title}</h3>
      </div>
      <button
        type="button"
        class="compact-open-full-btn"
        data-testid="open-full-detail-btn"
        onclick={() => onOpenFull(task)}
      >
        Open Full Details
      </button>
    </div>

    {#if isReadOnly}
      <div class="compact-readonly" data-testid="compact-readonly-banner">
        Read-only task from {readOnlyContext}.
      </div>
    {/if}

    <div class="compact-meta-grid">
      <label class="compact-field">
        <span>Status</span>
        <select
          class="compact-select"
          data-testid="compact-status-select"
          value={task.status}
          disabled={isReadOnly}
          onchange={(e) => onUpdateStatus(task, (e.target as HTMLSelectElement).value)}
        >
          {#each statuses as status (status)}
            <option value={status}>{status}</option>
          {/each}
        </select>
      </label>

      <label class="compact-field">
        <span>Priority</span>
        <select
          class="compact-select"
          data-testid="compact-priority-select"
          value={task.priority ?? ''}
          disabled={isReadOnly}
          onchange={(e) => {
            const raw = (e.target as HTMLSelectElement).value;
            onUpdatePriority(task, (raw || undefined) as TaskPriority | undefined);
          }}
        >
          <option value="">None</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>

    <div class="compact-description">
      {#if task.description}
        {task.description}
      {:else}
        <span class="compact-muted">No description.</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .compact-details-pane {
    border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
    padding: 8px 10px 10px;
    background: var(--vscode-editor-background);
    min-height: 168px;
    max-height: 44%;
    overflow: auto;
  }

  .compact-empty {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }

  .compact-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .compact-identity {
    min-width: 0;
  }

  .compact-id {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    display: block;
    margin-bottom: 2px;
  }

  .compact-title {
    margin: 0;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 600;
    word-break: break-word;
  }

  .compact-open-full-btn {
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
    color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }

  .compact-open-full-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
  }

  .compact-readonly {
    margin-bottom: 8px;
    border: 1px solid var(--vscode-inputValidation-warningBorder, #d7ba7d);
    color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground));
    background: var(--vscode-editorWarning-background, rgba(215, 186, 125, 0.12));
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 11px;
  }

  .compact-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 8px;
  }

  .compact-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }

  .compact-select {
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border-radius: 4px;
    font-size: 12px;
    padding: 4px 6px;
    min-height: 26px;
  }

  .compact-description {
    font-size: 12px;
    line-height: 1.35;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--vscode-foreground);
  }

  .compact-muted {
    color: var(--vscode-descriptionForeground);
  }
</style>

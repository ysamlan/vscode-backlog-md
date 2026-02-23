<script lang="ts">
  import { getReadOnlyTaskContext, isReadOnlyTask, type Task, type TaskPriority } from '../../lib/types';
  import { formatStoredUtcDateForDisplay } from '../../lib/date-display';
  import { renderMermaidAction } from '../../lib/mermaidAction';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };
  type SubtaskSummary = {
    id: string;
    title: string;
    status: string;
    filePath?: string;
    source?: Task['source'];
    branch?: Task['branch'];
  };

  interface Props {
    task: TaskWithBlocks | null;
    statuses: string[];
    descriptionHtml: string;
    planHtml: string;
    notesHtml: string;
    finalSummaryHtml: string;
    subtaskSummaries: SubtaskSummary[];
    onOpenFull: (task: TaskWithBlocks) => void;
    onOpenSubtask: (subtask: SubtaskSummary) => void;
    onOpenRelatedTask: (taskId: string) => void;
    onUpdateStatus: (task: TaskWithBlocks, status: string) => void;
    onUpdatePriority: (task: TaskWithBlocks, priority: TaskPriority | undefined) => void;
  }

  let {
    task,
    statuses,
    descriptionHtml,
    planHtml,
    notesHtml,
    finalSummaryHtml,
    subtaskSummaries,
    onOpenFull,
    onOpenSubtask,
    onOpenRelatedTask,
    onUpdateStatus,
    onUpdatePriority,
  }: Props = $props();

  let isReadOnly = $derived(task ? isReadOnlyTask(task) : false);
  let readOnlyContext = $derived(task ? getReadOnlyTaskContext(task) : '');
  const priorityLabel: Record<TaskPriority, string> = {
    high: 'P1',
    medium: 'P2',
    low: 'P3',
  };
  const priorityTitle: Record<TaskPriority, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  let hasMeta = $derived(
    Boolean(
      task?.parentTaskId ||
      task?.labels.length ||
        task?.assignee.length ||
        task?.dependencies.length ||
        (task?.blocksTaskIds?.length ?? 0) > 0
    )
  );
</script>

<div class="compact-details-pane" data-testid="compact-details-pane">
  {#if !task}
    <div class="compact-empty">Select a task to view details.</div>
  {:else}
    <div class="compact-section-title">Details</div>
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
        title="Open full task details"
      >
        Edit
      </button>
    </div>

    {#if isReadOnly}
      <div class="compact-readonly" data-testid="compact-readonly-banner">
        Read-only task from {readOnlyContext}.
      </div>
    {/if}

    <div class="compact-chip-row">
      <span class="compact-status-chip">{task.status}</span>
      {#if task.priority}
        <span class={`compact-priority-chip priority-${task.priority}`} title={priorityTitle[task.priority]}>
          {priorityLabel[task.priority]}
        </span>
      {/if}
      {#if task.updatedAt}
        <span class="compact-updated-chip">Updated {formatStoredUtcDateForDisplay(task.updatedAt)}</span>
      {/if}
    </div>

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

    {#if hasMeta}
      <div class="compact-meta-lines">
        {#if task.labels.length > 0}
          <div class="compact-meta-line">
            <span class="compact-meta-key">Labels</span>
            <span class="compact-meta-value">{task.labels.join(', ')}</span>
          </div>
        {/if}
        {#if task.assignee.length > 0}
          <div class="compact-meta-line">
            <span class="compact-meta-key">Assignees</span>
            <span class="compact-meta-value">{task.assignee.join(', ')}</span>
          </div>
        {/if}
        {#if task.parentTaskId}
          <div class="compact-meta-line">
            <span class="compact-meta-key">Subtask of</span>
            <span class="compact-meta-value">
              <button
                type="button"
                class="compact-related-link"
                onclick={() => onOpenRelatedTask(task.parentTaskId!)}
              >
                {task.parentTaskId}
              </button>
            </span>
          </div>
        {/if}
        {#if task.dependencies.length > 0}
          <div class="compact-meta-line">
            <span class="compact-meta-key">Blocked by</span>
            <span class="compact-meta-value">
              {#each task.dependencies as depId, i (depId)}
                {#if i > 0}, {/if}
                <button
                  type="button"
                  class="compact-related-link"
                  onclick={() => onOpenRelatedTask(depId)}
                >
                  {depId}
                </button>
              {/each}
            </span>
          </div>
        {/if}
        {#if (task.blocksTaskIds?.length ?? 0) > 0}
          <div class="compact-meta-line">
            <span class="compact-meta-key">Blocks</span>
            <span class="compact-meta-value">
              {#each task.blocksTaskIds ?? [] as blockId, i (blockId)}
                {#if i > 0}, {/if}
                <button
                  type="button"
                  class="compact-related-link"
                  onclick={() => onOpenRelatedTask(blockId)}
                >
                  {blockId}
                </button>
              {/each}
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="compact-description-heading">Description</div>
    <div
      class="compact-description markdown-content"
      use:renderMermaidAction={descriptionHtml}
    >
      {#if descriptionHtml}
        {@html descriptionHtml}
      {:else}
        <span class="compact-muted">No description.</span>
      {/if}
    </div>

    {#if planHtml}
      <div class="compact-description-heading">Implementation Plan</div>
      <div
        class="compact-description markdown-content"
        data-testid="compact-plan"
        use:renderMermaidAction={planHtml}
      >
        {@html planHtml}
      </div>
    {/if}

    {#if notesHtml}
      <div class="compact-description-heading">Implementation Notes</div>
      <div
        class="compact-description markdown-content"
        data-testid="compact-notes"
        use:renderMermaidAction={notesHtml}
      >
        {@html notesHtml}
      </div>
    {/if}

    {#if finalSummaryHtml}
      <div class="compact-description-heading">Final Summary</div>
      <div
        class="compact-description markdown-content"
        data-testid="compact-final-summary"
        use:renderMermaidAction={finalSummaryHtml}
      >
        {@html finalSummaryHtml}
      </div>
    {/if}

    {#if subtaskSummaries.length > 0}
      <div class="compact-subtasks-heading">Subtasks ({subtaskSummaries.length})</div>
      <div class="compact-subtasks-list" data-testid="compact-subtasks-list">
        {#each subtaskSummaries as subtask (subtask.id)}
          <button
            type="button"
            class="compact-subtask-item"
            data-testid="compact-subtask-item-{subtask.id}"
            onclick={() => onOpenSubtask(subtask)}
            title={`Open ${subtask.id}`}
          >
            <span class="compact-subtask-id">{subtask.id}</span>
            <span class="compact-subtask-title">{subtask.title}</span>
            <span class="compact-subtask-status">{subtask.status}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .compact-details-pane {
    border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
    padding: 8px 10px 12px;
    background: var(--vscode-editor-background);
    min-height: 220px;
    overflow: auto;
  }

  .compact-section-title {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    font-weight: 700;
    margin-bottom: 8px;
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
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    display: block;
    margin-bottom: 3px;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .compact-title {
    margin: 0;
    font-size: 16px;
    line-height: 1.25;
    font-weight: 600;
    word-break: break-word;
  }

  .compact-open-full-btn {
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .compact-open-full-btn:hover {
    background: var(--vscode-button-hoverBackground);
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

  .compact-chip-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }

  .compact-status-chip,
  .compact-priority-chip,
  .compact-updated-chip {
    border-radius: 999px;
    font-size: 10px;
    line-height: 1;
    padding: 5px 8px;
    font-weight: 600;
  }

  .compact-status-chip {
    background: color-mix(in oklab, var(--vscode-badge-background) 88%, transparent);
    color: var(--vscode-badge-foreground);
  }

  .compact-priority-chip {
    color: #111;
    background: var(--vscode-editorWarning-foreground, #cca700);
  }

  .compact-priority-chip.priority-high {
    background: #ea4a5a;
    color: #fff;
  }

  .compact-priority-chip.priority-medium {
    background: #f9a826;
    color: #111;
  }

  .compact-priority-chip.priority-low {
    background: #32a852;
    color: #fff;
  }

  .compact-updated-chip {
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-descriptionForeground);
    border: 1px solid var(--vscode-widget-border, transparent);
    font-weight: 500;
  }

  .compact-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
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

  .compact-meta-lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
    font-size: 11px;
  }

  .compact-meta-line {
    display: flex;
    gap: 6px;
    color: var(--vscode-foreground);
  }

  .compact-meta-key {
    min-width: 74px;
    color: var(--vscode-descriptionForeground);
  }

  .compact-meta-value {
    overflow-wrap: anywhere;
  }

  .compact-description-heading {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 5px;
  }

  .compact-description {
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    color: var(--vscode-foreground);
  }

  .compact-muted {
    color: var(--vscode-descriptionForeground);
  }

  .compact-subtasks-heading {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin: 10px 0 5px;
  }

  .compact-subtasks-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .compact-subtask-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 4px;
    padding: 5px 6px;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
  }

  .compact-subtask-item:hover {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.04));
  }

  .compact-subtask-item:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }

  .compact-subtask-id {
    color: var(--vscode-textLink-foreground, #3b82f6);
    font-size: 11px;
    white-space: nowrap;
  }

  .compact-subtask-title {
    min-width: 0;
    font-size: 11px;
    color: var(--vscode-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact-subtask-status {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
  }

  .compact-related-link {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    padding: 0;
    cursor: pointer;
    font: inherit;
    text-decoration: none;
  }

  .compact-related-link:hover {
    text-decoration: underline;
  }
</style>

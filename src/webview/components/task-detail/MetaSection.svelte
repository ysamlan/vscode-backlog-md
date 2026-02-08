<script lang="ts">
  interface Props {
    labels: string[];
    assignees: string[];
    milestone: string | undefined;
    dependencies: string[];
    blocksTaskIds: string[];
    uniqueLabels: string[];
    uniqueAssignees: string[];
    milestones: string[];
    parentTask?: { id: string; title: string };
    onUpdateLabels: (labels: string[]) => void;
    onUpdateAssignees: (assignees: string[]) => void;
    onUpdateMilestone: (milestone: string | undefined) => void;
    onOpenTask: (taskId: string) => void;
    onFilterByLabel: (label: string) => void;
  }

  let {
    labels,
    assignees,
    milestone,
    dependencies,
    blocksTaskIds,
    uniqueLabels,
    uniqueAssignees,
    milestones,
    parentTask,
    onUpdateLabels,
    onUpdateAssignees,
    onUpdateMilestone,
    onOpenTask,
    onFilterByLabel,
  }: Props = $props();

  let labelInput = $state('');
  let assigneeInput = $state('');

  function handleAddLabel(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const newLabel = labelInput.trim();
      if (newLabel && !labels.includes(newLabel)) {
        onUpdateLabels([...labels, newLabel]);
      }
      labelInput = '';
    } else if (e.key === 'Escape') {
      labelInput = '';
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleRemoveLabel(label: string) {
    onUpdateLabels(labels.filter((l) => l !== label));
  }

  function handleAddAssignee(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const newAssignee = assigneeInput.trim();
      if (newAssignee && !assignees.includes(newAssignee)) {
        onUpdateAssignees([...assignees, newAssignee]);
      }
      assigneeInput = '';
    } else if (e.key === 'Escape') {
      assigneeInput = '';
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleRemoveAssignee(assignee: string) {
    onUpdateAssignees(assignees.filter((a) => a !== assignee));
  }

  function handleMilestoneChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value || undefined;
    onUpdateMilestone(value);
  }
</script>

<div class="section">
  <div class="section-title">Details</div>
  <div class="meta-grid">
    <!-- Parent Task -->
    {#if parentTask}
      <div class="meta-item">
        <div class="meta-label">Parent Task</div>
        <div data-testid="parent-task">
          <button
            type="button"
            class="dependency-link"
            data-task-id={parentTask.id}
            data-testid="parent-task-link"
            onclick={() => onOpenTask(parentTask!.id)}
          >
            {parentTask.id}
          </button>
          <span class="parent-task-title">{parentTask.title}</span>
        </div>
      </div>
    {/if}

    <!-- Labels -->
    <div class="meta-item">
      <div class="meta-label">Labels</div>
      <div class="labels-container" data-testid="labels-container">
        {#each labels as label (label)}
          <span class="label editable-label" data-label={label}>
            <button
              type="button"
              class="label-link"
              data-testid="label-link-{label}"
              title="Filter by {label}"
              onclick={() => onFilterByLabel(label)}
            >
              {label}
            </button>
            <span
              class="remove-label"
              data-testid="remove-label-{label}"
              onclick={() => handleRemoveLabel(label)}
              onkeydown={(e) => e.key === 'Enter' && handleRemoveLabel(label)}
              role="button"
              tabindex="0"
            >
              ×
            </span>
          </span>
        {/each}
        <input
          type="text"
          class="add-label-input"
          data-testid="add-label-input"
          placeholder="+ Add"
          list="labelSuggestions"
          bind:value={labelInput}
          onkeydown={handleAddLabel}
        />
      </div>
    </div>

    <!-- Assignees -->
    <div class="meta-item">
      <div class="meta-label">Assignees</div>
      <div class="assignees-container" data-testid="assignees-container">
        {#each assignees as assignee (assignee)}
          <span class="assignee editable-assignee" data-assignee={assignee}>
            {assignee}
            <span
              class="remove-assignee"
              data-testid="remove-assignee-{assignee}"
              onclick={() => handleRemoveAssignee(assignee)}
              onkeydown={(e) => e.key === 'Enter' && handleRemoveAssignee(assignee)}
              role="button"
              tabindex="0"
            >
              ×
            </span>
          </span>
        {/each}
        <input
          type="text"
          class="add-assignee-input"
          data-testid="add-assignee-input"
          placeholder="+ Add"
          list="assigneeSuggestions"
          bind:value={assigneeInput}
          onkeydown={handleAddAssignee}
        />
      </div>
    </div>

    <!-- Milestone -->
    <div class="meta-item">
      <div class="meta-label">Milestone</div>
      <div>
        <select
          class="dropdown-select milestone-select"
          data-testid="milestone-select"
          value={milestone || ''}
          onchange={handleMilestoneChange}
        >
          <option value="">None</option>
          {#each milestones as m (m)}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Blocked By (dependencies) -->
    <div class="meta-item">
      <div class="meta-label">Blocked By</div>
      <div data-testid="blocked-by">
        {#if dependencies.length > 0}
          {#each dependencies as dep, i (dep)}
            {#if i > 0}, {/if}
            <button
              type="button"
              class="dependency-link"
              data-task-id={dep}
              data-testid="dependency-link-{dep}"
              onclick={() => onOpenTask(dep)}
            >
              {dep}
            </button>
          {/each}
        {:else}
          <span class="empty-value">None</span>
        {/if}
      </div>
    </div>

    <!-- Blocks -->
    <div class="meta-item">
      <div class="meta-label">Blocks</div>
      <div data-testid="blocks">
        {#if blocksTaskIds.length > 0}
          {#each blocksTaskIds as taskId, i (taskId)}
            {#if i > 0}, {/if}
            <button
              type="button"
              class="dependency-link"
              data-task-id={taskId}
              data-testid="blocks-link-{taskId}"
              onclick={() => onOpenTask(taskId)}
            >
              {taskId}
            </button>
          {/each}
        {:else}
          <span class="empty-value">None</span>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Datalists for autocomplete -->
<datalist id="labelSuggestions">
  {#each uniqueLabels as l (l)}
    <option value={l}></option>
  {/each}
</datalist>

<datalist id="assigneeSuggestions">
  {#each uniqueAssignees as a (a)}
    <option value={a}></option>
  {/each}
</datalist>

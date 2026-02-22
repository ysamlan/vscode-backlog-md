<script lang="ts">
  interface Props {
    labels: string[];
    assignees: string[];
    milestone: string | undefined;
    dependencies: string[];
    blocksTaskIds: string[];
    missingDependencyIds?: string[];
    linkableTasks: Array<{ id: string; title: string; status: string }>;
    uniqueLabels: string[];
    uniqueAssignees: string[];
    milestones: Array<{ id: string; label: string }>;
    parentTask?: { id: string; title: string };
    isReadOnly?: boolean;
    onUpdateLabels: (labels: string[]) => void;
    onUpdateAssignees: (assignees: string[]) => void;
    onUpdateMilestone: (milestone: string | undefined) => void;
    onRequestCreateMilestone: () => void;
    onOpenTask: (taskId: string) => void;
    onAddBlockedByLink: (taskId: string) => void;
    onAddBlocksLink: (taskId: string) => void;
    onFilterByLabel: (label: string) => void;
  }

  let {
    labels,
    assignees,
    milestone,
    dependencies,
    blocksTaskIds,
    missingDependencyIds = [],
    linkableTasks,
    uniqueLabels,
    uniqueAssignees,
    milestones,
    parentTask,
    isReadOnly = false,
    onUpdateLabels,
    onUpdateAssignees,
    onUpdateMilestone,
    onRequestCreateMilestone,
    onOpenTask,
    onAddBlockedByLink,
    onAddBlocksLink,
    onFilterByLabel,
  }: Props = $props();

  let labelInput = $state('');
  let assigneeInput = $state('');
  let blockedByInput = $state('');
  let blocksInput = $state('');
  let blockedByPickerOpen = $state(false);
  let blocksPickerOpen = $state(false);
  const MAX_VISIBLE_SUGGESTIONS = 10;

  const blockedBySuggestions = $derived(
    getSuggestions(blockedByInput, new Set(dependencies), MAX_VISIBLE_SUGGESTIONS)
  );
  const blocksSuggestions = $derived(
    getSuggestions(blocksInput, new Set(blocksTaskIds), MAX_VISIBLE_SUGGESTIONS)
  );

  function handleAddLabel(e: KeyboardEvent) {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    onUpdateLabels(labels.filter((l) => l !== label));
  }

  function handleAddAssignee(e: KeyboardEvent) {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    onUpdateAssignees(assignees.filter((a) => a !== assignee));
  }

  function handleMilestoneChange(e: Event) {
    if (isReadOnly) return;
    const select = e.target as HTMLSelectElement;
    const value = select.value;
    if (value === '__create_milestone__') {
      select.value = milestone || '';
      onRequestCreateMilestone();
      return;
    }
    onUpdateMilestone(value || undefined);
  }

  function resolveLinkTaskId(
    inputValue: string,
    suggestions: Array<{ id: string; title: string; status: string }>
  ): string | undefined {
    const normalized = inputValue.trim().toUpperCase();
    if (!normalized) return undefined;
    const match = linkableTasks.find((task) => task.id.toUpperCase() === normalized);
    return match?.id ?? suggestions[0]?.id;
  }

  function getSuggestions(
    query: string,
    excludedIds: Set<string>,
    limit: number
  ): Array<{ id: string; title: string; status: string }> {
    const normalized = query.trim().toUpperCase();
    const filtered = linkableTasks.filter((task) => {
      if (excludedIds.has(task.id)) return false;
      if (!normalized) return true;
      return (
        task.id.toUpperCase().includes(normalized) || task.title.toUpperCase().includes(normalized)
      );
    });
    return filtered.slice(0, limit);
  }

  function submitBlockedByLink() {
    if (isReadOnly) return;
    const taskId = resolveLinkTaskId(blockedByInput, blockedBySuggestions);
    if (!taskId || dependencies.includes(taskId)) {
      blockedByInput = '';
      blockedByPickerOpen = false;
      return;
    }
    onAddBlockedByLink(taskId);
    blockedByInput = '';
    blockedByPickerOpen = false;
  }

  function submitBlocksLink() {
    if (isReadOnly) return;
    const taskId = resolveLinkTaskId(blocksInput, blocksSuggestions);
    if (!taskId || blocksTaskIds.includes(taskId)) {
      blocksInput = '';
      blocksPickerOpen = false;
      return;
    }
    onAddBlocksLink(taskId);
    blocksInput = '';
    blocksPickerOpen = false;
  }

  function handleBlockedByKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBlockedByLink();
    } else if (e.key === 'Escape') {
      blockedByInput = '';
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleBlocksKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBlocksLink();
    } else if (e.key === 'Escape') {
      blocksInput = '';
      (e.target as HTMLInputElement).blur();
    }
  }

  function selectBlockedBySuggestion(taskId: string) {
    if (isReadOnly) return;
    blockedByInput = taskId;
    submitBlockedByLink();
  }

  function selectBlocksSuggestion(taskId: string) {
    if (isReadOnly) return;
    blocksInput = taskId;
    submitBlocksLink();
  }

  function scheduleCloseBlockedByPicker() {
    setTimeout(() => {
      blockedByPickerOpen = false;
    }, 100);
  }

  function scheduleCloseBlocksPicker() {
    setTimeout(() => {
      blocksPickerOpen = false;
    }, 100);
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
              onclick={() => !isReadOnly && handleRemoveLabel(label)}
              onkeydown={(e) => e.key === 'Enter' && !isReadOnly && handleRemoveLabel(label)}
              role="button"
              tabindex={isReadOnly ? -1 : 0}
              aria-disabled={isReadOnly}
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
          disabled={isReadOnly}
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
              onclick={() => !isReadOnly && handleRemoveAssignee(assignee)}
              onkeydown={(e) => e.key === 'Enter' && !isReadOnly && handleRemoveAssignee(assignee)}
              role="button"
              tabindex={isReadOnly ? -1 : 0}
              aria-disabled={isReadOnly}
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
          disabled={isReadOnly}
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
          disabled={isReadOnly}
          onchange={handleMilestoneChange}
        >
          <option value="">None</option>
          {#each milestones as m (m.id)}
            <option value={m.id}>{m.label}</option>
          {/each}
          {#if !isReadOnly}
            <option value="__create_milestone__">+ Create new milestone...</option>
          {/if}
        </select>
      </div>
    </div>

    <!-- Blocked by (dependencies) -->
    <div class="meta-item">
      <div class="meta-label">Blocked by</div>
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
            {#if missingDependencyIds.includes(dep)}
              <span
                class="missing-dependency-warning"
                data-testid="missing-dependency-warning-{dep}"
                title="Linked task not found"
                aria-label="Linked task not found"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
              </span>
            {/if}
          {/each}
        {:else if isReadOnly}
          <span class="empty-value">None</span>
        {/if}
        <div class="dependency-picker">
          <div class="dependency-add-row">
            <input
              type="text"
              class="dependency-add-input"
              data-testid="add-blocked-by-input"
              placeholder="+ Link task ID"
              bind:value={blockedByInput}
              disabled={isReadOnly}
              onfocus={() => {
                if (!isReadOnly) blockedByPickerOpen = true;
              }}
              onblur={scheduleCloseBlockedByPicker}
              onkeydown={handleBlockedByKeydown}
            />
            <button
              type="button"
              class="dependency-add-button"
              data-testid="add-blocked-by-btn"
              onclick={submitBlockedByLink}
              disabled={isReadOnly}
            >
              Add
            </button>
          </div>
          {#if blockedByPickerOpen && blockedBySuggestions.length > 0}
            <div class="dependency-suggestions" data-testid="blocked-by-suggestions" role="listbox">
              {#each blockedBySuggestions as suggestion (suggestion.id)}
                <button
                  type="button"
                  class="dependency-suggestion-item"
                  data-testid="blocked-by-suggestion-{suggestion.id}"
                  onmousedown={(e) => {
                    e.preventDefault();
                    selectBlockedBySuggestion(suggestion.id);
                  }}
                >
                  <span class="dependency-suggestion-id">{suggestion.id}</span>
                  <span class="dependency-suggestion-title">{suggestion.title}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
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
        {:else if isReadOnly}
          <span class="empty-value">None</span>
        {/if}
        <div class="dependency-picker">
          <div class="dependency-add-row">
            <input
              type="text"
              class="dependency-add-input"
              data-testid="add-blocks-input"
              placeholder="+ Link task ID"
              bind:value={blocksInput}
              disabled={isReadOnly}
              onfocus={() => {
                if (!isReadOnly) blocksPickerOpen = true;
              }}
              onblur={scheduleCloseBlocksPicker}
              onkeydown={handleBlocksKeydown}
            />
            <button
              type="button"
              class="dependency-add-button"
              data-testid="add-blocks-btn"
              onclick={submitBlocksLink}
              disabled={isReadOnly}
            >
              Add
            </button>
          </div>
          {#if blocksPickerOpen && blocksSuggestions.length > 0}
            <div class="dependency-suggestions" data-testid="blocks-suggestions" role="listbox">
              {#each blocksSuggestions as suggestion (suggestion.id)}
                <button
                  type="button"
                  class="dependency-suggestion-item"
                  data-testid="blocks-suggestion-{suggestion.id}"
                  onmousedown={(e) => {
                    e.preventDefault();
                    selectBlocksSuggestion(suggestion.id);
                  }}
                >
                  <span class="dependency-suggestion-id">{suggestion.id}</span>
                  <span class="dependency-suggestion-title">{suggestion.title}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
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

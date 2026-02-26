<script lang="ts">
  import type { ChecklistItem } from '../../lib/types';

  interface Props {
    title: string;
    items: ChecklistItem[];
    listType: 'acceptanceCriteria' | 'definitionOfDone';
    taskId: string;
    onToggle: (listType: string, itemId: number) => void;
    onUpdateText?: (text: string) => void;
    isReadOnly?: boolean;
  }

  let {
    title,
    items,
    listType,
    taskId,
    onToggle,
    onUpdateText,
    isReadOnly = false,
  }: Props = $props();

  function autofocusAction(node: HTMLElement) {
    node.focus();
  }

  let editingItemId: number | null = $state(null);
  let editingText = $state('');
  let newItemText = $state('');
  let prevTaskId = '';
  let batchSelectMode = $state(false);
  let selectedIds = $state(new Set<number>());

  // Reset state when switching tasks
  $effect(() => {
    if (taskId !== prevTaskId) {
      prevTaskId = taskId;
      editingItemId = null;
      newItemText = '';
      batchSelectMode = false;
      selectedIds = new Set();
    }
  });

  const checkedCount = $derived(items.filter((i) => i.checked).length);
  const totalCount = $derived(items.length);
  const progress = $derived(totalCount > 0 ? `${checkedCount} of ${totalCount} complete` : '');
  const isComplete = $derived(checkedCount === totalCount && totalCount > 0);

  function reconstructAndSave(modifiedItems: Array<{ id: number; text: string; checked: boolean }>) {
    if (!onUpdateText) return;
    const text = modifiedItems
      .map((item) => `- [${item.checked ? 'x' : ' '}] #${item.id} ${item.text}`)
      .join('\n');
    onUpdateText(text);
  }

  function startEditing(item: ChecklistItem) {
    if (isReadOnly || !onUpdateText) return;
    editingItemId = item.id;
    editingText = item.text;
  }

  function saveEdit() {
    if (editingItemId === null) return;
    const modified = items.map((item) =>
      item.id === editingItemId ? { ...item, text: editingText } : item
    );
    editingItemId = null;
    reconstructAndSave(modified);
  }

  function cancelEdit() {
    editingItemId = null;
  }

  function deleteItem(itemId: number) {
    const remaining = items.filter((item) => item.id !== itemId);
    const renumbered = remaining.map((item, i) => ({ ...item, id: i + 1 }));
    reconstructAndSave(renumbered);
  }

  function toggleBatchMode() {
    batchSelectMode = !batchSelectMode;
    selectedIds = new Set();
  }

  function toggleSelection(itemId: number) {
    const next = new Set(selectedIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    selectedIds = next;
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    const remaining = items.filter((item) => !selectedIds.has(item.id));
    const renumbered = remaining.map((item, i) => ({ ...item, id: i + 1 }));
    selectedIds = new Set();
    batchSelectMode = false;
    reconstructAndSave(renumbered);
  }

  function addItem() {
    if (!newItemText.trim()) return;
    const newId = items.length + 1;
    const newItems = [...items, { id: newId, text: newItemText.trim(), checked: false }];
    newItemText = '';
    reconstructAndSave(newItems);
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }

  function handleAddKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  }
</script>

<div class="section">
  <div class="section-header">
    <div class="section-title">{title}</div>
    <div style="display: flex; align-items: center; gap: 8px;">
      {#if progress}
        <span
          class="progress-indicator"
          class:complete={isComplete}
          data-testid="{listType}-progress"
        >
          {progress}
        </span>
      {/if}
      {#if onUpdateText && !isReadOnly && items.length > 1}
        <button
          type="button"
          class="batch-select-btn"
          class:active={batchSelectMode}
          onclick={toggleBatchMode}
          data-testid="{listType}-batch-select"
          title={batchSelectMode ? 'Cancel selection' : 'Select items to remove'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m15 3 6 6"/><path d="m9 15 6-6"/></svg>
        </button>
      {/if}
    </div>
  </div>
  {#if items.length > 0}
    <ul class="checklist">
      {#each items as item (item.id)}
        <li
          class="checklist-item"
          class:checked={item.checked}
          class:selected={batchSelectMode && selectedIds.has(item.id)}
          data-list-type={listType}
          data-item-id={item.id}
          data-testid="{listType}-item-{item.id}"
        >
          {#if batchSelectMode}
            <button
              type="button"
              class="checklist-checkbox batch-checkbox"
              onclick={() => toggleSelection(item.id)}
              data-testid="{listType}-batch-toggle-{item.id}"
            >
              <span class="checkbox">{selectedIds.has(item.id) ? '☑' : '☐'}</span>
            </button>
          {:else}
            <button
              type="button"
              class="checklist-checkbox"
              onclick={() => !isReadOnly && onToggle(listType, item.id)}
              aria-pressed={item.checked}
              disabled={isReadOnly}
              data-testid="{listType}-toggle-{item.id}"
            >
              <span class="checkbox">{item.checked ? '☑' : '☐'}</span>
            </button>
          {/if}
          {#if editingItemId === item.id}
            <input
              class="checklist-item-input"
              type="text"
              bind:value={editingText}
              onblur={saveEdit}
              onkeydown={handleEditKeydown}
              data-testid="{listType}-item-input-{item.id}"
              use:autofocusAction
            />
          {:else}
            {#if onUpdateText && !isReadOnly}
              <span
                class="checklist-text editable"
                onclick={() => startEditing(item)}
                onkeydown={(e) => e.key === 'Enter' && startEditing(item)}
                role="button"
                tabindex={0}
              >
                {item.text}
              </span>
            {:else}
              <span class="checklist-text">
                {item.text}
              </span>
            {/if}
          {/if}
          {#if onUpdateText && !isReadOnly}
            <button
              type="button"
              class="checklist-delete-btn"
              onclick={() => deleteItem(item.id)}
              data-testid="{listType}-delete-{item.id}"
              title="Remove item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if batchSelectMode && selectedIds.size > 0}
      <div class="batch-actions" data-testid="{listType}-batch-actions">
        <button
          type="button"
          class="batch-delete-btn"
          onclick={deleteSelected}
          data-testid="{listType}-batch-delete"
        >
          Remove {selectedIds.size} selected
        </button>
      </div>
    {/if}
  {:else}
    <span class="empty-value">None defined</span>
  {/if}
  {#if onUpdateText && !isReadOnly}
    <div class="checklist-add" data-testid="{listType}-add">
      <input
        type="text"
        class="checklist-add-input"
        placeholder="Add item..."
        bind:value={newItemText}
        onkeydown={handleAddKeydown}
        data-testid="{listType}-add-input"
      />
      <button
        type="button"
        class="checklist-add-btn"
        onclick={addItem}
        disabled={!newItemText.trim()}
        data-testid="{listType}-add-btn"
      >
        Add
      </button>
    </div>
  {/if}
</div>

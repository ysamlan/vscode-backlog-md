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

  let editingItemId: number | null = $state(null);
  let editingText = $state('');
  let newItemText = $state('');
  let prevTaskId = '';

  // Reset state when switching tasks
  $effect(() => {
    if (taskId !== prevTaskId) {
      prevTaskId = taskId;
      editingItemId = null;
      newItemText = '';
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
    </div>
  </div>
  {#if items.length > 0}
    <ul class="checklist">
      {#each items as item (item.id)}
        <li
          class="checklist-item"
          class:checked={item.checked}
          data-list-type={listType}
          data-item-id={item.id}
          data-testid="{listType}-item-{item.id}"
        >
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
          {#if editingItemId === item.id}
            <input
              class="checklist-item-input"
              type="text"
              bind:value={editingText}
              onblur={saveEdit}
              onkeydown={handleEditKeydown}
              data-testid="{listType}-item-input-{item.id}"
              autofocus
            />
          {:else}
            <span
              class="checklist-text"
              class:editable={!!onUpdateText && !isReadOnly}
              onclick={() => startEditing(item)}
              onkeydown={(e) => e.key === 'Enter' && startEditing(item)}
              role={onUpdateText && !isReadOnly ? 'button' : undefined}
              tabindex={onUpdateText && !isReadOnly ? 0 : -1}
            >
              {item.text}
            </span>
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

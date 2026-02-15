<script lang="ts">
  import type { ChecklistItem } from '../../lib/types';
  import MarkdownEditor from '../shared/MarkdownEditor.svelte';

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

  let isEditing = $state(false);
  let prevTaskId = '';

  // Reset edit mode when switching tasks
  $effect(() => {
    if (taskId !== prevTaskId) {
      prevTaskId = taskId;
      isEditing = false;
    }
  });

  const checkedCount = $derived(items.filter((i) => i.checked).length);
  const totalCount = $derived(items.length);
  const progress = $derived(totalCount > 0 ? `${checkedCount} of ${totalCount} complete` : '');
  const isComplete = $derived(checkedCount === totalCount && totalCount > 0);

  // Reconstruct markdown text from checklist items for editing
  const editContent = $derived(
    items.map((item) => `- [${item.checked ? 'x' : ' '}] #${item.id} ${item.text}`).join('\n')
  );

  function toggleEdit() {
    if (isReadOnly) return;
    isEditing = !isEditing;
  }

  function handleEditorUpdate(text: string) {
    if (onUpdateText) {
      onUpdateText(text);
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
      {#if onUpdateText}
        <button
          class="edit-btn"
          data-testid="{listType}-edit-btn"
          onclick={toggleEdit}
          onpointerdown={(e) => isEditing && e.stopPropagation()}
          disabled={isReadOnly}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      {/if}
    </div>
  </div>
  {#if isEditing}
    <MarkdownEditor
      content={editContent}
      placeholder="- [ ] #1 First item"
      onUpdate={handleEditorUpdate}
      onExit={() => (isEditing = false)}
      {isReadOnly}
      showToolbar={false}
      minHeight={80}
    />
  {:else if items.length > 0}
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
            class="checklist-toggle"
            onclick={() => !isReadOnly && onToggle(listType, item.id)}
            aria-pressed={item.checked}
            disabled={isReadOnly}
          >
            <span class="checkbox">{item.checked ? '☑' : '☐'}</span>
            <span class="checklist-text">{item.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <span class="empty-value">None defined</span>
  {/if}
</div>

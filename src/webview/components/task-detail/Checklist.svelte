<script lang="ts">
  import type { ChecklistItem } from '../../lib/types';

  interface Props {
    title: string;
    items: ChecklistItem[];
    listType: 'acceptanceCriteria' | 'definitionOfDone';
    onToggle: (listType: string, itemId: number) => void;
    isReadOnly?: boolean;
  }

  let { title, items, listType, onToggle, isReadOnly = false }: Props = $props();

  const checkedCount = $derived(items.filter((i) => i.checked).length);
  const totalCount = $derived(items.length);
  const progress = $derived(totalCount > 0 ? `${checkedCount} of ${totalCount} complete` : '');
  const isComplete = $derived(checkedCount === totalCount && totalCount > 0);
</script>

<div class="section">
  <div class="section-header">
    <div class="section-title">{title}</div>
    {#if progress}
      <span class="progress-indicator" class:complete={isComplete} data-testid="{listType}-progress">
        {progress}
      </span>
    {/if}
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

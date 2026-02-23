<script lang="ts">
  import { renderMermaidAction } from '../../lib/mermaidAction';
  import MarkdownEditor from '../shared/MarkdownEditor.svelte';

  interface Props {
    taskId: string;
    title: string;
    fieldName: string;
    content: string;
    contentHtml: string;
    emptyLabel?: string;
    onUpdate: (value: string) => void;
    isReadOnly?: boolean;
  }

  let {
    taskId,
    title,
    fieldName,
    content,
    contentHtml,
    emptyLabel = `No ${title.toLowerCase()}`,
    onUpdate,
    isReadOnly = false,
  }: Props = $props();

  let isEditing = $state(false);
  let prevTaskId = '';
  let suppressUpdate = false;

  $effect(() => {
    if (taskId !== prevTaskId) {
      prevTaskId = taskId;
      suppressUpdate = true;
      isEditing = false;
      queueMicrotask(() => {
        suppressUpdate = false;
      });
    }
  });

  function guardedUpdate(value: string) {
    if (!suppressUpdate) {
      onUpdate(value);
    }
  }

  function toggleEdit() {
    if (isReadOnly) return;
    isEditing = !isEditing;
  }

  function handleViewClick() {
    if (isReadOnly) return;
    isEditing = true;
  }
</script>

<div class="section" data-testid="{fieldName}-section">
  <div class="section-header">
    <div class="section-title">{title}</div>
    <button
      class="edit-btn"
      data-testid="edit-{fieldName}-btn"
      onclick={toggleEdit}
      onpointerdown={(e) => isEditing && e.stopPropagation()}
      disabled={isReadOnly}
    >
      {isEditing ? 'Done' : 'Edit'}
    </button>
  </div>
  <div class="description-container">
    {#if isEditing}
      <MarkdownEditor
        content={content}
        placeholder="Add {title.toLowerCase()}..."
        onUpdate={guardedUpdate}
        onExit={() => (isEditing = false)}
        {isReadOnly}
      />
    {:else}
      <div
        class="markdown-content description-view"
        data-testid="{fieldName}-view"
        onclick={handleViewClick}
        onkeydown={(e) => e.key === 'Enter' && handleViewClick()}
        role="button"
        tabindex={isReadOnly ? -1 : 0}
        use:renderMermaidAction={contentHtml}
      >
        {#if contentHtml}
          {@html contentHtml}
        {:else}
          <em class="empty-value">{emptyLabel}</em>
        {/if}
      </div>
    {/if}
  </div>
</div>

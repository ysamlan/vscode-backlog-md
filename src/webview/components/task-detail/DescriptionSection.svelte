<script lang="ts">
  import { renderMermaidAction } from '../../lib/mermaidAction';
  import MarkdownEditor from '../shared/MarkdownEditor.svelte';

  interface Props {
    taskId: string;
    description: string;
    descriptionHtml: string;
    onUpdate: (value: string) => void;
    isReadOnly?: boolean;
  }

  let { taskId, description, descriptionHtml, onUpdate, isReadOnly = false }: Props = $props();

  let isEditing = $state(false);
  let prevTaskId = '';
  // Suppress onUpdate calls during task switch to prevent MarkdownEditor's
  // onDestroy from flushing stale content to the newly-selected task.
  let suppressUpdate = false;

  // Reset edit mode when switching to a different task.
  $effect(() => {
    if (taskId !== prevTaskId) {
      prevTaskId = taskId;
      suppressUpdate = true;
      isEditing = false;
      // Re-enable after the destroy cycle completes.
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

<div class="section">
  <div class="section-header">
    <div class="section-title">Description</div>
    <button
      class="edit-btn"
      data-testid="edit-description-btn"
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
        content={description}
        placeholder="Add a description..."
        onUpdate={guardedUpdate}
        onExit={() => (isEditing = false)}
        {isReadOnly}
      />
    {:else}
      <div
        class="markdown-content description-view"
        data-testid="description-view"
        onclick={handleViewClick}
        onkeydown={(e) => e.key === 'Enter' && handleViewClick()}
        role="button"
        tabindex={isReadOnly ? -1 : 0}
        use:renderMermaidAction={descriptionHtml}
      >
        {#if descriptionHtml}
          {@html descriptionHtml}
        {:else}
          <em class="empty-value">No description</em>
        {/if}
      </div>
    {/if}
  </div>
</div>

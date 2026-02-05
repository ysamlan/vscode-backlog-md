<script lang="ts">
  interface Props {
    description: string;
    descriptionHtml: string;
    onUpdate: (value: string) => void;
  }

  let { description, descriptionHtml, onUpdate }: Props = $props();

  let isEditing = $state(false);
  let textareaValue = $state('');
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Sync textarea value when description prop changes (on load and after save)
  $effect(() => {
    if (!isEditing) {
      textareaValue = description;
    }
  });

  function toggleEdit() {
    if (isEditing) {
      // Save and switch to view mode
      onUpdate(textareaValue);
      isEditing = false;
    } else {
      isEditing = true;
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    textareaValue = target.value;

    // Debounce auto-save
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      onUpdate(textareaValue);
    }, 1000);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isEditing = false;
      textareaValue = description; // Revert changes
    }
  }

  function handleViewClick() {
    isEditing = true;
  }
</script>

<div class="section">
  <div class="section-header">
    <div class="section-title">Description</div>
    <button class="edit-btn" data-testid="edit-description-btn" onclick={toggleEdit}>
      {isEditing ? 'Done' : 'Edit'}
    </button>
  </div>
  <div class="description-container">
    {#if isEditing}
      <textarea
        class="description-textarea"
        data-testid="description-textarea"
        placeholder="Add a description..."
        bind:value={textareaValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
      ></textarea>
    {:else}
      <div
        class="markdown-content description-view"
        data-testid="description-view"
        onclick={handleViewClick}
        onkeydown={(e) => e.key === 'Enter' && handleViewClick()}
        role="button"
        tabindex="0"
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

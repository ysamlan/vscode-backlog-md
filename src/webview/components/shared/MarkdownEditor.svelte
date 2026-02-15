<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    content: string;
    placeholder?: string;
    onUpdate: (value: string) => void;
    onExit: () => void;
    isReadOnly?: boolean;
    showToolbar?: boolean;
    minHeight?: number;
  }

  let {
    content,
    placeholder = '',
    onUpdate,
    onExit,
    isReadOnly = false,
    showToolbar = true,
    minHeight = 120,
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let editorEl: HTMLDivElement | undefined = $state(undefined);
  let commandBarEl: HTMLDivElement | undefined = $state(undefined);
  let editor: import('tiny-markdown-editor').Editor | null = null;
  let commandBar: import('tiny-markdown-editor').CommandBar | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasPendingChanges = false;
  // The content when the user started editing — used for Escape revert.
  // Set once in onMount. NOT updated on echo-backs from the extension.
  let originalContent = '';

  onMount(async () => {
    const TinyMDE = await import('tiny-markdown-editor');
    if (!editorEl) return;

    originalContent = content;

    editor = new TinyMDE.Editor({
      element: editorEl,
      content,
      placeholder,
    });

    if (showToolbar && commandBarEl) {
      commandBar = new TinyMDE.CommandBar({
        element: commandBarEl,
        editor,
        commands: [
          'bold',
          'italic',
          'strikethrough',
          '|',
          'h1',
          'h2',
          '|',
          'ul',
          'ol',
          '|',
          'code',
          '|',
          'insertLink',
        ],
      });
    }

    editor.addEventListener('change', (e) => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      hasPendingChanges = true;
      debounceTimeout = setTimeout(() => {
        hasPendingChanges = false;
        onUpdate(e.content);
      }, 1000);
    });

    // Focus the editor
    if (editor.e) {
      editor.e.focus();
    }
  });

  function flushAndExit() {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    hasPendingChanges = false;
    if (editor) {
      onUpdate(editor.getContent());
    }
    onExit();
  }

  function handleClickOutside(e: PointerEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      flushAndExit();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
      hasPendingChanges = false;
      // Revert content
      if (editor) {
        editor.setContent(originalContent);
      }
      onUpdate(originalContent);
      onExit();
    }
  }

  onDestroy(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    if (hasPendingChanges && editor) {
      onUpdate(editor.getContent());
    }
  });
</script>

<svelte:document onpointerdown={handleClickOutside} />

<div
  class="markdown-editor-container"
  bind:this={containerEl}
  onkeydown={handleKeydown}
  role="textbox"
  tabindex="-1"
  data-testid="markdown-editor"
>
  {#if showToolbar}
    <div bind:this={commandBarEl} class="markdown-editor-toolbar"></div>
  {/if}
  <div
    bind:this={editorEl}
    class="markdown-editor-content"
    style="min-height: {minHeight}px"
    data-testid="markdown-editor-content"
  ></div>
</div>

<style>
  .markdown-editor-container {
    outline: none;
  }
</style>

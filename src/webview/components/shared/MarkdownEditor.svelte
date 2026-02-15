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
          {
            name: 'checklist',
            title: 'Checklist item (- [ ])',
            innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>`,
            action: (e: import('tiny-markdown-editor').Editor) => {
              e.paste('- [ ] ');
            },
            enabled: () => false,
          },
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

    // Auto-continue checklist items on Enter.
    // TinyMDE continues bullet lists (- ) but doesn't know about checklist
    // syntax (- [ ] ), so we patch the new line after TinyMDE processes it.
    editor.e?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !editor) return;
      const sel = editor.getSelection();
      if (!sel) return;
      const prevLine = editor.lines[sel.row];
      // Only act on checklist lines: "- [ ] text" or "- [x] text"
      const checklistMatch = /^( {0,3})- \[[ x]\] (.*)$/i.exec(prevLine);
      if (!checklistMatch) return;
      const isEmpty = checklistMatch[2].trim() === '';
      // After TinyMDE handles Enter (synchronously in beforeinput), patch the result.
      // Use setTimeout to ensure we run after TinyMDE's beforeinput handler.
      setTimeout(() => {
        if (!editor) return;
        const newSel = editor.getSelection();
        if (!newSel) return;
        const newLine = editor.lines[newSel.row];
        // Only patch if TinyMDE added just a bullet prefix
        if (!/^ {0,3}- $/.test(newLine)) return;
        if (isEmpty) {
          // Empty checklist item: clear previous line and new continuation
          // (same behavior as TinyMDE for empty bullet items)
          editor.lines[newSel.row - 1] = '';
          editor.lineDirty[newSel.row - 1] = true;
          editor.lines[newSel.row] = '';
          editor.lineDirty[newSel.row] = true;
          editor.updateFormatting();
          editor.setSelection({ row: newSel.row, col: 0 });
        } else {
          // Extend "- " to "- [ ] "
          const patched = newLine.replace(/^( {0,3}- )$/, '$1[ ] ');
          editor.lines[newSel.row] = patched;
          editor.lineDirty[newSel.row] = true;
          editor.updateFormatting();
          editor.setSelection({ row: newSel.row, col: patched.length });
        }
      });
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

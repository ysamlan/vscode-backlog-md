<script lang="ts">
  import type { BacklogDocument } from '../../lib/types';
  import { vscode } from '../../stores/vscode.svelte';

  let {
    documents,
  }: {
    documents: BacklogDocument[];
  } = $props();

  let searchQuery = $state('');

  let filteredDocs = $derived(
    searchQuery
      ? documents.filter(
          (d) =>
            d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : documents
  );

  function handleOpenDocument(docId: string) {
    vscode.postMessage({ type: 'openDocument', documentId: docId });
  }

  function getTypeBadgeClass(type?: string): string {
    switch (type) {
      case 'readme':
        return 'badge-readme';
      case 'guide':
        return 'badge-guide';
      case 'specification':
        return 'badge-spec';
      default:
        return 'badge-other';
    }
  }
</script>

<div class="docs-list">
  <div class="list-toolbar">
    <div class="search-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        type="text"
        class="search-input"
        placeholder="Search documents..."
        data-testid="docs-search-input"
        bind:value={searchQuery}
      />
    </div>
  </div>

  {#if filteredDocs.length === 0}
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
      </svg>
      <p>{searchQuery ? 'No documents match your search' : 'No documents found'}</p>
      {#if !searchQuery}
        <p class="empty-hint">Add markdown files to <code>backlog/docs/</code> to see them here</p>
      {/if}
    </div>
  {:else}
    <div class="list-items" data-testid="docs-list-items">
      {#each filteredDocs as doc (doc.id)}
        <button
          class="list-item"
          data-testid="doc-item-{doc.id}"
          data-doc-id={doc.id}
          onclick={() => handleOpenDocument(doc.id)}
        >
          <div class="item-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
            </svg>
          </div>
          <div class="item-content">
            <div class="item-title">{doc.title}</div>
            <div class="item-meta">
              {#if doc.type}
                <span class="type-badge {getTypeBadgeClass(doc.type)}">{doc.type}</span>
              {/if}
              {#each doc.tags as tag}
                <span class="tag-badge">{tag}</span>
              {/each}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .docs-list {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .list-toolbar {
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
  }

  .search-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    color: var(--vscode-input-foreground, #ccc);
  }

  .search-wrapper svg {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .search-input {
    all: unset;
    flex: 1;
    font-size: 12px;
    line-height: 20px;
    color: var(--vscode-input-foreground, #ccc);
  }

  .search-input::placeholder {
    color: var(--vscode-input-placeholderForeground, #888);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--vscode-descriptionForeground, #888);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
    font-size: 12px;
  }

  .empty-hint {
    opacity: 0.7;
    font-size: 11px !important;
  }

  .empty-hint code {
    background: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.17));
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
  }

  .list-items {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .list-item {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    width: 100%;
    box-sizing: border-box;
  }

  .list-item:hover {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
  }

  .list-item:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .item-icon {
    flex-shrink: 0;
    padding-top: 1px;
    color: var(--vscode-descriptionForeground, #888);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-size: 13px;
    color: var(--vscode-foreground, #ccc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .type-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: capitalize;
  }

  .badge-readme {
    background: rgba(33, 150, 243, 0.2);
    color: #64b5f6;
  }

  .badge-guide {
    background: rgba(76, 175, 80, 0.2);
    color: #81c784;
  }

  .badge-spec {
    background: rgba(156, 39, 176, 0.2);
    color: #ce93d8;
  }

  .badge-other {
    background: rgba(158, 158, 158, 0.2);
    color: #bdbdbd;
  }

  .tag-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(128, 128, 128, 0.17);
    color: var(--vscode-descriptionForeground, #888);
  }
</style>

<script lang="ts">
  import type { BacklogDocument, BacklogDecision } from '../../lib/types';
  import { vscode, onMessage } from '../../stores/vscode.svelte';

  type ViewMode = 'document' | 'decision' | 'loading';

  let viewMode = $state<ViewMode>('loading');

  // Document state
  let document = $state<BacklogDocument | null>(null);
  let contentHtml = $state('');

  // Decision state
  let decision = $state<BacklogDecision | null>(null);
  let decisionSections = $state<Record<string, string>>({});

  onMessage((message) => {
    switch (message.type) {
      case 'documentData':
        document = message.document as BacklogDocument;
        contentHtml = (message.contentHtml as string) || '';
        viewMode = 'document';
        break;
      case 'decisionData':
        decision = message.decision as BacklogDecision;
        decisionSections = (message.sections as Record<string, string>) || {};
        viewMode = 'decision';
        break;
      case 'error':
        console.error('[ContentDetail]', message.message);
        break;
    }
  });

  function handleOpenFile() {
    const filePath = viewMode === 'document' ? document?.filePath : decision?.filePath;
    if (filePath) {
      vscode.postMessage({ type: 'openFile', filePath });
    }
  }

  function getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'accepted': return 'status-accepted';
      case 'proposed': return 'status-proposed';
      case 'rejected': return 'status-rejected';
      case 'superseded': return 'status-superseded';
      default: return 'status-unknown';
    }
  }

  function getTypeBadgeClass(type?: string): string {
    switch (type) {
      case 'readme': return 'badge-readme';
      case 'guide': return 'badge-guide';
      case 'specification': return 'badge-spec';
      default: return 'badge-other';
    }
  }
</script>

<div class="content-detail" data-testid="content-detail">
  {#if viewMode === 'loading'}
    <div class="loading-state">
      <p>Loading...</p>
    </div>
  {:else if viewMode === 'document' && document}
    <div class="detail-header" data-testid="document-header">
      <div class="header-top">
        <span class="entity-id">{document.id}</span>
        <button class="open-file-btn" data-testid="open-file-btn" onclick={handleOpenFile} title="Open raw markdown file">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
          </svg>
          Open Raw File
        </button>
      </div>
      <h1 class="detail-title">{document.title}</h1>
      <div class="detail-meta">
        {#if document.type}
          <span class="type-badge {getTypeBadgeClass(document.type)}">{document.type}</span>
        {/if}
        {#each document.tags as tag}
          <span class="tag-badge">{tag}</span>
        {/each}
      </div>
      {#if document.createdAt || document.updatedAt}
        <div class="detail-dates">
          {#if document.createdAt}
            <span class="date-label">Created: {document.createdAt}</span>
          {/if}
          {#if document.updatedAt}
            <span class="date-label">Updated: {document.updatedAt}</span>
          {/if}
        </div>
      {/if}
    </div>
    <div class="detail-body" data-testid="document-body">
      {@html contentHtml}
    </div>

  {:else if viewMode === 'decision' && decision}
    <div class="detail-header" data-testid="decision-header">
      <div class="header-top">
        <span class="entity-id">{decision.id}</span>
        <button class="open-file-btn" data-testid="open-file-btn" onclick={handleOpenFile} title="Open raw markdown file">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
          </svg>
          Open Raw File
        </button>
      </div>
      <h1 class="detail-title">{decision.title}</h1>
      <div class="detail-meta">
        {#if decision.status}
          <span class="status-badge {getStatusBadgeClass(decision.status)}">{decision.status}</span>
        {/if}
        {#if decision.date}
          <span class="date-label">{decision.date}</span>
        {/if}
      </div>
    </div>
    <div class="detail-body" data-testid="decision-body">
      {#if decisionSections.context}
        <div class="decision-section">
          <h2>Context</h2>
          <div class="section-content">{@html decisionSections.context}</div>
        </div>
      {/if}
      {#if decisionSections.decision}
        <div class="decision-section">
          <h2>Decision</h2>
          <div class="section-content">{@html decisionSections.decision}</div>
        </div>
      {/if}
      {#if decisionSections.consequences}
        <div class="decision-section">
          <h2>Consequences</h2>
          <div class="section-content">{@html decisionSections.consequences}</div>
        </div>
      {/if}
      {#if decisionSections.alternatives}
        <div class="decision-section">
          <h2>Alternatives</h2>
          <div class="section-content">{@html decisionSections.alternatives}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .content-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: var(--vscode-descriptionForeground, #888);
  }

  .detail-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .entity-id {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    font-weight: 600;
    text-transform: uppercase;
  }

  .open-file-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    transition: background 0.15s, color 0.15s;
  }

  .open-file-btn:hover {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
    color: var(--vscode-foreground, #ccc);
  }

  .detail-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--vscode-editor-foreground, #d4d4d4);
    line-height: 1.3;
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    align-items: center;
  }

  .detail-dates {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .date-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
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

  .status-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: capitalize;
    font-weight: 500;
  }

  .status-accepted {
    background: rgba(76, 175, 80, 0.2);
    color: #81c784;
  }

  .status-proposed {
    background: rgba(33, 150, 243, 0.2);
    color: #64b5f6;
  }

  .status-rejected {
    background: rgba(244, 67, 54, 0.2);
    color: #ef9a9a;
  }

  .status-superseded {
    background: rgba(255, 152, 0, 0.2);
    color: #ffb74d;
  }

  .status-unknown {
    background: rgba(158, 158, 158, 0.2);
    color: #bdbdbd;
  }

  .detail-body {
    padding: 16px 20px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--vscode-editor-foreground, #d4d4d4);
  }

  .detail-body :global(h1),
  .detail-body :global(h2),
  .detail-body :global(h3) {
    margin-top: 16px;
    margin-bottom: 8px;
    color: var(--vscode-editor-foreground, #d4d4d4);
  }

  .detail-body :global(h1) { font-size: 18px; }
  .detail-body :global(h2) { font-size: 15px; }
  .detail-body :global(h3) { font-size: 13px; }

  .detail-body :global(p) {
    margin: 0 0 8px 0;
  }

  .detail-body :global(code) {
    background: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.17));
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }

  .detail-body :global(pre) {
    background: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.17));
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .detail-body :global(pre code) {
    background: none;
    padding: 0;
  }

  .detail-body :global(ul),
  .detail-body :global(ol) {
    margin: 4px 0 8px 0;
    padding-left: 20px;
  }

  .detail-body :global(a) {
    color: var(--vscode-textLink-foreground, #3794ff);
  }

  .detail-body :global(table) {
    border-collapse: collapse;
    margin: 8px 0;
    width: 100%;
  }

  .detail-body :global(th),
  .detail-body :global(td) {
    border: 1px solid var(--vscode-widget-border, #303031);
    padding: 6px 12px;
    text-align: left;
  }

  .detail-body :global(th) {
    background: var(--vscode-sideBar-background, #252526);
    font-weight: 600;
  }

  .detail-body :global(blockquote) {
    border-left: 3px solid var(--vscode-textBlockQuote-border, #007acc);
    margin: 8px 0;
    padding: 4px 0 4px 12px;
    color: var(--vscode-textBlockQuote-foreground, #cccccc);
  }

  .detail-body :global(hr) {
    border: none;
    border-top: 1px solid var(--vscode-widget-border, #303031);
    margin: 16px 0;
  }

  .decision-section {
    margin-bottom: 20px;
  }

  .decision-section h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-editor-foreground, #d4d4d4);
    margin: 0 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
  }

  .section-content {
    font-size: 13px;
    line-height: 1.6;
  }

  .section-content :global(p) {
    margin: 0 0 8px 0;
  }

  .section-content :global(ul),
  .section-content :global(ol) {
    margin: 4px 0 8px 0;
    padding-left: 20px;
  }

  .section-content :global(code) {
    background: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.17));
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }

  .section-content :global(pre) {
    background: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.17));
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .section-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .section-content :global(a) {
    color: var(--vscode-textLink-foreground, #3794ff);
  }

  .section-content :global(table) {
    border-collapse: collapse;
    margin: 8px 0;
    width: 100%;
  }

  .section-content :global(th),
  .section-content :global(td) {
    border: 1px solid var(--vscode-widget-border, #303031);
    padding: 6px 12px;
    text-align: left;
  }

  .section-content :global(th) {
    background: var(--vscode-sideBar-background, #252526);
    font-weight: 600;
  }

  .section-content :global(blockquote) {
    border-left: 3px solid var(--vscode-textBlockQuote-border, #007acc);
    margin: 8px 0;
    padding: 4px 0 4px 12px;
    color: var(--vscode-textBlockQuote-foreground, #cccccc);
  }
</style>

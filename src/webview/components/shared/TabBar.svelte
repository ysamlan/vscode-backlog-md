<script lang="ts">
  import type { TabMode } from '../../lib/types';

  interface Tab {
    mode: TabMode;
    label: string;
  }

  const tabs: Tab[] = [
    { mode: 'kanban', label: 'Kanban' },
    { mode: 'list', label: 'List' },
    { mode: 'drafts', label: 'Drafts' },
    { mode: 'archived', label: 'Archived' },
    { mode: 'dashboard', label: 'Dashboard' },
  ];

  let {
    activeTab,
    draftCount = 0,
    onTabChange,
    onCreateTask,
    onRefresh,
  }: {
    activeTab: TabMode;
    draftCount?: number;
    onTabChange: (tab: TabMode) => void;
    onCreateTask: () => void;
    onRefresh: () => void;
  } = $props();
</script>

<div class="tab-bar" role="tablist">
  {#each tabs as tab (tab.mode)}
    <button
      class="tab"
      class:active={activeTab === tab.mode}
      role="tab"
      aria-selected={activeTab === tab.mode}
      data-testid="tab-{tab.mode}"
      onclick={() => onTabChange(tab.mode)}
    >
      {#if tab.mode === 'kanban'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>
        </svg>
      {:else if tab.mode === 'list'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>
        </svg>
      {:else if tab.mode === 'drafts'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"/><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>
        </svg>
      {:else if tab.mode === 'archived'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>
        </svg>
      {:else if tab.mode === 'dashboard'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18"/><path d="M13 17V9"/><path d="M18 17V5"/><path d="M8 17v-3"/>
        </svg>
      {/if}
      <span class="tab-label">{tab.label}{#if tab.mode === 'drafts' && draftCount > 0} ({draftCount}){/if}</span>
    </button>
  {/each}

  <div class="tab-spacer"></div>

  <button
    class="tab-action"
    title="Create Task"
    data-testid="action-create"
    onclick={() => onCreateTask()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  </button>

  <button
    class="tab-action"
    title="Refresh"
    data-testid="action-refresh"
    onclick={() => onRefresh()}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  </button>
</div>

<style>
  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
    padding: 0 4px;
    gap: 0;
    flex-shrink: 0;
    align-items: stretch;
  }

  .tab {
    all: unset;
    cursor: pointer;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border-bottom: 2px solid transparent;
    transition: opacity 0.15s, border-color 0.15s;
    color: var(--vscode-foreground);
    opacity: 0.5;
  }

  .tab .tab-label {
    font-size: 10px;
    white-space: nowrap;
  }

  .tab:hover {
    opacity: 0.8;
  }

  .tab:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .tab.active {
    opacity: 1;
    border-bottom-color: var(--vscode-focusBorder);
  }

  .tab-spacer {
    flex: 1;
  }

  .tab-action {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    opacity: 0.6;
    color: var(--vscode-foreground);
    border-radius: 4px;
  }

  .tab-action:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
  }
</style>

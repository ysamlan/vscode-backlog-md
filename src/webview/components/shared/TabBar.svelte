<script lang="ts">
  type TabMode = 'kanban' | 'list' | 'drafts' | 'archived';

  interface Tab {
    mode: TabMode;
    label: string;
  }

  const tabs: Tab[] = [
    { mode: 'kanban', label: 'Kanban' },
    { mode: 'list', label: 'List' },
    { mode: 'drafts', label: 'Drafts' },
    { mode: 'archived', label: 'Archived' },
  ];

  let { activeTab, onTabChange }: { activeTab: TabMode; onTabChange: (tab: TabMode) => void } =
    $props();
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
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
    padding: 0 4px;
    gap: 0;
    flex-shrink: 0;
  }

  .tab {
    all: unset;
    cursor: pointer;
    padding: 6px 12px;
    font-size: 12px;
    color: var(--vscode-foreground);
    opacity: 0.7;
    border-bottom: 2px solid transparent;
    transition: opacity 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .tab:hover {
    opacity: 1;
  }

  .tab:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .tab.active {
    opacity: 1;
    font-weight: 600;
    border-bottom-color: var(--vscode-focusBorder, var(--vscode-button-background, #007acc));
  }
</style>

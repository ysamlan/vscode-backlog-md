<script lang="ts">
  interface Root {
    label: string;
    backlogPath: string;
  }

  let {
    roots,
    activeBacklogPath,
    onRootChange,
    onInitBacklog,
  }: {
    roots: Root[];
    activeBacklogPath: string;
    onRootChange: (backlogPath: string) => void;
    onInitBacklog?: () => void;
  } = $props();
</script>

{#if roots.length > 1}
  <div
    class="workspace-tabs"
    data-testid="workspace-tabs"
    role="tablist"
    aria-label="Workspace"
  >
    {#each roots as root (root.backlogPath)}
      <button
        class="workspace-tab"
        class:active={root.backlogPath === activeBacklogPath}
        data-testid="workspace-tab-{root.label}"
        role="tab"
        aria-selected={root.backlogPath === activeBacklogPath}
        title={root.backlogPath}
        onclick={() => onRootChange(root.backlogPath)}
      >
        {root.label}
      </button>
    {/each}
    <button
      class="workspace-tab add-tab"
      data-testid="add-workspace-tab"
      role="tab"
      title="Initialize backlog in a directory..."
      onclick={onInitBacklog}
    >
      +
    </button>
  </div>
{/if}

<style>
  .workspace-tabs {
    display: flex;
    gap: 1px;
    padding: 4px 8px 0;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid
      var(
        --vscode-widget-border,
        var(--vscode-sideBarSectionHeader-border, transparent)
      );
    flex-shrink: 0;
    overflow-x: auto;
  }

  .workspace-tab {
    padding: 3px 10px 4px;
    border: none;
    background: transparent;
    color: var(--vscode-tab-inactiveForeground, var(--vscode-foreground));
    font-size: 11px;
    font-family: var(--vscode-font-family);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    border-radius: 3px 3px 0 0;
    opacity: 0.75;
  }

  .workspace-tab:hover {
    color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
    background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.1));
    opacity: 1;
  }

  .workspace-tab.active {
    color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
    border-bottom-color: var(
      --vscode-focusBorder,
      var(--vscode-panelTitle-activeBorder)
    );
    font-weight: 600;
    opacity: 1;
  }

  .workspace-tab:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .add-tab {
    font-size: 16px;
    font-weight: 300;
    line-height: 1;
    padding: 1px 8px 3px;
    opacity: 0.5;
    margin-left: auto;
  }

  .add-tab:hover {
    opacity: 1;
  }
</style>

<script lang="ts">
  import { vscode } from '../../stores/vscode.svelte';

  interface Props {
    cliAvailable: boolean;
  }

  let { cliAvailable }: Props = $props();
</script>

<div class="agent-setup-banner" data-testid="agent-setup-banner">
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="banner-icon"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
  <span class="banner-text">
    {#if cliAvailable}
      Set up AI agent integration (MCP, instructions, completions)
    {:else}
      Install Backlog.md CLI to enable AI agent integration
    {/if}
  </span>
  <button
    class="banner-action-btn"
    data-testid="agent-setup-btn"
    onclick={() => vscode.postMessage({ type: 'setupAgentIntegration' })}
  >
    {cliAvailable ? 'Set Up' : 'Install & Set Up'}
  </button>
  <button
    class="banner-dismiss-btn"
    data-testid="agent-dismiss-btn"
    onclick={() => vscode.postMessage({ type: 'dismissIntegrationBanner' })}
    title="Dismiss"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </button>
</div>

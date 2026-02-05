<script lang="ts">
  import { onMessage, vscode } from '../../stores/vscode.svelte';
  import type { DashboardStats } from '../../lib/types';
  import StatsGrid from './StatsGrid.svelte';
  import StatusBreakdown from './StatusBreakdown.svelte';
  import PriorityBreakdown from './PriorityBreakdown.svelte';
  import MilestoneList from './MilestoneList.svelte';
  import EmptyState from './EmptyState.svelte';

  type ViewState = 'loading' | 'stats' | 'no-tasks' | 'no-backlog';

  let viewState: ViewState = $state('loading');
  let stats: DashboardStats | null = $state(null);

  // Listen for messages from the extension
  onMessage((message) => {
    switch (message.type) {
      case 'statsUpdated':
        stats = message.stats as DashboardStats;
        viewState = stats.totalTasks === 0 ? 'no-tasks' : 'stats';
        break;
      case 'noBacklogFolder':
        viewState = 'no-backlog';
        break;
      case 'error':
        console.error('[Dashboard]', message.message);
        break;
    }
  });

  // Request initial data on mount
  $effect(() => {
    vscode.postMessage({ type: 'refresh' });
  });
</script>

<div id="dashboard-content">
  {#if viewState === 'loading'}
    <div class="empty-state">Loading statistics...</div>
  {:else if viewState === 'no-tasks'}
    <EmptyState type="no-tasks" />
  {:else if viewState === 'no-backlog'}
    <EmptyState type="no-backlog" />
  {:else if viewState === 'stats' && stats}
    <StatsGrid {stats} />
    <StatusBreakdown {stats} />
    <PriorityBreakdown {stats} />
    <MilestoneList milestones={stats.milestones} />
  {/if}
</div>

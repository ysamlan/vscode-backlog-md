<script lang="ts">
  import type { DashboardStats } from '../../lib/types';
  import StatsGrid from './StatsGrid.svelte';
  import StatusBreakdown from './StatusBreakdown.svelte';
  import PriorityBreakdown from './PriorityBreakdown.svelte';
  import MilestoneList from './MilestoneList.svelte';
  import EmptyState from './EmptyState.svelte';

  let {
    stats = null,
    noBacklog = false,
    projectName = undefined,
  }: {
    stats: DashboardStats | null;
    noBacklog?: boolean;
    projectName?: string;
  } = $props();

  const viewState = $derived(
    noBacklog
      ? 'no-backlog'
      : stats === null
        ? 'loading'
        : stats.totalTasks === 0
          ? 'no-tasks'
          : 'stats'
  );
</script>

<div id="dashboard-content">
  {#if projectName}
    <h2 class="project-name">{projectName}</h2>
  {/if}
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

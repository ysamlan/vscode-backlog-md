<script lang="ts">
  import { vscode } from '../../stores/vscode.svelte';
  import type { DashboardStats } from '../../lib/types';
  import { statusToClass, customStatCardStyle } from '../../lib/statusColors';

  interface Props {
    stats: DashboardStats;
  }

  let { stats }: Props = $props();

  // Use the last status as the "done" status for completion percentage
  let statusNames = $derived(Object.keys(stats.byStatus));
  let doneStatusName = $derived(statusNames.length > 0 ? statusNames[statusNames.length - 1] : 'Done');
  const completionPct = $derived(
    stats.totalTasks > 0 ? Math.round(((stats.byStatus[doneStatusName] || 0) / stats.totalTasks) * 100) : 0
  );

  function handleStatusClick(status: string) {
    vscode.postMessage({ type: 'filterByStatus', status });
  }
</script>

<div class="stats-grid">
  {#each Object.entries(stats.byStatus) as [status, count] (status)}
    <button
      class="stat-card stat-{statusToClass(status)} clickable"
      style={customStatCardStyle(status)}
      onclick={() => handleStatusClick(status)}
      type="button"
    >
      <div class="stat-value">{count}</div>
      <div class="stat-label">{status}</div>
    </button>
  {/each}

  <div class="stat-card">
    <div class="stat-value">{stats.totalTasks}</div>
    <div class="stat-label">Total</div>
    <div class="stat-sublabel">{completionPct}% complete</div>
    {#if stats.completedCount > 0}
      <div class="stat-sublabel">+{stats.completedCount} completed</div>
    {/if}
  </div>
</div>

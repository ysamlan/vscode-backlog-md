<script lang="ts">
  import { vscode } from '../../stores/vscode.svelte';
  import type { DashboardStats } from '../../lib/types';

  interface Props {
    stats: DashboardStats;
  }

  let { stats }: Props = $props();

  const completionPct = $derived(
    stats.totalTasks > 0 ? Math.round((stats.byStatus['Done'] / stats.totalTasks) * 100) : 0
  );

  function handleStatusClick(status: string) {
    vscode.postMessage({ type: 'filterByStatus', status });
  }
</script>

<div class="stats-grid">
  <button
    class="stat-card stat-todo clickable"
    onclick={() => handleStatusClick('To Do')}
    type="button"
  >
    <div class="stat-value">{stats.byStatus['To Do'] || 0}</div>
    <div class="stat-label">To Do</div>
  </button>

  <button
    class="stat-card stat-in-progress clickable"
    onclick={() => handleStatusClick('In Progress')}
    type="button"
  >
    <div class="stat-value">{stats.byStatus['In Progress'] || 0}</div>
    <div class="stat-label">In Progress</div>
  </button>

  <button
    class="stat-card stat-done clickable"
    onclick={() => handleStatusClick('Done')}
    type="button"
  >
    <div class="stat-value">{stats.byStatus['Done'] || 0}</div>
    <div class="stat-label">Done</div>
  </button>

  <div class="stat-card">
    <div class="stat-value">{stats.totalTasks}</div>
    <div class="stat-label">Total ({completionPct}%)</div>
  </div>
</div>

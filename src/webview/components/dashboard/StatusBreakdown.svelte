<script lang="ts">
  import type { DashboardStats } from '../../lib/types';

  interface Props {
    stats: DashboardStats;
  }

  let { stats }: Props = $props();

  function getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  function getPercentage(count: number): number {
    return stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
  }
</script>

<div class="section">
  <div class="section-title">Status Breakdown</div>
  <div class="status-breakdown">
    {#each Object.entries(stats.byStatus) as [status, count]}
      <div class="status-row">
        <span class="status-name">{status}</span>
        <div class="status-bar-container">
          <div
            class="status-bar status-bar-{getStatusClass(status)}"
            style="width: {getPercentage(count)}%"
          ></div>
        </div>
        <span class="status-count">{count}</span>
      </div>
    {/each}
  </div>
</div>

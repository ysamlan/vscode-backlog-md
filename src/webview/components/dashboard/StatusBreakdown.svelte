<script lang="ts">
  import type { DashboardStats } from '../../lib/types';
  import { statusToClass, customStatusBarStyle } from '../../lib/statusColors';

  interface Props {
    stats: DashboardStats;
  }

  let { stats }: Props = $props();

  function getPercentage(count: number): number {
    return stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
  }

  function barStyle(status: string, count: number): string {
    const widthStyle = `width: ${getPercentage(count)}%;`;
    const colorStyle = customStatusBarStyle(status);
    return colorStyle ? `${widthStyle} ${colorStyle}` : widthStyle;
  }
</script>

<div class="section">
  <div class="section-title">Status Breakdown</div>
  <div class="status-breakdown">
    {#each Object.entries(stats.byStatus) as [status, count] (status)}
      <div class="status-row">
        <span class="status-name">{status}</span>
        <div class="status-bar-container">
          <div
            class="status-bar status-bar-{statusToClass(status)}"
            style={barStyle(status, count)}
          ></div>
        </div>
        <span class="status-count">{count}</span>
      </div>
    {/each}
  </div>
</div>

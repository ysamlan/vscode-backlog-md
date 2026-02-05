<script lang="ts">
  import type { DashboardStats } from '../../lib/types';

  interface Props {
    stats: DashboardStats;
  }

  let { stats }: Props = $props();
</script>

<div class="section">
  <div class="section-title">Priority Distribution</div>
  <div class="priority-breakdown">
    <div class="priority-item priority-high">
      <span class="priority-label">High</span>
      <span class="priority-count">{stats.byPriority.high || 0}</span>
    </div>
    <div class="priority-item priority-medium">
      <span class="priority-label">Medium</span>
      <span class="priority-count">{stats.byPriority.medium || 0}</span>
    </div>
    <div class="priority-item priority-low">
      <span class="priority-label">Low</span>
      <span class="priority-count">{stats.byPriority.low || 0}</span>
    </div>
    <div class="priority-item priority-none">
      <span class="priority-label">None</span>
      <span class="priority-count">{stats.byPriority.none || 0}</span>
    </div>
  </div>
</div>

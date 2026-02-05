<script lang="ts">
  import type { MilestoneStats } from '../../lib/types';

  interface Props {
    milestones: MilestoneStats[];
  }

  let { milestones }: Props = $props();

  function getPercentage(milestone: MilestoneStats): number {
    return milestone.total > 0 ? Math.round((milestone.done / milestone.total) * 100) : 0;
  }
</script>

{#if milestones.length > 0}
  <div class="section">
    <div class="section-title">Milestone Progress</div>
    <div class="milestone-list">
      {#each milestones as milestone}
        <div class="milestone-item">
          <div class="milestone-info">
            <span class="milestone-name">{milestone.name}</span>
            <span class="milestone-stats">{milestone.done}/{milestone.total} tasks</span>
          </div>
          <div class="milestone-bar-container">
            <div class="milestone-bar" style="width: {getPercentage(milestone)}%"></div>
          </div>
          <span class="milestone-pct">{getPercentage(milestone)}%</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

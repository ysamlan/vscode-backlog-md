<script lang="ts">
  import type { TaskPriority } from '../../lib/types';

  interface Props {
    priority: TaskPriority;
    size?: number;
  }

  let { priority, size = 14 }: Props = $props();

  const labels: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
</script>

<span
  class="priority-icon priority-{priority}"
  title={labels[priority] ?? priority}
  data-testid="priority-icon-{priority}"
>
  {#if priority === 'high'}
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>
    </svg>
  {:else if priority === 'medium'}
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  {:else if priority === 'low'}
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  {/if}
</span>

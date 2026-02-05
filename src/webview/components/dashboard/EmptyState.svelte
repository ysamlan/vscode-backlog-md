<script lang="ts">
  interface Props {
    type: 'no-tasks' | 'no-backlog';
  }

  let { type }: Props = $props();
</script>

<div class="empty-state">
  {#if type === 'no-tasks'}
    <div style="font-size: 48px; margin-bottom: 16px;">&#128202;</div>
    <h3>No Tasks Yet</h3>
    <p>Create tasks in your backlog/ folder to see statistics.</p>
  {:else if type === 'no-backlog'}
    <div style="font-size: 48px; margin-bottom: 16px;">&#128203;</div>
    <h3>No Backlog Found</h3>
    <p>This workspace doesn't have a <code>backlog/</code> folder.</p>
  {/if}
</div>

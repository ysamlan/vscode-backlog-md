<script lang="ts">
  import { onMessage, vscode } from '../../stores/vscode.svelte';
  import type { Task, TaskPriority } from '../../lib/types';
  import CompactTaskDetails from './CompactTaskDetails.svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };

  let task = $state<TaskWithBlocks | null>(null);
  let statuses = $state<string[]>([]);

  onMessage((message) => {
    switch (message.type) {
      case 'taskPreviewData':
        task = message.task as TaskWithBlocks;
        statuses = (message.statuses as string[]) || [];
        break;
      case 'taskPreviewCleared':
        task = null;
        statuses = [];
        break;
    }
  });

  function handleOpenFull(selectedTask: TaskWithBlocks) {
    vscode.postMessage({
      type: 'openTask',
      taskId: selectedTask.id,
      filePath: selectedTask.filePath,
      source: selectedTask.source,
      branch: selectedTask.branch,
    });
  }

  function handleUpdateStatus(selectedTask: TaskWithBlocks, status: string) {
    vscode.postMessage({
      type: 'updateTask',
      taskId: selectedTask.id,
      updates: { status },
    });
  }

  function handleUpdatePriority(selectedTask: TaskWithBlocks, priority: TaskPriority | undefined) {
    vscode.postMessage({
      type: 'updateTask',
      taskId: selectedTask.id,
      updates: { priority },
    });
  }

  $effect(() => {
    vscode.postMessage({ type: 'refresh' });
  });
</script>

<CompactTaskDetails
  {task}
  {statuses}
  onOpenFull={handleOpenFull}
  onUpdateStatus={handleUpdateStatus}
  onUpdatePriority={handleUpdatePriority}
/>

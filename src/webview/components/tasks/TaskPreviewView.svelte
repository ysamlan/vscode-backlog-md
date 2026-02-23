<script lang="ts">
  import { onMount } from 'svelte';
  import { onMessage, vscode } from '../../stores/vscode.svelte';
  import type { Task, TaskPriority } from '../../lib/types';
  import CompactTaskDetails from './CompactTaskDetails.svelte';

  type TaskWithBlocks = Task & { blocksTaskIds?: string[] };
  type SubtaskSummary = {
    id: string;
    title: string;
    status: string;
    filePath?: string;
    source?: Task['source'];
    branch?: Task['branch'];
  };

  let task = $state<TaskWithBlocks | null>(null);
  let statuses = $state<string[]>([]);
  let descriptionHtml = $state('');
  let planHtml = $state('');
  let notesHtml = $state('');
  let finalSummaryHtml = $state('');
  let subtaskSummaries = $state<SubtaskSummary[]>([]);

  onMessage((message) => {
    switch (message.type) {
      case 'taskPreviewData':
        task = message.task as TaskWithBlocks;
        statuses = (message.statuses as string[]) || [];
        descriptionHtml = (message.descriptionHtml as string) || '';
        planHtml = (message.planHtml as string) || '';
        notesHtml = (message.notesHtml as string) || '';
        finalSummaryHtml = (message.finalSummaryHtml as string) || '';
        subtaskSummaries = (message.subtaskSummaries as SubtaskSummary[]) || [];
        break;
      case 'taskPreviewCleared':
        task = null;
        statuses = [];
        descriptionHtml = '';
        planHtml = '';
        notesHtml = '';
        finalSummaryHtml = '';
        subtaskSummaries = [];
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

  function handleOpenSubtask(subtask: SubtaskSummary) {
    vscode.postMessage({
      type: 'selectTask',
      taskId: subtask.id,
      filePath: subtask.filePath,
      source: subtask.source,
      branch: subtask.branch,
    });
  }

  function handleOpenRelatedTask(taskId: string) {
    vscode.postMessage({ type: 'selectTask', taskId });
  }

  onMount(() => {
    vscode.postMessage({ type: 'refresh' });
  });
</script>

<CompactTaskDetails
  {task}
  {statuses}
  {descriptionHtml}
  {planHtml}
  {notesHtml}
  {finalSummaryHtml}
  {subtaskSummaries}
  onOpenFull={handleOpenFull}
  onOpenSubtask={handleOpenSubtask}
  onOpenRelatedTask={handleOpenRelatedTask}
  onUpdateStatus={handleUpdateStatus}
  onUpdatePriority={handleUpdatePriority}
/>

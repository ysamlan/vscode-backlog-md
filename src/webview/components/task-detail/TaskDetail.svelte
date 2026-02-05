<script lang="ts">
  import { onMessage, vscode } from '../../stores/vscode.svelte';
  import type { TaskDetailData, Task } from '../../lib/types';
  import TaskHeader from './TaskHeader.svelte';
  import MetaSection from './MetaSection.svelte';
  import DescriptionSection from './DescriptionSection.svelte';
  import Checklist from './Checklist.svelte';
  import ActionButtons from './ActionButtons.svelte';

  // View state
  type ViewState = 'loading' | 'ready' | 'error';
  let viewState: ViewState = $state('loading');
  let errorMessage = $state('');

  // Task data
  let task: Task | null = $state(null);
  let statuses: string[] = $state([]);
  let uniqueLabels: string[] = $state([]);
  let uniqueAssignees: string[] = $state([]);
  let milestones: string[] = $state([]);
  let blocksTaskIds: string[] = $state([]);
  let isBlocked = $state(false);
  let descriptionHtml = $state('');

  // Handle messages from extension
  onMessage((message) => {
    switch (message.type) {
      case 'taskData':
        {
          const data = message.data as TaskDetailData;
          task = data.task;
          statuses = data.statuses;
          uniqueLabels = data.uniqueLabels;
          uniqueAssignees = data.uniqueAssignees;
          milestones = data.milestones;
          blocksTaskIds = data.blocksTaskIds;
          isBlocked = data.isBlocked;
          descriptionHtml = data.descriptionHtml;
          viewState = 'ready';
        }
        break;

      case 'error':
        errorMessage = (message as { type: 'error'; message: string }).message;
        viewState = 'error';
        break;
    }
  });

  // Request task data on mount
  $effect(() => {
    vscode.postMessage({ type: 'refresh' });
  });

  // Message handlers
  function handleUpdateTitle(title: string) {
    vscode.postMessage({ type: 'updateField', field: 'title', value: title });
  }

  function handleUpdateStatus(status: string) {
    vscode.postMessage({ type: 'updateField', field: 'status', value: status });
  }

  function handleUpdatePriority(priority: string | undefined) {
    vscode.postMessage({ type: 'updateField', field: 'priority', value: priority });
  }

  function handleUpdateLabels(labels: string[]) {
    vscode.postMessage({ type: 'updateField', field: 'labels', value: labels });
  }

  function handleUpdateAssignees(assignees: string[]) {
    vscode.postMessage({ type: 'updateField', field: 'assignee', value: assignees });
  }

  function handleUpdateMilestone(milestone: string | undefined) {
    vscode.postMessage({ type: 'updateField', field: 'milestone', value: milestone });
  }

  function handleUpdateDescription(description: string) {
    vscode.postMessage({ type: 'updateField', field: 'description', value: description });
  }

  function handleToggleChecklist(listType: string, itemId: number) {
    vscode.postMessage({ type: 'toggleChecklistItem', listType, itemId });
  }

  function handleOpenTask(taskId: string) {
    vscode.postMessage({ type: 'openTask', taskId });
  }

  function handleOpenFile() {
    vscode.postMessage({ type: 'openFile' });
  }

  function handleArchive() {
    if (task) {
      vscode.postMessage({ type: 'archiveTask', taskId: task.id });
    }
  }
</script>

{#if viewState === 'loading'}
  <div class="loading-state">
    <p>Loading task...</p>
  </div>
{:else if viewState === 'error'}
  <div class="error-state">
    <p>{errorMessage}</p>
  </div>
{:else if task}
  <TaskHeader
    taskId={task.id}
    title={task.title}
    status={task.status}
    priority={task.priority}
    {statuses}
    {isBlocked}
    onUpdateTitle={handleUpdateTitle}
    onUpdateStatus={handleUpdateStatus}
    onUpdatePriority={handleUpdatePriority}
  />

  <MetaSection
    labels={task.labels}
    assignees={task.assignee}
    milestone={task.milestone}
    dependencies={task.dependencies}
    {blocksTaskIds}
    {uniqueLabels}
    {uniqueAssignees}
    {milestones}
    onUpdateLabels={handleUpdateLabels}
    onUpdateAssignees={handleUpdateAssignees}
    onUpdateMilestone={handleUpdateMilestone}
    onOpenTask={handleOpenTask}
  />

  <DescriptionSection
    description={task.description || ''}
    {descriptionHtml}
    onUpdate={handleUpdateDescription}
  />

  <Checklist
    title="Acceptance Criteria"
    items={task.acceptanceCriteria}
    listType="acceptanceCriteria"
    onToggle={handleToggleChecklist}
  />

  <Checklist
    title="Definition of Done"
    items={task.definitionOfDone}
    listType="definitionOfDone"
    onToggle={handleToggleChecklist}
  />

  <ActionButtons onOpenFile={handleOpenFile} onArchive={handleArchive} />
{/if}

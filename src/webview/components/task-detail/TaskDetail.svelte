<script lang="ts">
  import { onMount } from 'svelte';
  import { onMessage, vscode } from '../../stores/vscode.svelte';
  import type { TaskDetailData, Task } from '../../lib/types';
  import TaskHeader from './TaskHeader.svelte';
  import MetaSection from './MetaSection.svelte';
  import SubtasksSection from './SubtasksSection.svelte';
  import Checklist from './Checklist.svelte';
  import MarkdownSection from './MarkdownSection.svelte';
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
  let milestones: Array<{ id: string; label: string }> = $state([]);
  let blocksTaskIds: string[] = $state([]);
  let linkableTasks: Array<{ id: string; title: string; status: string }> = $state([]);
  let isBlocked = $state(false);
  let missingDependencyIds: string[] = $state([]);
  let descriptionHtml = $state('');
  let planHtml = $state('');
  let notesHtml = $state('');
  let finalSummaryHtml = $state('');
  let isDraft = $state(false);
  let isArchived = $state(false);
  let isReadOnly = $state(false);
  let readOnlyReason = $state('');
  let parentTask: { id: string; title: string } | undefined = $state(undefined);
  let subtaskSummaries: Array<{ id: string; title: string; status: string }> | undefined = $state(undefined);

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
          linkableTasks = data.linkableTasks ?? [];
          isBlocked = data.isBlocked;
          missingDependencyIds = data.missingDependencyIds ?? [];
          descriptionHtml = data.descriptionHtml;
          planHtml = data.planHtml ?? '';
          notesHtml = data.notesHtml ?? '';
          finalSummaryHtml = data.finalSummaryHtml ?? '';
          isDraft = data.isDraft ?? false;
          isArchived = data.isArchived ?? false;
          isReadOnly = data.isReadOnly ?? false;
          readOnlyReason = data.readOnlyReason ?? '';
          parentTask = data.parentTask;
          subtaskSummaries = data.subtaskSummaries;
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
  onMount(() => {
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

  function handleRequestCreateMilestone() {
    vscode.postMessage({ type: 'createMilestone' });
  }

  function handleUpdateDescription(description: string) {
    vscode.postMessage({ type: 'updateField', field: 'description', value: description });
  }

  function handleToggleChecklist(listType: string, itemId: number) {
    vscode.postMessage({ type: 'toggleChecklistItem', listType, itemId });
  }

  function handleUpdateAcceptanceCriteria(text: string) {
    vscode.postMessage({ type: 'updateField', field: 'acceptanceCriteria', value: text });
  }

  function handleUpdateDefinitionOfDone(text: string) {
    vscode.postMessage({ type: 'updateField', field: 'definitionOfDone', value: text });
  }

  function handleUpdatePlan(value: string) {
    vscode.postMessage({ type: 'updateField', field: 'implementationPlan', value });
  }

  function handleUpdateImplementationNotes(value: string) {
    vscode.postMessage({ type: 'updateField', field: 'implementationNotes', value });
  }

  function handleUpdateFinalSummary(value: string) {
    vscode.postMessage({ type: 'updateField', field: 'finalSummary', value });
  }

  function handleOpenTask(taskId: string) {
    vscode.postMessage({ type: 'openTask', taskId });
  }

  function handleAddBlockedByLink(taskId: string) {
    vscode.postMessage({ type: 'addBlockedByLink', taskId });
  }

  function handleAddBlocksLink(taskId: string) {
    vscode.postMessage({ type: 'addBlocksLink', taskId });
  }

  function handleFilterByLabel(label: string) {
    vscode.postMessage({ type: 'filterByLabel', label });
  }

  function handleOpenFile() {
    vscode.postMessage({ type: 'openFile' });
  }

  function handleArchive() {
    if (task) {
      vscode.postMessage({ type: 'archiveTask', taskId: task.id });
    }
  }

  function handlePromoteDraft() {
    if (task) {
      vscode.postMessage({ type: 'promoteDraft', taskId: task.id });
    }
  }

  function handleDiscardDraft() {
    if (task) {
      vscode.postMessage({ type: 'discardDraft', taskId: task.id });
    }
  }

  function handleCreateSubtask() {
    if (task) {
      vscode.postMessage({ type: 'createSubtask', parentTaskId: task.id });
    }
  }

  function handleRestore() {
    if (task) {
      vscode.postMessage({ type: 'restoreTask', taskId: task.id });
    }
  }

  function handleDelete() {
    if (task) {
      vscode.postMessage({ type: 'deleteTask', taskId: task.id });
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
    {isReadOnly}
    onUpdateTitle={handleUpdateTitle}
    onUpdateStatus={handleUpdateStatus}
    onUpdatePriority={handleUpdatePriority}
  />

  {#if isReadOnly}
    <div class="draft-banner readonly-banner" data-testid="readonly-banner">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v12"/><path d="M18 9a3 3 0 0 0-3-3H6"/><path d="M6 15h9a3 3 0 1 1 0 6h-3"/></svg>
      <span>{readOnlyReason || 'This task is read-only.'}</span>
    </div>
  {:else if isArchived}
    <div class="draft-banner archived-banner">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
      <span>Archived — this task has been archived</span>
      <div class="draft-banner-actions">
        <button class="draft-promote-btn" data-testid="restore-archived-btn" onclick={handleRestore}>Restore</button>
      </div>
    </div>
  {:else if isDraft}
    <div class="draft-banner">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
      <span>Draft — changes saved automatically</span>
      <div class="draft-banner-actions">
        <button class="draft-promote-btn" data-testid="promote-draft-btn" onclick={handlePromoteDraft}>Save as Task</button>
        <button class="draft-discard-btn" data-testid="discard-draft-btn" onclick={handleDiscardDraft}>Discard</button>
      </div>
    </div>
  {/if}

  {#key task.id}
    <MetaSection
      labels={task.labels}
      assignees={task.assignee}
      milestone={task.milestone}
      dependencies={task.dependencies}
      {blocksTaskIds}
      {missingDependencyIds}
      {uniqueLabels}
      {uniqueAssignees}
      {milestones}
      {linkableTasks}
      {parentTask}
      onUpdateLabels={handleUpdateLabels}
      onUpdateAssignees={handleUpdateAssignees}
      onUpdateMilestone={handleUpdateMilestone}
      onRequestCreateMilestone={handleRequestCreateMilestone}
      onOpenTask={handleOpenTask}
      onAddBlockedByLink={handleAddBlockedByLink}
      onAddBlocksLink={handleAddBlocksLink}
      onFilterByLabel={handleFilterByLabel}
      {isReadOnly}
    />
  {/key}

  {#if subtaskSummaries && subtaskSummaries.length > 0}
    <SubtasksSection
      subtasks={subtaskSummaries}
      {statuses}
      onOpenTask={handleOpenTask}
      onCreateSubtask={handleCreateSubtask}
      {isReadOnly}
    />
  {/if}

  <MarkdownSection
    taskId={task.id}
    title="Description"
    fieldName="description"
    content={task.description || ''}
    contentHtml={descriptionHtml}
    emptyLabel="No description"
    onUpdate={handleUpdateDescription}
    {isReadOnly}
  />

  <Checklist
    title="Acceptance Criteria"
    items={task.acceptanceCriteria}
    listType="acceptanceCriteria"
    taskId={task.id}
    onToggle={handleToggleChecklist}
    onUpdateText={handleUpdateAcceptanceCriteria}
    {isReadOnly}
  />

  <Checklist
    title="Definition of Done"
    items={task.definitionOfDone}
    listType="definitionOfDone"
    taskId={task.id}
    onToggle={handleToggleChecklist}
    onUpdateText={handleUpdateDefinitionOfDone}
    {isReadOnly}
  />

  <MarkdownSection
    taskId={task.id}
    title="Implementation Plan"
    fieldName="implementationPlan"
    content={task.implementationPlan || ''}
    contentHtml={planHtml}
    emptyLabel="No plan"
    onUpdate={handleUpdatePlan}
    {isReadOnly}
  />

  <MarkdownSection
    taskId={task.id}
    title="Implementation Notes"
    fieldName="implementationNotes"
    content={task.implementationNotes || ''}
    contentHtml={notesHtml}
    emptyLabel="No notes"
    onUpdate={handleUpdateImplementationNotes}
    {isReadOnly}
  />

  {#if task.finalSummary || !isReadOnly}
    <MarkdownSection
      taskId={task.id}
      title="Final Summary"
      fieldName="finalSummary"
      content={task.finalSummary || ''}
      contentHtml={finalSummaryHtml}
      emptyLabel="No summary"
      onUpdate={handleUpdateFinalSummary}
      {isReadOnly}
    />
  {/if}

  <ActionButtons
    onOpenFile={handleOpenFile}
    onArchive={handleArchive}
    onRestore={handleRestore}
    onDelete={handleDelete}
    {isDraft}
    {isArchived}
    {isReadOnly}
  />
{/if}

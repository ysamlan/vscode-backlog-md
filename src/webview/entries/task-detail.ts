/**
 * Task Detail webview entry point
 *
 * Mounts the TaskDetail Svelte component which provides:
 * - Editable task title, status, and priority
 * - Labels and assignees management
 * - Description with markdown view/edit toggle
 * - Acceptance Criteria and Definition of Done checklists
 * - Dependency links and action buttons
 */
import { mount } from 'svelte';
import TaskDetail from '../components/task-detail/TaskDetail.svelte';

// Mount the component to the #app element
const target = document.getElementById('app');
if (target) {
  mount(TaskDetail, { target });
}

export {};

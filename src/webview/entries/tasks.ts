/**
 * Tasks (Kanban/List) webview entry point
 */
import { mount } from 'svelte';
import Tasks from '../components/tasks/Tasks.svelte';

// Mount the component to the #app element
const target = document.getElementById('app') || document.getElementById('kanban-app');
if (target) {
  mount(Tasks, { target });
}

export {};

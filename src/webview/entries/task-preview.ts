import { mount } from 'svelte';
import TaskPreviewView from '../components/tasks/TaskPreviewView.svelte';

const target = document.getElementById('app');
if (target) {
  mount(TaskPreviewView, { target });
}

export {};

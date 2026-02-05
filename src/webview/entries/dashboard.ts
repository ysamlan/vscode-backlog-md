/**
 * Dashboard webview entry point
 *
 * Mounts the Dashboard Svelte component which displays project statistics
 * including task counts by status, priority distribution, and milestone progress.
 */
import { mount } from 'svelte';
import Dashboard from '../components/dashboard/Dashboard.svelte';

// Mount the component to the #app element (or #dashboard-content for backward compat)
const target = document.getElementById('app') || document.getElementById('dashboard-content');
if (target) {
  mount(Dashboard, { target });
}

export {};

/**
 * Task Detail webview entry point
 *
 * This is a placeholder that will be replaced with the actual
 * TaskDetail component in Phase 3 of the Svelte migration.
 */
import { mount } from 'svelte';
import HelloWorld from '../components/shared/HelloWorld.svelte';

// Mount the component to the #app element
const target = document.getElementById('app');
if (target) {
  mount(HelloWorld, { target });
}

export {};

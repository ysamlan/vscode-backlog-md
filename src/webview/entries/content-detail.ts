/**
 * Content Detail webview entry point
 *
 * Mounts the ContentDetail Svelte component which provides:
 * - Read-only document rendering (from backlog/docs/)
 * - Read-only decision rendering (from backlog/decisions/)
 * - "Open Raw File" button for editing in the text editor
 */
import { mount } from 'svelte';
import ContentDetail from '../components/content-detail/ContentDetail.svelte';

const target = document.getElementById('app');
if (target) {
  mount(ContentDetail, { target });
}

export {};

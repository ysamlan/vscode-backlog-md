import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  // Enable preprocessing for TypeScript in Svelte components
  preprocess: vitePreprocess(),
  compilerOptions: {
    // CSP-compatible: creates DOM one element at a time, no innerHTML
    fragments: 'tree',
    // Enable Svelte 5 runes mode
    runes: true,
  },
};

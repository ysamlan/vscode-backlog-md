import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

/**
 * Vite configuration for compiling Svelte webview components
 *
 * This builds Svelte components into self-contained bundles that can be loaded
 * directly in VS Code webviews via <script src="..."> tags.
 *
 * CSP Compatibility:
 * - fragments: 'tree' creates DOM programmatically (no innerHTML)
 * - css: 'external' outputs separate CSS file
 *
 * See: https://svelte.dev/docs/svelte/svelte-compiler#CompileOptions
 */
export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        // CSP-compatible: creates DOM one element at a time, no innerHTML
        fragments: 'tree',
        // Output CSS to separate file (handled by Tailwind in this project)
        css: 'external',
        // Enable Svelte 5 runes mode
        runes: true,
      },
    }),
  ],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: false, // Don't delete styles.css from Tailwind
    rollupOptions: {
      input: {
        tasks: resolve(__dirname, 'src/webview/entries/tasks.ts'),
        'task-preview': resolve(__dirname, 'src/webview/entries/task-preview.ts'),
        'task-detail': resolve(__dirname, 'src/webview/entries/task-detail.ts'),
        'content-detail': resolve(__dirname, 'src/webview/entries/content-detail.ts'),
      },
      output: {
        // Output as [name].js (e.g., tasks.js, dashboard.js)
        entryFileNames: '[name].js',
        // Put shared chunks in a chunks directory
        chunkFileNames: 'chunks/[name]-[hash].js',
        // No asset hashing - we want predictable names
        assetFileNames: '[name][extname]',
        // Use ES modules format (works in modern webviews)
        format: 'es',
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Minify for production
    minify: true,
    // Mermaid (~600 kB core + sub-diagrams) is lazy-imported from
    // src/webview/lib/mermaid.ts and only fetched when a task contains
    // a ```mermaid block, so it never blocks initial webview paint.
    // Raise the warning threshold to silence expected noise.
    chunkSizeWarningLimit: 700,
  },
  resolve: {
    alias: {
      // Allow imports from src/core types
      '@core': resolve(__dirname, 'src/core'),
    },
  },
});

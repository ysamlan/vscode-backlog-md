/**
 * Svelte action that renders mermaid diagrams inside an element.
 *
 * Usage: `use:renderMermaidAction={htmlContent}`
 *
 * The action watches for changes to the HTML content parameter and re-renders
 * mermaid blocks when the content changes (e.g., navigating between tasks).
 */
import type { Action } from 'svelte/action';

function hasMermaidBlocks(html: string): boolean {
  return html.includes('language-mermaid');
}

async function render(node: HTMLElement): Promise<void> {
  const { renderMermaidIn } = await import('./mermaid');
  requestAnimationFrame(() => {
    renderMermaidIn(node);
  });
}

export const renderMermaidAction: Action<HTMLElement, string> = (node, html) => {
  if (html && hasMermaidBlocks(html)) {
    render(node);
  }

  return {
    update(newHtml: string) {
      if (newHtml && hasMermaidBlocks(newHtml)) {
        render(node);
      }
    },
  };
};

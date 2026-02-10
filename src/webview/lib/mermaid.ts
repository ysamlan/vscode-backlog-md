/**
 * Mermaid diagram rendering utility for webview components.
 *
 * Ported from upstream Backlog.md (src/web/utils/mermaid.ts) with adaptations
 * for VS Code theming and error display.
 */

// Type definitions for Mermaid API
interface MermaidAPI {
  initialize: (config: MermaidConfig) => void;
  run?: (options?: MermaidRunOptions) => Promise<void>;
  render: (id: string, text: string) => Promise<MermaidRenderResult>;
}

interface MermaidConfig {
  startOnLoad?: boolean;
  securityLevel?: 'strict' | 'loose' | 'antiscript' | 'sandbox';
  theme?: 'base' | 'default' | 'dark' | 'forest' | 'neutral' | 'null';
  logLevel?: number;
  [key: string]: unknown;
}

interface MermaidRunOptions {
  nodes?: HTMLElement[];
  querySelector?: string;
  suppressErrors?: boolean;
}

interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (element: HTMLElement) => void;
}

interface MermaidModule {
  default: MermaidAPI;
}

type MermaidGlobal = typeof globalThis & {
  __MERMAID_MOCK__?: MermaidModule;
};

let mermaidModule: MermaidModule | null = null;
let lastTheme: string | undefined;

async function ensureMermaid(): Promise<MermaidModule> {
  const mock = (globalThis as MermaidGlobal).__MERMAID_MOCK__;
  if (mock) {
    lastTheme = undefined; // Reset so mock can reconfigure
    return mock;
  }

  if (mermaidModule) return mermaidModule;

  mermaidModule = (await import('mermaid')) as unknown as MermaidModule;
  return mermaidModule;
}

/**
 * Detect VS Code theme from body class and return the appropriate mermaid theme.
 */
function detectTheme(): 'dark' | 'default' {
  const bodyClass = document.body.className;
  if (bodyClass.includes('vscode-dark') || bodyClass.includes('vscode-high-contrast')) {
    return 'dark';
  }
  return 'default';
}

function initializeMermaid(mermaid: MermaidAPI): void {
  const theme = detectTheme();
  if (lastTheme === theme) return;
  lastTheme = theme;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
  });
}

/**
 * Create a styled error container for a failed mermaid diagram.
 */
function createErrorContainer(errorMessage: string, source: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'mermaid-error';

  const title = document.createElement('div');
  title.className = 'mermaid-error-title';
  title.textContent = 'Diagram Error';
  container.appendChild(title);

  const msg = document.createElement('pre');
  msg.className = 'mermaid-error-message';
  msg.textContent = errorMessage;
  container.appendChild(msg);

  const details = document.createElement('details');
  details.className = 'mermaid-error-source';
  const summary = document.createElement('summary');
  summary.textContent = 'Show source';
  details.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = source;
  details.appendChild(pre);
  container.appendChild(details);

  return container;
}

/**
 * Scan an element for `<pre><code class="language-mermaid">` blocks and render
 * them as SVG diagrams. Blocks that fail to render show a styled error.
 *
 * The mermaid library is loaded lazily — only when mermaid blocks are found.
 */
export async function renderMermaidIn(element: HTMLElement): Promise<void> {
  const codeBlocks = Array.from(
    element.querySelectorAll('pre > code.language-mermaid')
  ) as HTMLElement[];
  if (codeBlocks.length === 0) return;

  try {
    const m = await ensureMermaid();
    initializeMermaid(m.default);

    for (const codeEl of codeBlocks) {
      const parent = codeEl.parentElement as HTMLElement;
      if (!parent) continue;
      const diagramText = codeEl.textContent || '';

      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid';
      wrapper.textContent = diagramText;
      parent.replaceWith(wrapper);

      try {
        // Prefer the run() API (mermaid v10+)
        if (m.default.run) {
          try {
            await m.default.run({ nodes: [wrapper] });
            continue;
          } catch {
            // Fall through to render() fallback
          }
        }

        // Fallback to render() API
        if (m.default.render) {
          const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
          const result = await m.default.render(id, diagramText);
          wrapper.innerHTML = result.svg;
          if (result.bindFunctions) {
            result.bindFunctions(wrapper);
          }
          continue;
        }

        console.warn('mermaid: no compatible render method found');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorEl = createErrorContainer(errMsg, diagramText);
        wrapper.replaceWith(errorEl);
      }
    }
  } catch (err) {
    console.warn('Failed to load mermaid', err);
  }
}

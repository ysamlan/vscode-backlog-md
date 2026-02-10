// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mermaid mock interface matching the upstream __MERMAID_MOCK__ pattern
interface MockMermaidAPI {
  initialize: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
}

interface MockMermaidModule {
  default: MockMermaidAPI;
}

let mockMermaid: MockMermaidModule;

function installMock(overrides?: Partial<MockMermaidAPI>): void {
  mockMermaid = {
    default: {
      initialize: vi.fn(),
      run: vi.fn().mockResolvedValue(undefined),
      render: vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' }),
      ...overrides,
    },
  };
  (globalThis as Record<string, unknown>).__MERMAID_MOCK__ = mockMermaid;
}

function removeMock(): void {
  delete (globalThis as Record<string, unknown>).__MERMAID_MOCK__;
}

describe('renderMermaidIn', () => {
  beforeEach(() => {
    document.body.className = 'vscode-dark';
  });

  afterEach(() => {
    removeMock();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('does nothing when no mermaid blocks exist', async () => {
    installMock();
    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-javascript">console.log("hi")</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    // Mermaid should NOT have been loaded/initialized
    expect(mockMermaid.default.initialize).not.toHaveBeenCalled();
  });

  it('renders mermaid blocks using run() API', async () => {
    installMock({
      run: vi.fn().mockImplementation(async ({ nodes }: { nodes: HTMLElement[] }) => {
        for (const node of nodes) {
          node.innerHTML = '<svg>rendered via run</svg>';
        }
      }),
    });

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    expect(mockMermaid.default.initialize).toHaveBeenCalled();
    expect(mockMermaid.default.run).toHaveBeenCalled();
    expect(el.querySelector('.mermaid')).toBeTruthy();
    expect(el.querySelector('.mermaid')!.innerHTML).toContain('<svg>rendered via run</svg>');
  });

  it('falls back to render() when run() fails', async () => {
    installMock({
      run: vi.fn().mockRejectedValue(new Error('run not supported')),
      render: vi.fn().mockResolvedValue({ svg: '<svg>rendered via render</svg>' }),
    });

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    expect(mockMermaid.default.render).toHaveBeenCalled();
    const mermaidEl = el.querySelector('.mermaid');
    expect(mermaidEl).toBeTruthy();
    expect(mermaidEl!.innerHTML).toContain('<svg>rendered via render</svg>');
  });

  it('shows error container when rendering fails', async () => {
    installMock({
      run: vi.fn().mockRejectedValue(new Error('run failed')),
      render: vi.fn().mockRejectedValue(new Error('parse error: invalid syntax')),
    });

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">invalid mermaid</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    const errorEl = el.querySelector('.mermaid-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl!.querySelector('.mermaid-error-title')!.textContent).toBe('Diagram Error');
    expect(errorEl!.querySelector('.mermaid-error-message')!.textContent).toContain(
      'parse error: invalid syntax'
    );
  });

  it('detects dark theme from vscode-dark body class', async () => {
    document.body.className = 'vscode-dark';
    installMock();

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    expect(mockMermaid.default.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' })
    );
  });

  it('detects light theme from vscode-light body class', async () => {
    document.body.className = 'vscode-light';
    installMock();

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    expect(mockMermaid.default.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'default' })
    );
  });

  it('detects dark theme from vscode-high-contrast body class', async () => {
    document.body.className = 'vscode-high-contrast';
    installMock();

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    expect(mockMermaid.default.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' })
    );
  });

  it('initializes with securityLevel strict', async () => {
    installMock();

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD\n  A-->B</code></pre>';
    document.body.appendChild(el);

    const { renderMermaidIn } = await import('../../webview/lib/mermaid.js');
    await renderMermaidIn(el);

    expect(mockMermaid.default.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
      })
    );
  });
});

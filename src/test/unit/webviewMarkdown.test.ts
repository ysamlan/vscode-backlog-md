import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { createMarkdownRenderer } from '../../providers/webviewMarkdown';
import { workspace as mockWorkspace } from '../mocks/vscode';
import { ContentDetailProvider } from '../../providers/ContentDetailProvider';
import { BacklogParser } from '../../core/BacklogParser';

describe('webview Markdown images', () => {
  const extensionUri = vscode.Uri.file('/extension');
  let webview: vscode.Webview;

  beforeEach(() => {
    mockWorkspace.workspaceFolders = [
      { uri: vscode.Uri.file('/repo'), name: 'repo' },
      { uri: vscode.Uri.file('/other'), name: 'other' },
    ];
    webview = {
      html: '',
      cspSource: 'test-csp',
      options: { enableScripts: true },
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(),
      asWebviewUri: vi.fn((uri: vscode.Uri) => ({
        toString: () => `https://webview.test${encodeURI(uri.fsPath)}`,
      })),
    } as unknown as vscode.Webview;
  });

  afterEach(() => {
    mockWorkspace.workspaceFolders = undefined;
    ContentDetailProvider['currentPanel'] = undefined;
    vi.restoreAllMocks();
  });

  it('resolves the reported task-relative path and permits workspace resources', async () => {
    const render = createMarkdownRenderer(webview, extensionUri, '/repo/backlog/tasks/task-9.md');
    const html = await render('![Mockup](../assets/TASK-9-assistant-mockup.png)');
    expect(html).toContain(
      'src="https://webview.test/repo/backlog/assets/TASK-9-assistant-mockup.png"'
    );
    expect(webview.options).toEqual({
      enableScripts: true,
      localResourceRoots: [extensionUri, vscode.Uri.file('/repo'), vscode.Uri.file('/other')],
    });
  });

  it('handles encoded filenames, file URIs, absolute paths and SVG fragments', async () => {
    const render = createMarkdownRenderer(webview, extensionUri, '/repo/backlog/tasks/task.md');
    for (const src of [
      '../assets/a%20b.svg#diagram',
      'file:///repo/backlog/assets/a%20b.svg#diagram',
      '/repo/backlog/assets/a%20b.svg#diagram',
    ]) {
      expect(await render(`![image](${src})`)).toContain(
        'src="https://webview.test/repo/backlog/assets/a%20b.svg#diagram"'
      );
    }
  });

  it('preserves remote and data images', async () => {
    const render = createMarkdownRenderer(webview, extensionUri, '/repo/backlog/tasks/task.md');
    for (const src of ['https://example.com/image.png', 'data:image/png;base64,AAAA']) {
      expect(await render(`![image](${src})`)).toContain(`src="${src}"`);
    }
    expect(await render('![image](//example.com/image.png)')).toContain(
      'src="https://example.com/image.png"'
    );
    expect(webview.asWebviewUri).not.toHaveBeenCalled();
  });

  it('uses the new source directory when switching tasks', async () => {
    const first = createMarkdownRenderer(webview, extensionUri, '/repo/backlog/tasks/task.md');
    const second = createMarkdownRenderer(webview, extensionUri, '/other/backlog/drafts/draft.md');
    expect(await first('![image](../assets/image.png)')).toContain(
      '/repo/backlog/assets/image.png'
    );
    expect(await second('![image](../assets/image.png)')).toContain(
      '/other/backlog/assets/image.png'
    );
  });

  it('does not grant filesystem access outside open workspaces', async () => {
    mockWorkspace.workspaceFolders = undefined;
    const render = createMarkdownRenderer(webview, extensionUri, '/repo/backlog/tasks/task.md');
    await render('![image](../../../../outside.png)');
    expect(webview.options.localResourceRoots).toEqual([extensionUri]);
  });

  it('reports malformed image paths without breaking the remaining Markdown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const render = createMarkdownRenderer(webview, extensionUri, '/repo/backlog/tasks/task.md');
    expect(await render('![image](bad%XX.png)\n\n**text**')).toContain('<strong>text</strong>');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid Markdown image path'),
      expect.any(URIError)
    );
  });

  it('resolves images in documents and every decision section', async () => {
    const parser = new BacklogParser('/repo/backlog');
    const image = '![Diagram](../assets/diagram.png)';
    vi.spyOn(parser, 'getDocument').mockResolvedValue({
      id: 'doc-1',
      title: 'Document',
      tags: [],
      content: image,
      filePath: '/repo/backlog/docs/doc-1.md',
    });
    vi.spyOn(parser, 'getDecision').mockResolvedValue({
      id: 'decision-1',
      title: 'Decision',
      status: 'accepted',
      context: image,
      decision: image,
      consequences: image,
      alternatives: image,
      filePath: '/repo/backlog/decisions/decision-1.md',
    });
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue({
      webview,
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    } as unknown as vscode.WebviewPanel);
    const provider = new ContentDetailProvider(extensionUri, parser);
    await provider.openDocument('doc-1');
    await provider.openDecision('decision-1');
    const expectedImage = expect.stringContaining(
      'src="https://webview.test/repo/backlog/assets/diagram.png"'
    );
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'documentData',
        contentHtml: expectedImage,
      })
    );
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'decisionData',
        sections: {
          context: expectedImage,
          decision: expectedImage,
          consequences: expectedImage,
          alternatives: expectedImage,
        },
      })
    );
    expect(webview.html).toContain('img-src test-csp https: data:;');
    expect(webview.html).toContain("default-src 'none';");
  });
});

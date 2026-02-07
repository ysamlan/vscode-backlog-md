import * as vscode from 'vscode';
import { BacklogParser } from '../core/BacklogParser';

// Dynamic import for marked (ESM module)
let markedParse: ((markdown: string) => string | Promise<string>) | null = null;
async function parseMarkdown(markdown: string): Promise<string> {
  if (!markedParse) {
    const { marked } = await import('marked');
    marked.setOptions({ gfm: true, breaks: true });
    markedParse = marked.parse;
  }
  const result = markedParse(markdown);
  return typeof result === 'string' ? result : await result;
}

/**
 * Provides a webview panel for displaying read-only document and decision details.
 *
 * Follows the TaskDetailProvider pattern:
 * - Static panel instance (reused for sequential opens)
 * - Loads compiled Svelte bundle (content-detail.js)
 * - Data sent via postMessage
 * - Only handles "openFile" message (read-only view)
 */
export class ContentDetailProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentEntityId: string | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly parser: BacklogParser | undefined
  ) {}

  /**
   * Open or update the panel to show a document
   */
  async openDocument(docId: string): Promise<void> {
    if (!this.parser) {
      vscode.window.showErrorMessage('No backlog folder found');
      return;
    }

    const doc = await this.parser.getDocument(docId);
    if (!doc) {
      vscode.window.showErrorMessage(`Document ${docId} not found`);
      return;
    }

    const panel = this.ensurePanel(`${doc.id}: ${doc.title}`);
    ContentDetailProvider.currentEntityId = docId;

    const contentHtml = doc.content ? await parseMarkdown(doc.content) : '';
    panel.webview.postMessage({ type: 'documentData', document: doc, contentHtml });
  }

  /**
   * Open or update the panel to show a decision
   */
  async openDecision(decisionId: string): Promise<void> {
    if (!this.parser) {
      vscode.window.showErrorMessage('No backlog folder found');
      return;
    }

    const decision = await this.parser.getDecision(decisionId);
    if (!decision) {
      vscode.window.showErrorMessage(`Decision ${decisionId} not found`);
      return;
    }

    const panel = this.ensurePanel(`${decision.id}: ${decision.title}`);
    ContentDetailProvider.currentEntityId = decisionId;

    // Render each section to HTML
    const sections: Record<string, string> = {};
    if (decision.context) sections.context = await parseMarkdown(decision.context);
    if (decision.decision) sections.decision = await parseMarkdown(decision.decision);
    if (decision.consequences) sections.consequences = await parseMarkdown(decision.consequences);
    if (decision.alternatives) sections.alternatives = await parseMarkdown(decision.alternatives);

    panel.webview.postMessage({ type: 'decisionData', decision, sections });
  }

  /**
   * Ensure panel exists and return it. Creates if needed, reveals if existing.
   */
  private ensurePanel(title: string): vscode.WebviewPanel {
    const column = vscode.ViewColumn.One;

    if (ContentDetailProvider.currentPanel) {
      ContentDetailProvider.currentPanel.reveal(column);
      ContentDetailProvider.currentPanel.title = title;
      return ContentDetailProvider.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel('backlog.contentDetail', title, column, {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
      retainContextWhenHidden: true,
    });

    ContentDetailProvider.currentPanel = panel;
    panel.webview.html = this.getHtmlContent(panel.webview);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'openFile' && message.filePath) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.filePath));
      }
    });

    panel.onDidDispose(() => {
      ContentDetailProvider.currentPanel = undefined;
      ContentDetailProvider.currentEntityId = undefined;
    });

    return panel;
  }

  /**
   * Get URI for a resource file
   */
  private getResourceUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', ...pathSegments)
    );
  }

  /**
   * Generate HTML content for the webview
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const styleUri = this.getResourceUri(webview, 'styles.css');
    const scriptUri = this.getResourceUri(webview, 'content-detail.js');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>Content Detail</title>
</head>
<body class="content-detail-page">
    <div id="app"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

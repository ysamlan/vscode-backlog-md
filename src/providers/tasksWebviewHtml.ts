import * as vscode from 'vscode';

/**
 * Build the HTML for the Tasks (Kanban/List) webview.
 *
 * Shared by every host of the Tasks board — the sidebar `WebviewView`
 * (`TasksViewProvider`) and the editor-tab `WebviewPanel` (`TasksPanelProvider`).
 * Both load the same compiled Svelte bundle (`dist/webview/tasks.js`) and mount
 * it into `#app`, so the markup is identical regardless of host.
 */
export function getTasksWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options?: { extraBodyClass?: string }
): string {
  const resourceUri = (file: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', file));

  const styleUri = resourceUri('styles.css');
  const componentStyleUri = resourceUri('tasks.css');
  const scriptUri = resourceUri('tasks.js');

  // The sidebar host stays `tasks-page`; the editor-tab host adds an exclusive
  // marker so tooling (e.g. CDP tests) can distinguish the two identical boards.
  const bodyClass = options?.extraBodyClass ? `tasks-page ${options.extraBodyClass}` : 'tasks-page';

  // CSP allows our script and ES module imports from the same origin
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <link href="${componentStyleUri}" rel="stylesheet">
    <title>Tasks</title>
</head>
<body class="${bodyClass}">
    <div id="app"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

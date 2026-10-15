import * as vscode from 'vscode';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseMarkdown } from '../core/parseMarkdown';

export function createMarkdownRenderer(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  sourceFilePath: string
): (markdown: string) => Promise<string> {
  webview.options = {
    ...webview.options,
    localResourceRoots: [
      extensionUri,
      ...(vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri),
    ],
  };

  return (markdown) =>
    parseMarkdown(markdown, (source) => {
      if (source.startsWith('//')) return `https:${source}`;
      const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(source)?.[0].toLowerCase();
      if (scheme && scheme !== 'file:') return source;
      let imageUrl: URL;
      let filePath: string;
      try {
        imageUrl = new URL(source, pathToFileURL(sourceFilePath));
        filePath = fileURLToPath(imageUrl);
      } catch (error) {
        if (!(error instanceof TypeError || error instanceof URIError)) throw error;
        console.warn(`[Backlog.md] Invalid Markdown image path: ${source}`, error);
        return source;
      }
      const uri = vscode.Uri.file(filePath);
      return webview.asWebviewUri(uri).toString() + imageUrl.search + imageUrl.hash;
    });
}

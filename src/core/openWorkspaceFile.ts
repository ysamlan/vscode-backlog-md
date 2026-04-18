import * as vscode from 'vscode';

/**
 * Open a workspace-relative file path (optionally with a `Lstart[-Lend]` line
 * fragment) in a VS Code editor. Tries each workspace folder until the file
 * is found.
 */
export async function openWorkspaceFile(
  relativePath: string | undefined,
  fragment: string | null
): Promise<void> {
  if (!relativePath) return;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('No workspace folder is open.');
    return;
  }

  for (const folder of folders) {
    const uri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      continue;
    }
    const range = parseLineRange(fragment);
    if (range) {
      await vscode.window.showTextDocument(uri, { selection: range });
    } else {
      await vscode.commands.executeCommand('vscode.open', uri);
    }
    return;
  }

  vscode.window.showWarningMessage(`File not found in workspace: ${relativePath}`);
}

function parseLineRange(fragment: string | null): vscode.Range | undefined {
  if (!fragment) return undefined;
  const match = fragment.match(/^L(\d+)(?:-L?(\d+))?$/i);
  if (!match) return undefined;
  const start = Math.max(0, parseInt(match[1], 10) - 1);
  const end = match[2] ? Math.max(start, parseInt(match[2], 10) - 1) : start;
  return new vscode.Range(start, 0, end, 0);
}

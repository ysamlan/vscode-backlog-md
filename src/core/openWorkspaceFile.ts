import * as vscode from 'vscode';
import * as path from 'path';

interface SluggerInstance {
  slug(value: string, maintainCase?: boolean): string;
  reset(): void;
}
type SluggerModule = {
  default: new () => SluggerInstance;
  slug: (value: string, maintainCase?: boolean) => string;
};
let sluggerModule: SluggerModule | null = null;
async function loadSlugger(): Promise<SluggerModule> {
  if (!sluggerModule) {
    sluggerModule = (await import('github-slugger')) as unknown as SluggerModule;
  }
  return sluggerModule;
}

/**
 * Open a relative file path in a VS Code editor, honoring an optional
 * fragment: either a `Lstart[-Lend]` line range, or — for markdown files — a
 * GitHub-style heading slug (`#my-heading`).
 *
 * Resolution order: if `sourceFilePath` is given, the path is resolved relative
 * to that file's directory first (so `../../foo.md` in a task file lands where
 * a markdown reader would expect). Falls back to each workspace folder.
 *
 * The path is URL-decoded so links written as `task-041%20-%20foo.md` resolve
 * to the literal filename `task-041 - foo.md`. Backslash separators are
 * normalized to forward slashes so Windows-authored links work cross-platform.
 * Absolute paths and directory targets are rejected with a warning.
 */
export async function openWorkspaceFile(
  relativePath: string | undefined,
  fragment: string | null,
  sourceFilePath?: string
): Promise<void> {
  if (!relativePath) return;

  const decodedPath = safeDecode(relativePath).replace(/\\/g, '/');

  if (isAbsolutePath(decodedPath)) {
    vscode.window.showWarningMessage(
      `Refusing to open absolute path outside workspace: ${decodedPath}`
    );
    return;
  }

  const folders = vscode.workspace.workspaceFolders;

  const candidates: vscode.Uri[] = [];
  if (sourceFilePath) {
    candidates.push(vscode.Uri.file(path.resolve(path.dirname(sourceFilePath), decodedPath)));
  }
  if (folders) {
    for (const folder of folders) {
      candidates.push(vscode.Uri.joinPath(folder.uri, decodedPath));
    }
  }

  if (candidates.length === 0) {
    vscode.window.showWarningMessage('No workspace folder is open.');
    return;
  }

  for (const uri of candidates) {
    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch {
      continue;
    }
    if (stat.type === vscode.FileType.Directory) {
      vscode.window.showWarningMessage(`Link target is a directory, not a file: ${decodedPath}`);
      return;
    }
    if ((stat.type & vscode.FileType.File) === 0) {
      continue;
    }
    const range = await resolveRange(uri, decodedPath, fragment);
    if (range) {
      const editor = await vscode.window.showTextDocument(uri, { selection: range });
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } else {
      await vscode.commands.executeCommand('vscode.open', uri);
    }
    return;
  }

  vscode.window.showWarningMessage(`File not found in workspace: ${decodedPath}`);
}

function isAbsolutePath(value: string): boolean {
  // POSIX absolute, including UNC //server/share (backslashes already normalized).
  if (value.startsWith('/')) return true;
  // Windows drive letter: C:, C:/foo. Backslashes already normalized to /.
  if (/^[A-Za-z]:(\/|$)/.test(value)) return true;
  return false;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function resolveRange(
  uri: vscode.Uri,
  relativePath: string,
  fragment: string | null
): Promise<vscode.Range | undefined> {
  if (!fragment) return undefined;
  const lineRange = parseLineRange(fragment);
  if (lineRange) return lineRange;
  if (/\.(md|markdown)$/i.test(relativePath)) {
    return await findHeadingRange(uri, fragment);
  }
  return undefined;
}

function parseLineRange(fragment: string): vscode.Range | undefined {
  const match = fragment.match(/^L(\d+)(?:-L?(\d+))?$/i);
  if (!match) return undefined;
  const startLine = parseInt(match[1], 10);
  const endLine = match[2] ? parseInt(match[2], 10) : startLine;
  // L0 (and any other non-positive line) is invalid — fall back to default open.
  if (startLine <= 0 || endLine <= 0) return undefined;
  // Reversed ranges like L50-L10 are swapped rather than collapsed.
  const start = Math.min(startLine, endLine) - 1;
  const end = Math.max(startLine, endLine) - 1;
  return new vscode.Range(new vscode.Position(start, 0), new vscode.Position(end, 0));
}

async function findHeadingRange(
  uri: vscode.Uri,
  fragment: string
): Promise<vscode.Range | undefined> {
  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    content = new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
  const { default: Slugger, slug: slugOnce } = await loadSlugger();
  const target = slugOnce(decodeURIComponent(fragment));
  const lines = content.split(/\r?\n/);
  const slugger = new Slugger();
  let inFence = false;
  let fenceMarker = '';
  let inHtmlComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inHtmlComment) {
      if (line.includes('-->')) inHtmlComment = false;
      continue;
    }
    // Only treat `<!--` as a comment boundary when the line doesn't also close
    // it — otherwise single-line comments like `<!-- note -->` would be skipped
    // unnecessarily.
    const openIdx = line.indexOf('<!--');
    if (openIdx >= 0 && line.indexOf('-->', openIdx + 4) === -1) {
      inHtmlComment = true;
      continue;
    }

    const fence = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[2][0];
      } else if (fence[2][0] === fenceMarker) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    // ATX heading: up to 3 spaces of indentation, then 1–6 `#` and space.
    // 4+ leading spaces already falls out (treated as indented code block).
    const atx = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (atx) {
      if (slugger.slug(atx[1]) === target) {
        return new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0));
      }
      continue;
    }

    // Setext heading: current line is `===` (H1) or `---` (H2), previous line
    // holds the heading text. Require a non-blank, non-heading previous line.
    if (i > 0 && (/^ {0,3}=+\s*$/.test(line) || /^ {0,3}-+\s*$/.test(line))) {
      const prev = lines[i - 1];
      if (prev.trim() && !/^ {0,3}#{1,6}\s/.test(prev)) {
        const text = prev.trim();
        if (slugger.slug(text) === target) {
          return new vscode.Range(new vscode.Position(i - 1, 0), new vscode.Position(i - 1, 0));
        }
      }
    }
  }
  return undefined;
}

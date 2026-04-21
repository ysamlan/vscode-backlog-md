import * as vscode from 'vscode';
import * as path from 'path';
import { realpath } from 'node:fs/promises';

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

// Cap inbound link strings from the webview. Real paths and fragments are tiny;
// anything longer is almost certainly a malformed or adversarial message.
export const MAX_LINK_LENGTH = 4096;

// Files larger than this are opened without scanning for a heading anchor — a
// `[x](huge-file.md#anchor)` click shouldn't load hundreds of MB into memory.
const MAX_HEADING_SCAN_BYTES = 5 * 1024 * 1024;

/**
 * Type-guard for values posted over the webview→host IPC channel: a string
 * bounded by {@link MAX_LINK_LENGTH}. Providers use this before forwarding a
 * message to {@link openWorkspaceFile}.
 */
export function isValidLinkString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_LINK_LENGTH;
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
 * Absolute paths, `..`-escaped paths that resolve outside every workspace
 * folder, and directory targets are rejected with a warning.
 */
export async function openWorkspaceFile(
  relativePath: string | undefined,
  fragment: string | null,
  sourceFilePath?: string
): Promise<void> {
  if (fragment !== null && !isValidLinkString(fragment)) return;

  // Anchor-only links (`#heading`) have no path component. Resolve the fragment
  // against the source file itself so `#section` reveals the matching heading
  // in the file the link was authored in.
  if (!relativePath) {
    if (fragment && sourceFilePath) {
      await openSameFileAnchor(sourceFilePath, fragment);
    }
    return;
  }
  // Defense-in-depth: providers also validate shape at the IPC boundary, but a
  // non-string slipping through would explode on `.replace`/`decodeURIComponent`.
  if (!isValidLinkString(relativePath)) return;

  const decodedPath = safeDecode(relativePath).replace(/\\/g, '/');

  if (isAbsolutePath(decodedPath)) {
    vscode.window.showWarningMessage(
      `Refusing to open absolute path outside workspace: ${decodedPath}`
    );
    return;
  }

  const folders = vscode.workspace.workspaceFolders;

  const allCandidates: vscode.Uri[] = [];
  if (sourceFilePath) {
    allCandidates.push(vscode.Uri.file(path.resolve(path.dirname(sourceFilePath), decodedPath)));
  }
  if (folders) {
    for (const folder of folders) {
      allCandidates.push(vscode.Uri.joinPath(folder.uri, decodedPath));
    }
  }

  if (allCandidates.length === 0) {
    vscode.window.showWarningMessage('No workspace folder is open.');
    return;
  }

  // Reject candidates that resolve outside every workspace folder. `path.resolve`
  // on the source-relative candidate and `Uri.joinPath` both normalize `..`, so
  // a link like `../../../etc/passwd` from a task file can escape — this check
  // closes that gap. Without workspace folders we have nothing to bound against.
  const candidates = folders
    ? allCandidates.filter((uri) => isInsideWorkspace(uri.fsPath, folders))
    : [];

  if (candidates.length === 0) {
    vscode.window.showWarningMessage(`Refusing to open path outside workspace: ${decodedPath}`);
    return;
  }

  for (const uri of candidates) {
    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch {
      continue;
    }
    // Resolve symlinks and re-apply the workspace containment check against the
    // realpath: a symlink inside the workspace pointing outside (e.g.
    // `docs/leak.md -> /etc/passwd`) would otherwise pass every earlier check.
    const realFsPath = await safeRealpath(uri.fsPath);
    if (realFsPath && folders && !isInsideWorkspace(realFsPath, folders)) {
      vscode.window.showWarningMessage(`Refusing to open path outside workspace: ${decodedPath}`);
      return;
    }
    if (stat.type === vscode.FileType.Directory) {
      vscode.window.showWarningMessage(`Link target is a directory, not a file: ${decodedPath}`);
      return;
    }
    if ((stat.type & vscode.FileType.File) === 0) {
      continue;
    }
    const range = await resolveRange(uri, decodedPath, fragment, stat.size);
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

async function openSameFileAnchor(sourceFilePath: string, fragment: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  const uri = vscode.Uri.file(sourceFilePath);
  if (folders && !isInsideWorkspace(uri.fsPath, folders)) return;
  let stat: vscode.FileStat;
  try {
    stat = await vscode.workspace.fs.stat(uri);
  } catch {
    return;
  }
  if ((stat.type & vscode.FileType.File) === 0) return;
  const range = await resolveRange(uri, sourceFilePath, fragment, stat.size);
  if (range) {
    const editor = await vscode.window.showTextDocument(uri, { selection: range });
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } else {
    await vscode.commands.executeCommand('vscode.open', uri);
  }
}

async function safeRealpath(fsPath: string): Promise<string | undefined> {
  try {
    return await realpath(fsPath);
  } catch {
    return undefined;
  }
}

function isAbsolutePath(value: string): boolean {
  // POSIX absolute, including UNC //server/share (backslashes already normalized).
  if (value.startsWith('/')) return true;
  // Windows drive letter: C:, C:/foo. Backslashes already normalized to /.
  if (/^[A-Za-z]:(\/|$)/.test(value)) return true;
  return false;
}

function isInsideWorkspace(
  resolvedFsPath: string,
  folders: readonly vscode.WorkspaceFolder[]
): boolean {
  return folders.some((folder) => {
    const rel = path.relative(folder.uri.fsPath, resolvedFsPath);
    // Empty rel = the folder itself; `..`-prefixed or absolute = escape.
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
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
  fragment: string | null,
  fileSize: number
): Promise<vscode.Range | undefined> {
  if (!fragment) return undefined;
  const lineRange = parseLineRange(fragment);
  if (lineRange) return lineRange;
  if (/\.(md|markdown)$/i.test(relativePath)) {
    // Skip heading lookup for oversized files — fall back to a plain open so
    // a `#anchor` link can't trigger loading hundreds of MB into memory.
    if (fileSize > MAX_HEADING_SCAN_BYTES) return undefined;
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
  // A malformed `%` escape in the fragment (`#foo%ZZ`) would otherwise throw
  // out of the webview handler — treat it as a literal when decoding fails.
  const target = slugOnce(safeDecode(fragment));
  const lines = content.split(/\r?\n/);
  const slugger = new Slugger();
  // Skip a leading YAML frontmatter block: the closing `---` would otherwise
  // be matched as a setext H2 and slug the preceding YAML key as a heading.
  const startIdx = detectFrontmatterEnd(lines);
  let inFence = false;
  let fenceMarker = '';
  let inHtmlComment = false;
  for (let i = startIdx; i < lines.length; i++) {
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

    // Strip any blockquote prefix (`>`, possibly nested like `> > `) so headings
    // authored inside a blockquote are matched the same as top-level ones.
    const unquoted = stripBlockquotePrefix(line);

    // ATX heading: up to 3 spaces of indentation, then 1–6 `#` and space.
    // 4+ leading spaces already falls out (treated as indented code block).
    const atx = unquoted.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (atx) {
      if (slugger.slug(normalizeHeadingText(atx[1])) === target) {
        return new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0));
      }
      continue;
    }

    // Setext heading: current line is `===` (H1) or `---` (H2), previous line
    // holds the heading text. Require a non-blank, non-heading previous line.
    if (i > startIdx && (/^ {0,3}=+\s*$/.test(unquoted) || /^ {0,3}-+\s*$/.test(unquoted))) {
      const prev = stripBlockquotePrefix(lines[i - 1]);
      if (prev.trim() && !/^ {0,3}#{1,6}\s/.test(prev)) {
        const text = normalizeHeadingText(prev.trim());
        if (slugger.slug(text) === target) {
          return new vscode.Range(new vscode.Position(i - 1, 0), new vscode.Position(i - 1, 0));
        }
      }
    }
  }
  return undefined;
}

function detectFrontmatterEnd(lines: readonly string[]): number {
  if (lines.length === 0 || lines[0].trim() !== '---') return 0;
  for (let j = 1; j < lines.length; j++) {
    if (lines[j].trim() === '---') return j + 1;
  }
  return 0;
}

function stripBlockquotePrefix(line: string): string {
  // Up to 3 spaces of indentation followed by one or more `>` markers, each
  // optionally followed by a single space. Mirrors CommonMark's blockquote rule.
  return line.replace(/^ {0,3}(?:>\s?)+/, '');
}

function normalizeHeadingText(text: string): string {
  // GitHub strips inline markup from heading text before slugging. Approximate
  // that here so `## \`foo()\` bar` slugs to `foo-bar`, not to a mangled string
  // containing backticks. Inline images and links keep their display text.
  return (
    text
      // Images first so the alt text (not a link) survives.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // Code spans: drop the delimiters but keep the content (`foo()` → foo()).
      .replace(/`+([^`]*)`+/g, '$1')
      // Emphasis / strong / strikethrough runs — strip the markers around text.
      .replace(/(\*{1,3}|_{1,3}|~{1,2})([^\s*_~][\s\S]*?[^\s*_~]|[^\s*_~])\1/g, '$2')
  );
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { openWorkspaceFile } from '../../core/openWorkspaceFile';
import { resetAllMocks } from '../mocks/vscode';

// `showTextDocument` is not on the shared mock — install it once for this suite.
const revealRange = vi.fn();
const showTextDocument: Mock = vi.fn(() => Promise.resolve({ revealRange }));
(vscode.window as unknown as { showTextDocument: Mock }).showTextDocument = showTextDocument;

// The vscode mock has a mutable workspaceFolders, but TS types it as readonly.
const mockWorkspace = vscode.workspace as {
  workspaceFolders: vscode.WorkspaceFolder[] | undefined;
};

function setWorkspaceFolders(paths: string[]): void {
  mockWorkspace.workspaceFolders = paths.map((p) => ({
    uri: { fsPath: p } as vscode.Uri,
    name: p.split('/').pop() ?? p,
    index: 0,
  }));
}

describe('openWorkspaceFile', () => {
  beforeEach(() => {
    resetAllMocks();
    showTextDocument.mockReset();
    showTextDocument.mockImplementation(() => Promise.resolve({ revealRange }));
    revealRange.mockReset();
    mockWorkspace.workspaceFolders = undefined;
  });

  it('does nothing when relativePath is empty', async () => {
    setWorkspaceFolders(['/repo']);
    await openWorkspaceFile(undefined, null);
    await openWorkspaceFile('', null);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(showTextDocument).not.toHaveBeenCalled();
  });

  it('warns and returns when no workspace folders are open', async () => {
    await openWorkspaceFile('src/file.ts', null);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No workspace folder is open.');
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('opens the file via vscode.open when no fragment is given', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', null);

    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/repo/src/file.ts' })
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/src/file.ts' })
    );
    expect(showTextDocument).not.toHaveBeenCalled();
  });

  it('jumps to a single-line range when fragment is L42', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'L42');

    expect(showTextDocument).toHaveBeenCalledTimes(1);
    const [uriArg, optionsArg] = showTextDocument.mock.calls[0];
    expect(uriArg).toMatchObject({ fsPath: '/repo/src/file.ts' });
    expect(optionsArg.selection.start).toMatchObject({ line: 41, character: 0 });
    expect(optionsArg.selection.end).toMatchObject({ line: 41, character: 0 });
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('jumps to a multi-line range when fragment is L10-L20', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'L10-L20');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 9, character: 0 });
    expect(optionsArg.selection.end).toMatchObject({ line: 19, character: 0 });
  });

  it('reveals the range so an already-open editor scrolls to the new anchor', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'L42');

    expect(revealRange).toHaveBeenCalledTimes(1);
    const [rangeArg] = revealRange.mock.calls[0];
    expect(rangeArg.start).toMatchObject({ line: 41, character: 0 });
  });

  it('jumps to a markdown heading when the slug matches', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = [
      '# Intro',
      '',
      'Some text.',
      '',
      '## S.B. Adjustment Rationale',
      '',
      'Details.',
      '',
    ].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'sb-adjustment-rationale');

    expect(showTextDocument).toHaveBeenCalledTimes(1);
    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 4, character: 0 });
    expect(revealRange).toHaveBeenCalledTimes(1);
  });

  it('disambiguates duplicate heading slugs with a -1/-2 counter', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = ['## Notes', 'first', '', '## Notes', 'second', '', '## Notes', 'third', ''].join(
      '\n'
    );
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'notes-1');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 3, character: 0 });
  });

  it('ignores headings inside fenced code blocks', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = ['```', '# Target', '```', '', '## Target', ''].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'target');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 4, character: 0 });
  });

  it('falls back to vscode.open when the heading slug is not found', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(
      new TextEncoder().encode('# Only heading\n')
    );

    await openWorkspaceFile('docs/guide.md', 'section-heading');

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/docs/guide.md' })
    );
  });

  it('falls back to vscode.open for non-markdown files with non-line fragments', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'some-anchor');

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/src/file.ts' })
    );
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('tries each workspace folder until the file is found', async () => {
    setWorkspaceFolders(['/first', '/second']);
    (vscode.workspace.fs.stat as Mock)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', null);

    expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(2);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/second/src/file.ts' })
    );
  });

  it('warns when the file is not found in any workspace folder', async () => {
    setWorkspaceFolders(['/first', '/second']);
    (vscode.workspace.fs.stat as Mock)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'));

    await openWorkspaceFile('missing.ts', null);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'File not found in workspace: missing.ts'
    );
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('URL-decodes percent-encoded paths before resolving', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('task-041%20-%20Decide-testing.md', null);

    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/repo/task-041 - Decide-testing.md' })
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/task-041 - Decide-testing.md' })
    );
  });

  it('resolves parent-traversal paths relative to the source file directory', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile(
      '../../contributing/conventions/report-format.md',
      null,
      '/repo/backlog/tasks/task-153.md'
    );

    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(
      expect.objectContaining({
        fsPath: '/repo/contributing/conventions/report-format.md',
      })
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({
        fsPath: '/repo/contributing/conventions/report-format.md',
      })
    );
  });

  it('falls back to workspace folders when the source-relative lookup misses', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', null, '/repo/backlog/tasks/task-153.md');

    expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(2);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/src/file.ts' })
    );
  });

  it('prefers a source-relative sibling over a workspace-root file with the same name', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('task-041.md', null, '/repo/backlog/tasks/task-153.md');

    // First candidate should be resolved against the source file's directory
    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/repo/backlog/tasks/task-041.md' })
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/backlog/tasks/task-041.md' })
    );
  });

  it('rejects POSIX absolute paths with a warning instead of opening them', async () => {
    setWorkspaceFolders(['/repo']);

    await openWorkspaceFile('/etc/passwd', null);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Refusing to open absolute path outside workspace: /etc/passwd'
    );
    expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects Windows drive-letter absolute paths with a warning', async () => {
    setWorkspaceFolders(['/repo']);

    await openWorkspaceFile('C:\\Windows\\System32\\config', null);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Refusing to open absolute path')
    );
    expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('normalizes backslash separators so Windows-authored links resolve on POSIX', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('docs\\guide.md', null);

    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/repo/docs/guide.md' })
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/docs/guide.md' })
    );
  });

  it('warns instead of opening when the link target is a directory', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 2 });

    await openWorkspaceFile('docs', null);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Link target is a directory, not a file: docs'
    );
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(showTextDocument).not.toHaveBeenCalled();
  });

  it('jumps to a setext H1 heading (Title\\n=====)', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = ['Intro', '=====', '', 'Some body text.', ''].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'intro');

    expect(showTextDocument).toHaveBeenCalledTimes(1);
    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 0, character: 0 });
  });

  it('jumps to a setext H2 heading (Title\\n-----)', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = ['# Top', '', 'Section Two', '-----------', '', 'Body.', ''].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'section-two');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 2, character: 0 });
  });

  it('counts setext headings toward the duplicate-slug counter', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = ['Notes', '=====', '', '## Notes', 'body', ''].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'notes-1');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 3, character: 0 });
  });

  it('ignores heading-shaped lines inside HTML comments', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = ['<!--', '# Target', '-->', '', '## Target', 'real heading', ''].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'target');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 4, character: 0 });
  });

  it('ignores heading-shaped lines inside 4-space indented code blocks', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });
    const doc = [
      'Paragraph line.',
      '',
      '    # Not a heading',
      '    more code',
      '',
      '## Target',
      '',
    ].join('\n');
    (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(new TextEncoder().encode(doc));

    await openWorkspaceFile('docs/guide.md', 'target');

    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 5, character: 0 });
  });

  it('treats L0 as invalid and opens the file at the default position', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'L0');

    expect(showTextDocument).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/src/file.ts' })
    );
  });

  it('swaps reversed line ranges (L50-L10) into a valid range', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'L50-L10');

    expect(showTextDocument).toHaveBeenCalledTimes(1);
    const [, optionsArg] = showTextDocument.mock.calls[0];
    expect(optionsArg.selection.start).toMatchObject({ line: 9, character: 0 });
    expect(optionsArg.selection.end).toMatchObject({ line: 49, character: 0 });
  });

  it('falls back to default open for malformed line fragments like bare L', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('src/file.ts', 'L');

    expect(showTextDocument).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/src/file.ts' })
    );
  });

  it('does not decode + as space in percent-encoded paths', async () => {
    setWorkspaceFolders(['/repo']);
    (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 1 });

    await openWorkspaceFile('docs/c+%2B-notes.md', null);

    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/repo/docs/c++-notes.md' })
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      expect.objectContaining({ fsPath: '/repo/docs/c++-notes.md' })
    );
  });
});

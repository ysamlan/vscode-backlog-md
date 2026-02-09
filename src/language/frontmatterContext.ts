import * as vscode from 'vscode';

export interface FrontmatterContext {
  /** Whether the position is inside YAML frontmatter (between --- delimiters) */
  inFrontmatter: boolean;
  /** The frontmatter field name on the current line (e.g. 'status', 'priority') */
  fieldName?: string;
  /** Whether the cursor is inside an array value (inline bracket or list item) */
  isArrayItem?: boolean;
}

/**
 * Determine the frontmatter context at a given position in a document.
 * Returns whether we're in frontmatter and which field we're on.
 */
export function getFrontmatterContext(
  document: vscode.TextDocument,
  position: vscode.Position
): FrontmatterContext {
  const lineCount = document.lineCount;

  // Frontmatter must start at line 0 with ---
  if (lineCount === 0 || document.lineAt(0).text.trim() !== '---') {
    return { inFrontmatter: false };
  }

  // Find the closing --- delimiter
  let closingLine = -1;
  for (let i = 1; i < lineCount; i++) {
    if (document.lineAt(i).text.trim() === '---') {
      closingLine = i;
      break;
    }
  }

  // No closing delimiter found, or position is outside frontmatter range
  if (closingLine === -1 || position.line <= 0 || position.line >= closingLine) {
    return { inFrontmatter: false };
  }

  // We're inside frontmatter — determine the field
  const currentLineText = document.lineAt(position.line).text;

  // Check if this line is a YAML key: value line
  const fieldMatch = currentLineText.match(/^(\w[\w_]*):\s*(.*)/);
  if (fieldMatch) {
    const fieldName = fieldMatch[1];
    const valueStr = fieldMatch[2] || '';
    const isArrayItem = valueStr.trimStart().startsWith('[');
    return { inFrontmatter: true, fieldName, isArrayItem };
  }

  // Check if this is a YAML list item (e.g., "  - value") belonging to a parent field
  const listItemMatch = currentLineText.match(/^\s+-\s*/);
  if (listItemMatch) {
    // Walk backwards to find the parent field
    for (let i = position.line - 1; i > 0; i--) {
      const prevLine = document.lineAt(i).text;
      const parentMatch = prevLine.match(/^(\w[\w_]*):\s*/);
      if (parentMatch) {
        return { inFrontmatter: true, fieldName: parentMatch[1], isArrayItem: true };
      }
      // If we hit a non-indented, non-list line that isn't a field, stop
      if (!prevLine.match(/^\s+-/) && !prevLine.match(/^\s*$/)) {
        break;
      }
    }
    return { inFrontmatter: true, isArrayItem: true };
  }

  return { inFrontmatter: true };
}

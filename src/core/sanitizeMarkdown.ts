/**
 * Sanitize markdown source to prevent angle-bracket type strings like
 * `Result<List<MenuItem>>` from being interpreted as HTML tags.
 *
 * Ported from upstream MermaidMarkdown.tsx (commit 906b1ba).
 *
 * Logic: escape `<` followed by an alpha character, UNLESS the sequence
 * matches a valid CommonMark URI autolink or email autolink.
 *
 * Fenced code blocks (``` or ~~~) are passed through unchanged so that
 * content like mermaid diagrams with generic types (e.g. `A<String>`)
 * is not corrupted.
 */

// Match CommonMark URI autolinks: <scheme:...> excluding <, >, and control/space chars
// Build dynamically to avoid ESLint no-control-regex on the \x00-\x20 range
const URI_AUTOLINK_PREFIX_REGEX = new RegExp(
  '^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>' +
    String.fromCharCode(0) +
    '-' +
    String.fromCharCode(0x20) +
    ']*>'
);
const EMAIL_AUTOLINK_PREFIX_REGEX =
  /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;

/**
 * Sanitize a single segment of text that is NOT inside a fenced code block.
 */
function sanitizeSegment(segment: string): string {
  return segment.replace(/<(?=[A-Za-z])/g, (match, offset, fullText) => {
    const remaining = fullText.slice(offset);
    if (URI_AUTOLINK_PREFIX_REGEX.test(remaining) || EMAIL_AUTOLINK_PREFIX_REGEX.test(remaining)) {
      return match;
    }
    return '&lt;';
  });
}

// Matches fenced code block boundaries: ``` or ~~~ (with optional language tag on the opening fence)
const FENCED_BLOCK_REGEX = /^(`{3,}|~{3,})/gm;

export function sanitizeMarkdownSource(source: string): string {
  const fencePositions: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;

  // Find all fence boundary positions
  const fences: { index: number; marker: string }[] = [];
  while ((match = FENCED_BLOCK_REGEX.exec(source)) !== null) {
    fences.push({ index: match.index, marker: match[1] });
  }

  // Pair up opening/closing fences
  let i = 0;
  while (i < fences.length) {
    const openFence = fences[i];
    // Find matching closing fence (same marker character, at least as many chars)
    const openChar = openFence.marker[0];
    const openLen = openFence.marker.length;
    let closed = false;

    for (let j = i + 1; j < fences.length; j++) {
      const candidate = fences[j];
      if (candidate.marker[0] === openChar && candidate.marker.length >= openLen) {
        // Find the end of the closing fence line
        const lineEnd = source.indexOf('\n', candidate.index);
        const blockEnd = lineEnd === -1 ? source.length : lineEnd + 1;
        fencePositions.push({ start: openFence.index, end: blockEnd });
        i = j + 1;
        closed = true;
        break;
      }
    }
    if (!closed) {
      i++;
    }
  }

  // If no fenced blocks, fast path
  if (fencePositions.length === 0) {
    return sanitizeSegment(source);
  }

  // Build result by sanitizing only the non-fenced segments
  let result = '';
  let cursor = 0;
  for (const block of fencePositions) {
    // Sanitize text before this fenced block
    result += sanitizeSegment(source.slice(cursor, block.start));
    // Pass fenced block through unchanged
    result += source.slice(block.start, block.end);
    cursor = block.end;
  }
  // Sanitize any remaining text after the last fenced block
  result += sanitizeSegment(source.slice(cursor));
  return result;
}

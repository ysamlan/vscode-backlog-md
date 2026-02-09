/**
 * Sanitize markdown source to prevent angle-bracket type strings like
 * `Result<List<MenuItem>>` from being interpreted as HTML tags.
 *
 * Ported from upstream MermaidMarkdown.tsx (commit 906b1ba).
 *
 * Logic: escape `<` followed by an alpha character, UNLESS the sequence
 * matches a valid CommonMark URI autolink or email autolink.
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

export function sanitizeMarkdownSource(source: string): string {
  return source.replace(/<(?=[A-Za-z])/g, (match, offset, fullText) => {
    const remaining = fullText.slice(offset);
    if (URI_AUTOLINK_PREFIX_REGEX.test(remaining) || EMAIL_AUTOLINK_PREFIX_REGEX.test(remaining)) {
      return match;
    }
    return '&lt;';
  });
}

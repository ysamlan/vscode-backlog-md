import { describe, it, expect } from 'vitest';
import { sanitizeMarkdownSource } from '../../core/sanitizeMarkdown';

describe('sanitizeMarkdownSource', () => {
  it('escapes angle-bracket type strings like Result<List<MenuItem>>', () => {
    const input = 'Returns `Result<List<MenuItem>>` from the API.';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe('Returns `Result&lt;List&lt;MenuItem>>` from the API.');
  });

  it('escapes simple generic like List<String>', () => {
    const input = 'Use List<String> for collections.';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe('Use List&lt;String> for collections.');
  });

  it('leaves normal markdown unchanged', () => {
    const input = '**bold** and *italic* and [link](url)';
    expect(sanitizeMarkdownSource(input)).toBe(input);
  });

  it('leaves HTML entities unchanged', () => {
    const input = '&lt;div&gt; content';
    expect(sanitizeMarkdownSource(input)).toBe(input);
  });

  it('preserves valid URI autolinks', () => {
    const input = 'Check <https://example.com> for details.';
    expect(sanitizeMarkdownSource(input)).toBe(input);
  });

  it('preserves valid email autolinks', () => {
    const input = 'Contact <alice@example.com> for help.';
    expect(sanitizeMarkdownSource(input)).toBe(input);
  });

  it('escapes bare tags that look like HTML', () => {
    const input = '<Component> renders here.';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe('&lt;Component> renders here.');
  });

  it('does not escape < followed by non-alpha characters', () => {
    const input = 'a < b and 3 < 4';
    expect(sanitizeMarkdownSource(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(sanitizeMarkdownSource('')).toBe('');
  });

  it('handles multiple occurrences', () => {
    const input = 'Map<String, List<Integer>>';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe('Map&lt;String, List&lt;Integer>>');
  });

  it('preserves angle brackets inside fenced code blocks (backticks)', () => {
    const input = '```mermaid\ngraph TD\n  A<String> --> B\n```';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe(input);
  });

  it('preserves angle brackets inside fenced code blocks (tildes)', () => {
    const input = '~~~mermaid\ngraph TD\n  A<String> --> B\n~~~';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe(input);
  });

  it('sanitizes outside fenced blocks but preserves inside', () => {
    const input =
      'Use List<String> for collections.\n\n```mermaid\ngraph TD\n  A<String> --> B\n```\n\nAlso Map<Integer>.';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe(
      'Use List&lt;String> for collections.\n\n```mermaid\ngraph TD\n  A<String> --> B\n```\n\nAlso Map&lt;Integer>.'
    );
  });

  it('handles multiple fenced code blocks', () => {
    const input =
      '```js\nconst x = new Map<String, Int>();\n```\n\nSome <Component> text.\n\n```mermaid\nA<B> --> C\n```';
    const result = sanitizeMarkdownSource(input);
    expect(result).toContain('Map<String, Int>()'); // inside code block, preserved
    expect(result).toContain('&lt;Component>'); // outside, escaped
    expect(result).toContain('A<B> --> C'); // inside code block, preserved
  });

  it('handles unclosed fenced code block (no closing fence)', () => {
    const input = 'Before\n```mermaid\nA<String>\nNo close';
    const result = sanitizeMarkdownSource(input);
    // Unclosed block means everything after opening fence is NOT protected
    // since there's no matching closing fence — sanitize normally
    expect(result).toContain('&lt;String>');
  });

  it('handles empty fenced code block', () => {
    const input = '```\n```';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe(input);
  });

  it('handles fenced block with more backticks', () => {
    const input = '````\nA<B>\n````';
    const result = sanitizeMarkdownSource(input);
    expect(result).toBe(input);
  });
});

import { describe, it, expect } from 'vitest';
import { addLinkTitles, parseMarkdown } from '../../core/parseMarkdown';

describe('addLinkTitles', () => {
  it('adds title attribute equal to href for anchors without title', () => {
    const input = '<a href="https://example.com">example</a>';
    expect(addLinkTitles(input)).toBe(
      '<a href="https://example.com" title="https://example.com">example</a>'
    );
  });

  it('preserves existing title attribute', () => {
    const input = '<a href="https://example.com" title="Example Site">example</a>';
    expect(addLinkTitles(input)).toBe(input);
  });

  it('skips pure fragment links', () => {
    const input = '<a href="#heading">jump</a>';
    expect(addLinkTitles(input)).toBe(input);
  });

  it('skips anchors with no href', () => {
    const input = '<a>placeholder</a>';
    expect(addLinkTitles(input)).toBe(input);
  });

  it('adds title to workspace-relative links with fragment', () => {
    const input = '<a href="../docs/spec.md#L42-L51">spec</a>';
    expect(addLinkTitles(input)).toContain('title="../docs/spec.md#L42-L51"');
  });

  it('handles multiple anchors in one string', () => {
    const input = '<a href="a.md">a</a> and <a href="https://b.com">b</a>';
    const out = addLinkTitles(input);
    expect(out).toContain('<a href="a.md" title="a.md">a</a>');
    expect(out).toContain('<a href="https://b.com" title="https://b.com">b</a>');
  });
});

describe('parseMarkdown', () => {
  it('renders markdown link with title attribute set to href', async () => {
    const html = await parseMarkdown('See [the doc](../docs/spec.md) here.');
    expect(html).toContain('href="../docs/spec.md"');
    expect(html).toContain('title="../docs/spec.md"');
  });

  it('renders external link with title attribute set to full URL', async () => {
    const html = await parseMarkdown('[example](https://example.com/path?q=1)');
    expect(html).toContain('title="https://example.com/path?q=1"');
  });

  it('honors explicit markdown link title over href fallback', async () => {
    const html = await parseMarkdown('[example](https://example.com "Custom Title")');
    expect(html).toContain('title="Custom Title"');
    expect(html).not.toContain('title="https://example.com"');
  });
});

import { describe, it, expect } from 'vitest';
import { getFrontmatterContext } from '../../language/frontmatterContext';
import { createMockTextDocument, Position } from '../mocks/vscode';

describe('getFrontmatterContext', () => {
  it('returns inFrontmatter: false when document has no frontmatter', () => {
    const doc = createMockTextDocument('# Just a heading\n\nSome content');
    const result = getFrontmatterContext(doc as never, new Position(1, 0));
    expect(result.inFrontmatter).toBe(false);
  });

  it('returns inFrontmatter: false for position on opening delimiter', () => {
    const doc = createMockTextDocument('---\nstatus: To Do\n---\n\nBody');
    const result = getFrontmatterContext(doc as never, new Position(0, 0));
    expect(result.inFrontmatter).toBe(false);
  });

  it('returns inFrontmatter: false for position on closing delimiter', () => {
    const doc = createMockTextDocument('---\nstatus: To Do\n---\n\nBody');
    const result = getFrontmatterContext(doc as never, new Position(2, 0));
    expect(result.inFrontmatter).toBe(false);
  });

  it('returns inFrontmatter: false for position in body', () => {
    const doc = createMockTextDocument('---\nstatus: To Do\n---\n\nBody text');
    const result = getFrontmatterContext(doc as never, new Position(4, 0));
    expect(result.inFrontmatter).toBe(false);
  });

  it('returns inFrontmatter: true with correct fieldName for status field', () => {
    const doc = createMockTextDocument('---\nstatus: To Do\n---');
    const result = getFrontmatterContext(doc as never, new Position(1, 10));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('status');
    expect(result.isArrayItem).toBe(false);
  });

  it('returns inFrontmatter: true with correct fieldName for priority field', () => {
    const doc = createMockTextDocument('---\npriority: high\n---');
    const result = getFrontmatterContext(doc as never, new Position(1, 12));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('priority');
  });

  it('detects inline array on labels field', () => {
    const doc = createMockTextDocument('---\nlabels: [bug, feature]\n---');
    const result = getFrontmatterContext(doc as never, new Position(1, 15));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('labels');
    expect(result.isArrayItem).toBe(true);
  });

  it('detects YAML list items and finds parent field', () => {
    const doc = createMockTextDocument('---\nlabels:\n  - bug\n  - feature\n---');
    const result = getFrontmatterContext(doc as never, new Position(2, 5));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('labels');
    expect(result.isArrayItem).toBe(true);
  });

  it('detects assignee field with list items', () => {
    const doc = createMockTextDocument('---\nassignee:\n  - alice\n---');
    const result = getFrontmatterContext(doc as never, new Position(2, 6));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('assignee');
    expect(result.isArrayItem).toBe(true);
  });

  it('handles empty document', () => {
    const doc = createMockTextDocument('');
    const result = getFrontmatterContext(doc as never, new Position(0, 0));
    expect(result.inFrontmatter).toBe(false);
  });

  it('handles frontmatter without closing delimiter', () => {
    const doc = createMockTextDocument('---\nstatus: To Do\nno closing');
    const result = getFrontmatterContext(doc as never, new Position(1, 0));
    expect(result.inFrontmatter).toBe(false);
  });

  it('returns fieldName for milestone field', () => {
    const doc = createMockTextDocument('---\nmilestone: v1.0\n---');
    const result = getFrontmatterContext(doc as never, new Position(1, 15));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('milestone');
  });

  it('returns fieldName for dependencies field', () => {
    const doc = createMockTextDocument('---\ndependencies: [TASK-1, TASK-2]\n---');
    const result = getFrontmatterContext(doc as never, new Position(1, 20));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBe('dependencies');
    expect(result.isArrayItem).toBe(true);
  });

  it('returns inFrontmatter true but no fieldName for blank line in frontmatter', () => {
    const doc = createMockTextDocument('---\nstatus: To Do\n\npriority: high\n---');
    const result = getFrontmatterContext(doc as never, new Position(2, 0));
    expect(result.inFrontmatter).toBe(true);
    expect(result.fieldName).toBeUndefined();
  });
});

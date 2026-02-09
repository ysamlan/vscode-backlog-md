import { describe, expect, it } from 'vitest';
import { formatTaskIdForDisplay } from '../../webview/lib/taskIdDisplay';

describe('formatTaskIdForDisplay', () => {
  it('returns the full id in full mode', () => {
    expect(formatTaskIdForDisplay('TASK-123', 'full')).toBe('TASK-123');
  });

  it('returns numeric/suffix portion in number mode', () => {
    expect(formatTaskIdForDisplay('TASK-123', 'number')).toBe('123');
    expect(formatTaskIdForDisplay('TASK-2.1', 'number')).toBe('2.1');
    expect(formatTaskIdForDisplay('PROJ-0010', 'number')).toBe('0010');
  });

  it('returns empty string in hidden mode', () => {
    expect(formatTaskIdForDisplay('TASK-123', 'hidden')).toBe('');
  });

  it('keeps id unchanged in number mode when no dash exists', () => {
    expect(formatTaskIdForDisplay('TASK123', 'number')).toBe('TASK123');
  });
});

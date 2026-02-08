import { describe, expect, it } from 'vitest';
import { getReadOnlyTaskContext, isReadOnlyTask, type Task } from '../../core/types';

describe('task read-only helpers', () => {
  it('treats local task with branch metadata as editable', () => {
    const task = { source: 'local', branch: 'feature/current' } as Pick<Task, 'source' | 'branch'>;
    expect(isReadOnlyTask(task)).toBe(false);
  });

  it('treats local-branch tasks as read-only', () => {
    const task = { source: 'local-branch', branch: 'feature/other' } as Pick<
      Task,
      'source' | 'branch'
    >;
    expect(isReadOnlyTask(task)).toBe(true);
  });

  it('prefers branch context text when available', () => {
    const task = { source: 'local-branch', branch: 'feature/other' } as Pick<
      Task,
      'source' | 'branch'
    >;
    expect(getReadOnlyTaskContext(task)).toBe('feature/other');
  });
});

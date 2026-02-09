import type { TaskIdDisplayMode } from '../../core/types';

export function formatTaskIdForDisplay(taskId: string, mode: TaskIdDisplayMode): string {
  if (mode === 'hidden') {
    return '';
  }

  if (mode === 'full') {
    return taskId;
  }

  const dashIndex = taskId.lastIndexOf('-');
  if (dashIndex === -1) {
    return taskId;
  }

  const suffix = taskId.slice(dashIndex + 1);
  return suffix.length > 0 ? suffix : taskId;
}

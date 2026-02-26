import { exec } from 'child_process';
import * as path from 'path';

/**
 * Executes onStatusChange callbacks when a task's status changes.
 * Supports variable substitution: $TASK_ID, $OLD_STATUS, $NEW_STATUS, $TASK_TITLE.
 * Per-task callbacks override the global config callback.
 */
export class StatusCallbackRunner {
  /**
   * Run the status change callback if configured.
   * @param backlogPath - Path to the backlog directory (used as cwd)
   * @param taskOnStatusChange - Per-task onStatusChange value (overrides global)
   * @param globalOnStatusChange - Global onStatusChange from config.yml
   * @param variables - Substitution variables
   */
  static async run(
    backlogPath: string,
    taskOnStatusChange: string | undefined,
    globalOnStatusChange: string | undefined,
    variables: {
      taskId: string;
      oldStatus: string;
      newStatus: string;
      taskTitle: string;
    }
  ): Promise<void> {
    const callback = taskOnStatusChange || globalOnStatusChange;
    if (!callback) return;

    // Skip if status didn't actually change
    if (variables.oldStatus === variables.newStatus) return;

    const command = callback
      .replace(/\$TASK_ID/g, variables.taskId)
      .replace(/\$OLD_STATUS/g, variables.oldStatus)
      .replace(/\$NEW_STATUS/g, variables.newStatus)
      .replace(/\$TASK_TITLE/g, variables.taskTitle);

    const workDir = path.resolve(backlogPath, '..');

    return new Promise<void>((resolve) => {
      exec(command, { cwd: workDir, timeout: 30000 }, (error, _stdout, stderr) => {
        if (error) {
          console.error(`[Backlog.md] onStatusChange callback failed: ${error.message}`);
          if (stderr) console.error(`[Backlog.md] stderr: ${stderr}`);
        }
        // Always resolve — callback failure should not block the status update
        resolve();
      });
    });
  }
}

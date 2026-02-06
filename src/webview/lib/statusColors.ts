/**
 * Generates consistent HSL colors for custom/unknown status names.
 *
 * Known statuses (To Do, In Progress, Done, Draft) use CSS classes.
 * Unknown statuses get a deterministic color derived from a string hash.
 */

const KNOWN_STATUSES = new Set(['to do', 'todo', 'in progress', 'done', 'draft']);

/**
 * Simple string hash (djb2) mapped to a hue in [0, 360).
 */
function hashToHue(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

/**
 * Returns a CSS class suffix for the status, safe for use in class names.
 * Converts to lowercase, replaces spaces with hyphens, strips non-alphanumeric chars.
 */
export function statusToClass(status: string): string {
  return status
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Returns true if the status has a dedicated CSS class (known status).
 */
export function isKnownStatus(status: string): boolean {
  return KNOWN_STATUSES.has(status.toLowerCase());
}

/**
 * Returns an inline style string for a custom status badge background + text color.
 * Returns empty string for known statuses (they use CSS classes).
 */
export function customStatusStyle(status: string): string {
  if (isKnownStatus(status)) return '';
  const hue = hashToHue(status.toLowerCase());
  return `background-color: hsla(${hue}, 50%, 50%, 0.15); color: hsl(${hue}, 60%, 65%);`;
}

/**
 * Returns an inline style string for a custom status bar (dashboard breakdown).
 * Returns empty string for known statuses.
 */
export function customStatusBarStyle(status: string): string {
  if (isKnownStatus(status)) return '';
  const hue = hashToHue(status.toLowerCase());
  return `background: hsl(${hue}, 50%, 50%);`;
}

/**
 * Returns an inline style for a custom stat-card border.
 * Returns empty string for known statuses.
 */
export function customStatCardStyle(status: string): string {
  if (isKnownStatus(status)) return '';
  const hue = hashToHue(status.toLowerCase());
  return `border-left: 3px solid hsl(${hue}, 50%, 50%);`;
}

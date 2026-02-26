/**
 * Utility functions for calculating task ordinals during drag-and-drop reordering.
 * These are extracted for testability.
 */

export interface CardData {
  taskId: string;
  ordinal: number | undefined;
  priority?: 'high' | 'medium' | 'low';
}

export interface OrdinalUpdate {
  taskId: string;
  ordinal: number;
}

const DEFAULT_STEP = 1000;

/**
 * Check if a card has an ordinal set.
 * An ordinal is considered "set" if it's a number (including 0).
 * undefined means no ordinal.
 */
export function hasOrdinal(card: CardData): boolean {
  return card.ordinal !== undefined;
}

/**
 * Calculate ordinals for a drop operation.
 *
 * When dropping a card at a position, we need to assign ordinals to:
 * 1. The dropped card itself
 * 2. Any cards above the drop position that don't have ordinals
 *    (so they don't jump to the end on reload)
 *
 * @param existingCards - Cards already in the target column (in visual order)
 * @param droppedCard - The card being dropped
 * @param dropIndex - The index where the card will be inserted (0 = top)
 * @returns Array of ordinal updates to apply
 */
export function calculateOrdinalsForDrop(
  existingCards: CardData[],
  droppedCard: CardData,
  dropIndex: number
): OrdinalUpdate[] {
  const updates: OrdinalUpdate[] = [];

  // For same-column reorder, the dragged card may already be in existingCards.
  // Filter it out to avoid duplicates, and adjust dropIndex accordingly.
  const originalIndex = existingCards.findIndex((c) => c.taskId === droppedCard.taskId);
  const filteredCards = existingCards.filter((c) => c.taskId !== droppedCard.taskId);

  let adjustedDropIndex = dropIndex;
  if (originalIndex !== -1 && originalIndex < dropIndex) {
    adjustedDropIndex--;
  }

  // Build the new visual order with the dropped card inserted
  const newOrder: CardData[] = [...filteredCards];
  newOrder.splice(adjustedDropIndex, 0, droppedCard);

  // Find all no-ordinal cards that are at or above the drop position
  // These need ordinals so they don't jump to the end on reload
  // (since no-ordinal cards sort to the end)
  const cardsNeedingOrdinals: { card: CardData; index: number }[] = [];
  for (let i = 0; i <= adjustedDropIndex; i++) {
    const card = newOrder[i];
    if (!hasOrdinal(card) || card.taskId === droppedCard.taskId) {
      cardsNeedingOrdinals.push({ card, index: i });
    }
  }

  // Calculate ordinals for cards that need them
  if (cardsNeedingOrdinals.length > 0) {
    const firstNeedingIndex = cardsNeedingOrdinals[0].index;

    // Find the ordinal of the card just before the first one needing ordinal
    let baseOrdinal = 0;
    if (firstNeedingIndex > 0) {
      const prevCard = newOrder[firstNeedingIndex - 1];
      if (hasOrdinal(prevCard)) {
        baseOrdinal = prevCard.ordinal!;
      }
    }

    // Find the ordinal of the first card after our group that has an ordinal
    // (to ensure we don't create conflicts)
    let ceilingOrdinal = Infinity;
    for (let i = adjustedDropIndex + 1; i < newOrder.length; i++) {
      const card = newOrder[i];
      if (hasOrdinal(card)) {
        ceilingOrdinal = card.ordinal!;
        break;
      }
    }

    // Calculate step size to fit all cards needing ordinals between base and ceiling
    const count = cardsNeedingOrdinals.length;
    let step = DEFAULT_STEP;
    if (ceilingOrdinal !== Infinity) {
      const availableRange = ceilingOrdinal - baseOrdinal;
      step = Math.min(DEFAULT_STEP, availableRange / (count + 1));
    }

    // Assign ordinals
    cardsNeedingOrdinals.forEach((item, i) => {
      const newOrdinal = baseOrdinal + step * (i + 1);
      updates.push({
        taskId: item.card.taskId,
        ordinal: newOrdinal,
      });
    });
  }

  return updates;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const NO_PRIORITY = 3;

/**
 * Compare two cards by ordinal (matching upstream Backlog.md behavior):
 * - Cards WITH ordinal come first, sorted by ordinal ascending
 * - Cards WITHOUT ordinal come last
 * - When ordinals are equal (or both undefined), use priority as tiebreaker:
 *   high (0) > medium (1) > low (2) > none/undefined (3)
 * - Final tiebreaker is ID comparison
 *
 * Usable as a standalone comparator (e.g. as a tiebreaker in list view sorting).
 */
export function compareByOrdinal(a: CardData, b: CardData): number {
  if (hasOrdinal(a) && !hasOrdinal(b)) return -1;
  if (!hasOrdinal(a) && hasOrdinal(b)) return 1;
  if (hasOrdinal(a) && hasOrdinal(b)) {
    const ordDiff = a.ordinal! - b.ordinal!;
    if (ordDiff !== 0) return ordDiff;
  }
  // Ordinals are equal or both undefined — use priority tiebreaker
  const aPri = a.priority ? (PRIORITY_ORDER[a.priority] ?? NO_PRIORITY) : NO_PRIORITY;
  const bPri = b.priority ? (PRIORITY_ORDER[b.priority] ?? NO_PRIORITY) : NO_PRIORITY;
  if (aPri !== bPri) return aPri - bPri;
  return a.taskId.localeCompare(b.taskId);
}

/**
 * Sort cards by ordinal (matching upstream Backlog.md behavior):
 * - Cards WITH ordinal come first, sorted by ordinal ascending
 * - Cards WITHOUT ordinal come last, sorted by ID
 */
export function sortCardsByOrdinal(cards: CardData[]): CardData[] {
  return [...cards].sort(compareByOrdinal);
}

export interface ResolveOrdinalConflictsOptions {
  defaultStep?: number;
  startOrdinal?: number;
  forceSequential?: boolean;
}

/**
 * Resolve ordinal conflicts by reassigning ordinals where needed.
 * Returns only the items whose ordinals changed.
 *
 * Matches upstream Backlog.md resolveOrdinalConflicts behavior:
 * - Items with undefined ordinals get assigned
 * - Duplicate/non-increasing ordinals get bumped
 * - forceSequential mode reassigns all to even spacing
 */
export function resolveOrdinalConflicts<T extends { id: string; ordinal?: number }>(
  tasks: T[],
  options: ResolveOrdinalConflictsOptions = {}
): T[] {
  const defaultStep = options.defaultStep ?? DEFAULT_STEP;
  const startOrdinal = options.startOrdinal ?? defaultStep;
  const forceSequential = options.forceSequential ?? false;

  const updates: T[] = [];
  let lastOrdinal: number | undefined;

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (!task) continue;

    let assigned: number;

    if (forceSequential) {
      assigned = index === 0 ? startOrdinal : (lastOrdinal ?? startOrdinal) + defaultStep;
    } else if (task.ordinal === undefined) {
      assigned = index === 0 ? startOrdinal : (lastOrdinal ?? startOrdinal) + defaultStep;
    } else if (lastOrdinal !== undefined && task.ordinal <= lastOrdinal) {
      assigned = lastOrdinal + defaultStep;
    } else {
      assigned = task.ordinal;
    }

    if (assigned !== task.ordinal) {
      updates.push({ ...task, ordinal: assigned });
    }

    lastOrdinal = assigned;
  }

  return updates;
}

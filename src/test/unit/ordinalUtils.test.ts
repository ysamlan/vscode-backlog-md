import { describe, it, expect } from 'vitest';
import {
  hasOrdinal,
  compareByOrdinal,
  calculateOrdinalsForDrop,
  sortCardsByOrdinal,
  CardData,
} from '../../core/ordinalUtils';

describe('ordinalUtils', () => {
  describe('hasOrdinal', () => {
    it('should return true for cards with numeric ordinals', () => {
      expect(hasOrdinal({ taskId: 'A', ordinal: 1000 })).toBe(true);
      expect(hasOrdinal({ taskId: 'A', ordinal: 0 })).toBe(true);
      expect(hasOrdinal({ taskId: 'A', ordinal: -100 })).toBe(true);
    });

    it('should return false for cards without ordinals', () => {
      expect(hasOrdinal({ taskId: 'A', ordinal: undefined })).toBe(false);
    });
  });

  describe('compareByOrdinal', () => {
    it('should rank ordinal cards before no-ordinal cards', () => {
      const a: CardData = { taskId: 'A', ordinal: 1000 };
      const b: CardData = { taskId: 'B', ordinal: undefined };
      expect(compareByOrdinal(a, b)).toBeLessThan(0);
      expect(compareByOrdinal(b, a)).toBeGreaterThan(0);
    });

    it('should sort by ordinal value when both have ordinals', () => {
      const a: CardData = { taskId: 'A', ordinal: 2000 };
      const b: CardData = { taskId: 'B', ordinal: 1000 };
      expect(compareByOrdinal(a, b)).toBeGreaterThan(0);
      expect(compareByOrdinal(b, a)).toBeLessThan(0);
    });

    it('should sort by taskId when neither has ordinal', () => {
      const a: CardData = { taskId: 'TASK-1', ordinal: undefined };
      const b: CardData = { taskId: 'TASK-2', ordinal: undefined };
      expect(compareByOrdinal(a, b)).toBeLessThan(0);
      expect(compareByOrdinal(b, a)).toBeGreaterThan(0);
    });

    it('should return 0 for equal ordinals and same taskId', () => {
      const a: CardData = { taskId: 'A', ordinal: 1000 };
      const b: CardData = { taskId: 'A', ordinal: 1000 };
      expect(compareByOrdinal(a, b)).toBe(0);
    });
  });

  describe('sortCardsByOrdinal', () => {
    it('should sort ordinal cards before no-ordinal cards', () => {
      const cards: CardData[] = [
        { taskId: 'A', ordinal: undefined },
        { taskId: 'B', ordinal: 1000 },
        { taskId: 'C', ordinal: undefined },
      ];

      const sorted = sortCardsByOrdinal(cards);

      expect(sorted[0].taskId).toBe('B'); // Has ordinal
      expect(sorted[1].taskId).toBe('A'); // No ordinal, sorted by ID
      expect(sorted[2].taskId).toBe('C'); // No ordinal, sorted by ID
    });

    it('should sort ordinal cards by ordinal value', () => {
      const cards: CardData[] = [
        { taskId: 'A', ordinal: 3000 },
        { taskId: 'B', ordinal: 1000 },
        { taskId: 'C', ordinal: 2000 },
      ];

      const sorted = sortCardsByOrdinal(cards);

      expect(sorted[0].taskId).toBe('B'); // 1000
      expect(sorted[1].taskId).toBe('C'); // 2000
      expect(sorted[2].taskId).toBe('A'); // 3000
    });

    it('should sort no-ordinal cards by taskId', () => {
      const cards: CardData[] = [
        { taskId: 'C', ordinal: undefined },
        { taskId: 'A', ordinal: undefined },
        { taskId: 'B', ordinal: undefined },
      ];

      const sorted = sortCardsByOrdinal(cards);

      expect(sorted[0].taskId).toBe('A');
      expect(sorted[1].taskId).toBe('B');
      expect(sorted[2].taskId).toBe('C');
    });
  });

  describe('calculateOrdinalsForDrop', () => {
    describe('dropping card with ordinal among no-ordinal cards', () => {
      it('should assign ordinals to no-ordinal cards above drop position', () => {
        // Scenario: [A(1000)], [B, C, D, E, F, G (no ordinal)]
        // User drags A between D and E
        // Expected: B, C, D get ordinals, then A gets ordinal
        const existingCards: CardData[] = [
          { taskId: 'B', ordinal: undefined },
          { taskId: 'C', ordinal: undefined },
          { taskId: 'D', ordinal: undefined },
          { taskId: 'E', ordinal: undefined },
          { taskId: 'F', ordinal: undefined },
          { taskId: 'G', ordinal: undefined },
        ];
        const droppedCard: CardData = { taskId: 'A', ordinal: 1000 };
        const dropIndex = 3; // After D, before E

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        // Should have updates for B, C, D, and A
        expect(updates.length).toBe(4);

        const bUpdate = updates.find((u) => u.taskId === 'B');
        const cUpdate = updates.find((u) => u.taskId === 'C');
        const dUpdate = updates.find((u) => u.taskId === 'D');
        const aUpdate = updates.find((u) => u.taskId === 'A');

        expect(bUpdate).toBeDefined();
        expect(cUpdate).toBeDefined();
        expect(dUpdate).toBeDefined();
        expect(aUpdate).toBeDefined();

        // Ordinals should be in order: B < C < D < A
        expect(bUpdate!.ordinal).toBeLessThan(cUpdate!.ordinal);
        expect(cUpdate!.ordinal).toBeLessThan(dUpdate!.ordinal);
        expect(dUpdate!.ordinal).toBeLessThan(aUpdate!.ordinal);
      });
    });

    describe('dropping no-ordinal card to column with ordinal cards', () => {
      it('should calculate ordinal between existing ordinal cards', () => {
        // Scenario: In Progress has [Task4(500), Task5(1500)]
        // Drag Task2 (no ordinal) between them
        const existingCards: CardData[] = [
          { taskId: 'TASK-4', ordinal: 500 },
          { taskId: 'TASK-5', ordinal: 1500 },
        ];
        const droppedCard: CardData = { taskId: 'TASK-2', ordinal: undefined };
        const dropIndex = 1; // Between TASK-4 and TASK-5

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        expect(updates.length).toBe(1);
        expect(updates[0].taskId).toBe('TASK-2');
        expect(updates[0].ordinal).toBeGreaterThan(500);
        expect(updates[0].ordinal).toBeLessThan(1500);
      });

      it('should calculate ordinal after last card', () => {
        // Drag to end of column
        const existingCards: CardData[] = [
          { taskId: 'TASK-4', ordinal: 500 },
          { taskId: 'TASK-5', ordinal: 1500 },
        ];
        const droppedCard: CardData = { taskId: 'TASK-2', ordinal: undefined };
        const dropIndex = 2; // After all cards

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        expect(updates.length).toBe(1);
        expect(updates[0].taskId).toBe('TASK-2');
        expect(updates[0].ordinal).toBeGreaterThan(1500);
      });
    });

    describe('dropping ordinal card below no-ordinal cards in another column', () => {
      it('should assign ordinals to all no-ordinal cards above drop position', () => {
        // Scenario: Done column has [Task6 (no ord), Task7 (no ord)]
        // Drag Task4 (ordinal=500) to end of Done column
        const existingCards: CardData[] = [
          { taskId: 'TASK-6', ordinal: undefined },
          { taskId: 'TASK-7', ordinal: undefined },
        ];
        const droppedCard: CardData = { taskId: 'TASK-4', ordinal: 500 };
        const dropIndex = 2; // After all cards

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        // All three cards need ordinals
        expect(updates.length).toBe(3);

        const task6Update = updates.find((u) => u.taskId === 'TASK-6');
        const task7Update = updates.find((u) => u.taskId === 'TASK-7');
        const task4Update = updates.find((u) => u.taskId === 'TASK-4');

        expect(task6Update).toBeDefined();
        expect(task7Update).toBeDefined();
        expect(task4Update).toBeDefined();

        // Order should be: TASK-6 < TASK-7 < TASK-4
        expect(task6Update!.ordinal).toBeLessThan(task7Update!.ordinal);
        expect(task7Update!.ordinal).toBeLessThan(task4Update!.ordinal);
      });

      it('should handle dropping between no-ordinal cards', () => {
        // Drag Task4 between Task6 and Task7
        const existingCards: CardData[] = [
          { taskId: 'TASK-6', ordinal: undefined },
          { taskId: 'TASK-7', ordinal: undefined },
        ];
        const droppedCard: CardData = { taskId: 'TASK-4', ordinal: 500 };
        const dropIndex = 1; // Between TASK-6 and TASK-7

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        // TASK-6 and TASK-4 need ordinals (TASK-7 is below drop position)
        expect(updates.length).toBe(2);

        const task6Update = updates.find((u) => u.taskId === 'TASK-6');
        const task4Update = updates.find((u) => u.taskId === 'TASK-4');

        expect(task6Update).toBeDefined();
        expect(task4Update).toBeDefined();

        // TASK-6 < TASK-4
        expect(task6Update!.ordinal).toBeLessThan(task4Update!.ordinal);
      });
    });

    describe('dropping to empty column', () => {
      it('should assign ordinal to dropped card only', () => {
        const existingCards: CardData[] = [];
        const droppedCard: CardData = { taskId: 'TASK-1', ordinal: undefined };
        const dropIndex = 0;

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        expect(updates.length).toBe(1);
        expect(updates[0].taskId).toBe('TASK-1');
        expect(updates[0].ordinal).toBe(1000); // DEFAULT_STEP
      });
    });

    describe('same column reorder - all cards have ordinals', () => {
      it('should only update the dropped card', () => {
        const existingCards: CardData[] = [
          { taskId: 'A', ordinal: 1000 },
          { taskId: 'B', ordinal: 2000 },
          { taskId: 'C', ordinal: 3000 },
        ];
        const droppedCard: CardData = { taskId: 'A', ordinal: 1000 };
        const dropIndex = 2; // Move A between B and C

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        // Only A needs update
        expect(updates.length).toBe(1);
        expect(updates[0].taskId).toBe('A');
        expect(updates[0].ordinal).toBeGreaterThan(2000);
        expect(updates[0].ordinal).toBeLessThan(3000);
      });
    });

    describe('ordinal precision and spacing', () => {
      it('should use default step of 1000 when no ceiling', () => {
        const existingCards: CardData[] = [{ taskId: 'A', ordinal: 1000 }];
        const droppedCard: CardData = { taskId: 'B', ordinal: undefined };
        const dropIndex = 1;

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        expect(updates[0].ordinal).toBe(2000); // baseOrdinal(1000) + step(1000)
      });

      it('should reduce step when there is a ceiling', () => {
        const existingCards: CardData[] = [
          { taskId: 'A', ordinal: 1000 },
          { taskId: 'C', ordinal: 1100 }, // Ceiling is close
        ];
        const droppedCard: CardData = { taskId: 'B', ordinal: undefined };
        const dropIndex = 1; // Between A and C

        const updates = calculateOrdinalsForDrop(existingCards, droppedCard, dropIndex);

        expect(updates[0].ordinal).toBeGreaterThan(1000);
        expect(updates[0].ordinal).toBeLessThan(1100);
      });
    });
  });
});

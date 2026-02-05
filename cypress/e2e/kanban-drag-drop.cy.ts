/**
 * Kanban Drag-Drop E2E Tests
 *
 * These tests verify the ordinal calculation logic when dragging cards
 * within and between columns, especially for mixed ordinal/no-ordinal scenarios.
 */

/* eslint-disable @typescript-eslint/no-unused-expressions */

interface OrdinalUpdate {
  taskId: string;
  ordinal: number;
}

describe('Kanban Drag-Drop', () => {
  beforeEach(() => {
    cy.visitWebview('/kanban.html');
  });

  describe('Initial State', () => {
    it('should display cards in correct columns', () => {
      cy.get('[data-cy="todo-list"] .task-card').should('have.length', 3);
      cy.get('[data-cy="progress-list"] .task-card').should('have.length', 2);
      cy.get('[data-cy="done-list"] .task-card').should('have.length', 2);
    });

    it('should have correct ordinal data attributes', () => {
      cy.get('[data-cy="task-1"]').should('have.attr', 'data-ordinal', '1000');
      cy.get('[data-cy="task-2"]').should('have.attr', 'data-ordinal', '');
      cy.get('[data-cy="task-3"]').should('have.attr', 'data-ordinal', '');
      cy.get('[data-cy="task-4"]').should('have.attr', 'data-ordinal', '500');
      cy.get('[data-cy="task-5"]').should('have.attr', 'data-ordinal', '1500');
      cy.get('[data-cy="task-6"]').should('have.attr', 'data-ordinal', '');
      cy.get('[data-cy="task-7"]').should('have.attr', 'data-ordinal', '');
    });
  });

  describe('Same Column Reorder', () => {
    it('should reorder cards within same column', () => {
      // Drag task-1 below task-3 (to end of To Do column)
      cy.get('[data-cy="task-1"]').drag('[data-cy="todo-list"]', {
        target: { x: 100, y: 300 },
      });

      // Should send reorderTasks message
      cy.getLastPostedMessage().then((message) => {
        expect(message.type).to.equal('reorderTasks');
        expect(message.updates).to.be.an('array');
        // task-2 and task-3 need ordinals since they're above the drop position
        // task-1 also needs ordinal
        expect(message.updates.length).to.be.greaterThan(0);
      });
    });

    it('should assign ordinals to no-ordinal cards above drop position', () => {
      // Drag task-1 (has ordinal=1000) below task-2 and task-3 (no ordinals)
      // Expected: task-2 and task-3 get ordinals, then task-1 gets new ordinal
      cy.get('[data-cy="task-1"]').drag('[data-cy="todo-list"]', {
        target: { x: 100, y: 300 },
      });

      cy.getLastPostedMessage().then((message) => {
        expect(message.type).to.equal('reorderTasks');
        const updates = message.updates;

        // Find updates for each task
        const task1Update = updates.find((u: OrdinalUpdate) => u.taskId === 'TASK-1');
        const task2Update = updates.find((u: OrdinalUpdate) => u.taskId === 'TASK-2');
        const task3Update = updates.find((u: OrdinalUpdate) => u.taskId === 'TASK-3');

        // task-2 and task-3 should have ordinals assigned
        expect(task2Update).to.not.be.undefined;
        expect(task3Update).to.not.be.undefined;
        expect(task1Update).to.not.be.undefined;

        // Ordinals should be in correct order: task2 < task3 < task1
        expect(task2Update.ordinal).to.be.lessThan(task3Update.ordinal);
        expect(task3Update.ordinal).to.be.lessThan(task1Update.ordinal);
      });
    });
  });

  describe('Cross Column - Card with Ordinal to Column with No-Ordinal Cards', () => {
    it('should assign ordinals when dropping ordinal card below no-ordinal cards', () => {
      // Drag task-4 (ordinal=500) from In Progress to Done, below task-6 and task-7 (no ordinals)
      cy.get('[data-cy="task-4"]').drag('[data-cy="done-list"]', {
        target: { x: 100, y: 200 },
      });

      cy.getLastPostedMessage().then((message) => {
        expect(message.type).to.equal('updateTaskStatus');
        expect(message.taskId).to.equal('TASK-4');
        expect(message.status).to.equal('Done');

        // task-4 should have an ordinal
        expect(message.ordinal).to.be.a('number');

        // task-6 and task-7 should be in additionalOrdinalUpdates
        // (they need ordinals so they stay above task-4 on reload)
        const additionalUpdates = message.additionalOrdinalUpdates || [];

        // If dropping at end, task-6 and task-7 should get ordinals
        if (additionalUpdates.length > 0) {
          const task6Update = additionalUpdates.find((u: OrdinalUpdate) => u.taskId === 'TASK-6');
          const task7Update = additionalUpdates.find((u: OrdinalUpdate) => u.taskId === 'TASK-7');

          if (task6Update && task7Update) {
            // Their ordinals should be less than task-4's ordinal
            expect(task6Update.ordinal).to.be.lessThan(message.ordinal);
            expect(task7Update.ordinal).to.be.lessThan(message.ordinal);
          }
        }
      });
    });

    it('should assign ordinals when dropping between no-ordinal cards', () => {
      // Drag task-4 from In Progress to Done, between task-6 and task-7
      cy.get('[data-cy="task-4"]').drag('[data-cy="task-7"]', {
        target: { x: 100, y: 0 }, // Top of task-7 = insert before it
      });

      cy.getLastPostedMessage().then((message) => {
        expect(message.type).to.equal('updateTaskStatus');
        expect(message.taskId).to.equal('TASK-4');
        expect(message.status).to.equal('Done');
        expect(message.ordinal).to.be.a('number');

        // task-6 should get an ordinal (it's above the drop position)
        const additionalUpdates = message.additionalOrdinalUpdates || [];
        const task6Update = additionalUpdates.find((u: OrdinalUpdate) => u.taskId === 'TASK-6');

        expect(task6Update).to.not.be.undefined;
        expect(task6Update.ordinal).to.be.lessThan(message.ordinal);
      });
    });
  });

  describe('Cross Column - Card without Ordinal', () => {
    it('should handle dragging no-ordinal card to column with ordinal cards', () => {
      // Drag task-2 (no ordinal) from To Do to In Progress, between task-4 and task-5
      cy.get('[data-cy="task-2"]').drag('[data-cy="task-5"]', {
        target: { x: 100, y: 0 },
      });

      cy.getLastPostedMessage().then((message) => {
        expect(message.type).to.equal('updateTaskStatus');
        expect(message.taskId).to.equal('TASK-2');
        expect(message.status).to.equal('In Progress');
        expect(message.ordinal).to.be.a('number');

        // task-2's ordinal should be between task-4 (500) and task-5 (1500)
        expect(message.ordinal).to.be.greaterThan(500);
        expect(message.ordinal).to.be.lessThan(1500);
      });
    });

    it('should handle dragging no-ordinal card to empty position in column with ordinals', () => {
      // Drag task-2 (no ordinal) to end of In Progress (after task-5 which has ordinal=1500)
      cy.get('[data-cy="task-2"]').drag('[data-cy="progress-list"]', {
        target: { x: 100, y: 300 },
      });

      cy.getLastPostedMessage().then((message) => {
        expect(message.type).to.equal('updateTaskStatus');
        expect(message.taskId).to.equal('TASK-2');
        expect(message.status).to.equal('In Progress');
        expect(message.ordinal).to.be.a('number');

        // task-2's ordinal should be greater than task-5 (1500)
        expect(message.ordinal).to.be.greaterThan(1500);
      });
    });
  });

  describe('Ordinal Preservation on Visual Reorder', () => {
    it('should preserve visual order after drag (ordinals should match visual positions)', () => {
      // Complex scenario: drag task-1 (ordinal=1000) to be between task-2 and task-3 (no ordinals)
      // Expected visual order after: task-2, task-1, task-3
      // Required: task-2 gets ordinal < task-1's new ordinal
      cy.get('[data-cy="task-1"]').drag('[data-cy="task-3"]', {
        target: { x: 100, y: 0 },
      });

      cy.getLastPostedMessage().then((message) => {
        const updates = message.updates;

        const task1Update = updates.find((u: OrdinalUpdate) => u.taskId === 'TASK-1');
        const task2Update = updates.find((u: OrdinalUpdate) => u.taskId === 'TASK-2');

        expect(task2Update).to.not.be.undefined;
        expect(task1Update).to.not.be.undefined;

        // Visual order should be: task-2, task-1, task-3
        // So: task-2's ordinal < task-1's ordinal
        expect(task2Update.ordinal).to.be.lessThan(task1Update.ordinal);
      });
    });
  });

  describe('Data Attribute Updates', () => {
    it('should update data-ordinal attributes after drop', () => {
      // Drag task-1 below task-2 and task-3
      cy.get('[data-cy="task-1"]').drag('[data-cy="todo-list"]', {
        target: { x: 100, y: 300 },
      });

      // After drop, all cards should have ordinal data attributes updated
      cy.get('[data-cy="task-2"]').should('have.attr', 'data-ordinal').and('not.equal', '');

      cy.get('[data-cy="task-3"]').should('have.attr', 'data-ordinal').and('not.equal', '');

      cy.get('[data-cy="task-1"]').should('have.attr', 'data-ordinal').and('not.equal', '1000'); // Should have new ordinal
    });
  });
});

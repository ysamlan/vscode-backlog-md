/**
 * Task Detail Webview E2E Tests
 *
 * These tests verify the task detail webview UI functionality in isolation,
 * using a mocked VS Code API.
 *
 * Reference implementations:
 * - Nx Console Cypress tests: https://github.com/nrwl/nx-console/tree/master/apps/generate-ui-v2-e2e
 * - wdio-vscode-service: https://github.com/webdriverio-community/wdio-vscode-service
 */

describe('Task Detail Webview', () => {
  beforeEach(() => {
    cy.visitWebview('/task-detail.html');
  });

  describe('Header', () => {
    it('should display the task ID', () => {
      cy.get('[data-cy="task-id"]').should('contain.text', 'TASK-1');
    });

    it('should display the task title in an editable input', () => {
      cy.get('[data-cy="title-input"]').should('have.value', 'Sample Task Title');
    });

    it('should update title on blur and send message', () => {
      cy.get('[data-cy="title-input"]').clear().type('Updated Title').blur();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'title',
          value: 'Updated Title',
        });
      });
    });

    it('should update title on Enter key', () => {
      cy.get('[data-cy="title-input"]').clear().type('New Title{enter}');

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'title',
          value: 'New Title',
        });
      });
    });

    it('should revert title on Escape key', () => {
      cy.get('[data-cy="title-input"]').clear().type('Temporary Title{esc}');

      cy.get('[data-cy="title-input"]').should('have.value', 'Sample Task Title');
    });
  });

  describe('Status Dropdown', () => {
    it('should display the current status', () => {
      cy.get('[data-cy="status-select"]').should('have.value', 'In Progress');
    });

    it('should send message when status changes', () => {
      cy.get('[data-cy="status-select"]').select('Done');

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'status',
          value: 'Done',
        });
      });
    });
  });

  describe('Priority Dropdown', () => {
    it('should display the current priority', () => {
      cy.get('[data-cy="priority-select"]').should('have.value', 'medium');
    });

    it('should send message when priority changes', () => {
      cy.get('[data-cy="priority-select"]').select('high');

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'priority',
          value: 'high',
        });
      });
    });

    it('should send undefined when priority is cleared', () => {
      cy.get('[data-cy="priority-select"]').select('No Priority');

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'priority',
          value: undefined,
        });
      });
    });
  });

  describe('Labels', () => {
    it('should display existing labels', () => {
      cy.contains('.label', 'bug').should('exist');
      cy.contains('.label', 'urgent').should('exist');
    });

    it('should add a new label on Enter', () => {
      cy.get('[data-cy="add-label-input"]').type('new-label{enter}');

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'labels',
          value: ['bug', 'urgent', 'new-label'],
        });
      });
    });

    it('should remove a label when clicking X', () => {
      cy.get('[data-cy="remove-label-bug"]').click();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'labels',
          value: ['urgent'],
        });
      });
    });
  });

  describe('Description', () => {
    it('should display the description content', () => {
      cy.get('[data-cy="description-view"]')
        .should('contain.text', 'sample task description')
        .and('contain.html', '<strong>markdown</strong>');
    });

    it('should toggle to edit mode when clicking Edit button', () => {
      cy.get('[data-cy="edit-description-btn"]').click();

      cy.get('[data-cy="description-view"]').should('not.be.visible');
      cy.get('[data-cy="description-textarea"]').should('be.visible').and('be.focused');
      cy.get('[data-cy="edit-description-btn"]').should('have.text', 'Done');
    });

    it('should toggle to edit mode when clicking description', () => {
      cy.get('[data-cy="description-view"]').click();

      cy.get('[data-cy="description-textarea"]').should('be.visible');
    });

    it('should return to view mode on Escape', () => {
      cy.get('[data-cy="edit-description-btn"]').click();
      cy.get('[data-cy="description-textarea"]').type('{esc}');

      cy.get('[data-cy="description-view"]').should('be.visible');
      cy.get('[data-cy="description-textarea"]').should('not.be.visible');
    });

    it('should send message when clicking Done', () => {
      cy.get('[data-cy="edit-description-btn"]').click();
      cy.get('[data-cy="description-textarea"]').clear().type('New description');
      cy.get('[data-cy="edit-description-btn"]').click();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'updateField',
          field: 'description',
          value: 'New description',
        });
      });
    });
  });

  describe('Acceptance Criteria', () => {
    it('should display progress indicator', () => {
      cy.get('[data-cy="ac-progress"]').should('contain.text', '1 of 2 complete');
    });

    it('should display checklist items with correct state', () => {
      cy.get('[data-cy="ac-item-1"]').should('have.class', 'checked');
      cy.get('[data-cy="ac-item-2"]').should('not.have.class', 'checked');
    });

    it('should send message when clicking a checklist item', () => {
      cy.get('[data-cy="ac-item-2"]').click();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'toggleChecklistItem',
          listType: 'acceptanceCriteria',
          itemId: 2,
        });
      });
    });
  });

  describe('Definition of Done', () => {
    it('should display progress indicator', () => {
      cy.get('[data-cy="dod-progress"]').should('contain.text', '0 of 1 complete');
    });

    it('should send message when clicking a checklist item', () => {
      cy.get('[data-cy="dod-item-1"]').click();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'toggleChecklistItem',
          listType: 'definitionOfDone',
          itemId: 1,
        });
      });
    });
  });

  describe('Actions', () => {
    it('should send openFile message when clicking Open Raw Markdown', () => {
      cy.get('[data-cy="open-file-btn"]').click();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({ type: 'openFile' });
      });
    });
  });

  describe('Dependencies', () => {
    it('should send openTask message when clicking a dependency link', () => {
      cy.get('[data-cy="dependency-link"]').click();

      cy.getLastPostedMessage().then((message) => {
        expect(message).to.deep.equal({
          type: 'openTask',
          taskId: 'TASK-2',
        });
      });
    });
  });
});

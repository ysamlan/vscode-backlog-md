<script lang="ts">
  let { isOpen, onClose }: { isOpen: boolean; onClose: () => void } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('shortcuts-overlay')) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div
    class="shortcuts-overlay"
    role="dialog"
    aria-label="Keyboard shortcuts"
    aria-modal="true"
    tabindex="-1"
    onkeydown={handleKeydown}
    onclick={handleOverlayClick}
    data-testid="shortcuts-popup"
  >
    <div class="shortcuts-modal">
      <div class="shortcuts-header">
        <h2 class="shortcuts-title">Keyboard Shortcuts</h2>
        <button
          class="shortcuts-close-btn"
          onclick={onClose}
          aria-label="Close"
          data-testid="shortcuts-close-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="shortcuts-body">
        <div class="shortcuts-section">
          <h3 class="shortcuts-section-title">Views</h3>
          <div class="shortcuts-list">
            <div class="shortcut-row">
              <kbd>z</kbd>
              <span>Kanban view</span>
            </div>
            <div class="shortcut-row">
              <kbd>x</kbd>
              <span>List view</span>
            </div>
            <div class="shortcut-row">
              <kbd>c</kbd>
              <span>Drafts view</span>
            </div>
            <div class="shortcut-row">
              <kbd>v</kbd>
              <span>Archived view</span>
            </div>
          </div>
        </div>

        <div class="shortcuts-section">
          <h3 class="shortcuts-section-title">Navigation</h3>
          <div class="shortcuts-list">
            <div class="shortcut-row">
              <div class="kbd-group"><kbd>j</kbd> <kbd>k</kbd></div>
              <span>Next / previous task</span>
            </div>
            <div class="shortcut-row">
              <div class="kbd-group"><kbd>h</kbd> <kbd>l</kbd></div>
              <span>Previous / next column (kanban)</span>
            </div>
            <div class="shortcut-row">
              <kbd>Enter</kbd>
              <span>Open focused task</span>
            </div>
            <div class="shortcut-row">
              <kbd>/</kbd>
              <span>Focus search</span>
            </div>
          </div>
        </div>

        <div class="shortcuts-section">
          <h3 class="shortcuts-section-title">Actions</h3>
          <div class="shortcuts-list">
            <div class="shortcut-row">
              <kbd>n</kbd>
              <span>Create new task</span>
            </div>
            <div class="shortcut-row">
              <kbd>r</kbd>
              <span>Refresh views</span>
            </div>
            <div class="shortcut-row">
              <kbd>?</kbd>
              <span>Show this help</span>
            </div>
            <div class="shortcut-row">
              <kbd>Esc</kbd>
              <span>Close popup</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .shortcuts-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .shortcuts-modal {
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid var(--vscode-widget-border, #303031);
    border-radius: 8px;
    max-width: 480px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: slideIn 0.15s ease;
  }

  @keyframes slideIn {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--vscode-widget-border, #303031);
  }

  .shortcuts-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-editor-foreground, #d4d4d4);
  }

  .shortcuts-close-btn {
    all: unset;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: var(--vscode-descriptionForeground, #858585);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shortcuts-close-btn:hover {
    color: var(--vscode-editor-foreground, #d4d4d4);
    background: var(--vscode-list-hoverBackground, #2a2d2e);
  }

  .shortcuts-body {
    padding: 16px 20px;
  }

  .shortcuts-section {
    margin-bottom: 16px;
  }

  .shortcuts-section:last-child {
    margin-bottom: 0;
  }

  .shortcuts-section-title {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground, #858585);
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
  }

  .shortcut-row span {
    font-size: 13px;
    color: var(--vscode-editor-foreground, #d4d4d4);
  }

  .kbd-group {
    display: flex;
    gap: 4px;
    min-width: 64px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 22px;
    padding: 0 6px;
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
    background: var(--vscode-keybindingLabel-background, rgba(128, 128, 128, 0.17));
    color: var(--vscode-keybindingLabel-foreground, var(--vscode-editor-foreground, #d4d4d4));
    border: 1px solid var(--vscode-keybindingLabel-border, rgba(51, 51, 51, 0.6));
    border-bottom-width: 2px;
    border-bottom-color: var(--vscode-keybindingLabel-bottomBorder, rgba(68, 68, 68, 0.6));
  }

  .shortcut-row > kbd {
    min-width: 64px;
  }
</style>

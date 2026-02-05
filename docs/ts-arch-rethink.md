# Research Brief: Webview Architecture & Testing Strategy for VS Code Extension

## Context: What We're Building

**Project**: `vscode-backlog-md` - A VS Code extension providing Kanban board and task list views for managing Backlog.md tasks.

**Current Tech Stack**:

- VS Code Extension API (TypeScript)
- Webviews with inline HTML/CSS/JS generation (template literals)
- Tailwind CSS (compiled to external stylesheet)
- Testing: Vitest (unit), Cypress (webview UI), vscode-extension-tester (e2e)
- Build: esbuild, Vite (for serving test fixtures)

---

## The Core Problem: Code Duplication in Webview Testing

### How Webviews Are Generated Today

Webview HTML is generated as template literal strings inside TypeScript provider classes:

```typescript
// src/providers/TasksViewProvider.ts (~1252 lines)
protected getHtmlContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>...</head>
    <body>
        <!-- ~900 lines of inline HTML -->
        <script nonce="${nonce}">
            // ~500 lines of inline JavaScript
            function calculateOrdinalsForDrop(list, draggedCard, dropTarget) {
                // 75 lines of ordinal calculation logic
            }
            function setupKanbanDragAndDrop() {
                // 150 lines of drag-drop event handling
            }
            // ... more functions
        </script>
    </body>
    </html>`;
}
```

### How Webview Testing Works

Cypress tests run against **standalone HTML fixtures** served via Vite:

```
cypress/
├── webview-fixtures/
│   ├── kanban.html       (408 lines - STANDALONE HTML)
│   └── task-detail.html  (558 lines - STANDALONE HTML)
├── support/
│   └── vscode-mock.ts    (145 lines - mocks acquireVsCodeApi())
```

The fixtures manually duplicate the JavaScript from the provider:

```html
<!-- cypress/webview-fixtures/kanban.html -->
<script>
  const vscode = acquireVsCodeApi();

  // COPY-PASTED from TasksViewProvider.ts
  function calculateOrdinalsForDrop(list, draggedCard, dropTarget) {
    // Same 75 lines, manually synchronized
  }
</script>
```

### Quantified Duplication

| Function                   | Production Location    | Fixture Location     | Lines | Sync Method       |
| -------------------------- | ---------------------- | -------------------- | ----- | ----------------- |
| `calculateOrdinalsForDrop` | TasksViewProvider:507  | kanban.html:212      | 75    | Manual copy-paste |
| `setupKanbanDragAndDrop`   | TasksViewProvider:352  | kanban.html:319      | ~150  | Simplified copy   |
| `getDropTarget`            | TasksViewProvider:583  | kanban.html:278      | 6     | Manual copy-paste |
| `showDropIndicator`        | TasksViewProvider:365  | kanban.html:305      | 12    | Manual copy-paste |
| `clearDropIndicators`      | TasksViewProvider:357  | kanban.html:298      | 6     | Manual copy-paste |
| `toggleDescriptionEdit`    | TaskDetailProvider:659 | task-detail.html:481 | 13    | Manual copy-paste |

**Total**: ~500+ lines of duplicated JavaScript across 2 fixture files.

### Additional Issues

1. **CSS Duplication**: Production uses external `styles.css` (Tailwind), but fixtures embed ~100-300 lines of inline CSS each

2. **Fixture Drift**: Fixtures are simplified versions of production (missing milestone grouping, keyboard nav, collapsed state, etc.)

3. **Test Selectors**: `data-cy` attributes exist only in fixtures, not in production code

4. **No Shared Modules**: All synchronization is manual copy-paste; no build step connects them

---

## Why This Architecture Exists

### VS Code Webview Constraints

1. **Security (CSP)**: Webviews enforce Content Security Policy - scripts must use nonces, no inline event handlers
2. **Isolation**: Webviews run in separate iframe contexts, can't share modules with extension host
3. **Dynamic Content**: Task data varies - template generation is more flexible than static HTML
4. **Single Bundle**: Providers generate complete HTML in one TypeScript file for simpler deployment

### Current Testing Strategy

1. **Unit Tests (Vitest)**: Test provider business logic with mocked webview panels
2. **Cypress Webview Tests**: Test interactive JavaScript (drag-drop, editing) in real browser
3. **E2E Tests**: Test full extension integration

Cypress is essential because unit tests cannot simulate HTML5 drag events, DOM positioning, or complex user flows.

---

## What We Want to Achieve

1. **Single Source of Truth**: Webview JavaScript should be written once and tested directly
2. **Component Testability**: UI components should be testable in isolation
3. **Reduced Maintenance**: Changes shouldn't require updating multiple files
4. **VS Code Integration**: Must work within webview CSP constraints
5. **Developer Experience**: Reasonable learning curve, good tooling

---

## Options to Research

### Option 1: Extract Shared JavaScript Modules

Keep current architecture but extract duplicated functions to shared files that both production and fixtures import.

**Questions to answer**:

- How do we bundle shared JS for both VS Code webview (CSP with nonces) and standalone Cypress tests?
- Can Vite/esbuild bundle modules that work in both contexts?
- How do we handle the template literal constraint (currently all JS is inline)?

### Option 2: Web Components (Vanilla)

Convert UI elements to native Web Components (Custom Elements + Shadow DOM).

**Questions to answer**:

- How well do Web Components work inside VS Code webviews?
- Any CSP issues with Custom Elements registration?
- Can we test Web Components standalone in Cypress?
- What's the boilerplate overhead vs current approach?
- How do Web Components interact with VS Code theming (CSS custom properties)?

### Option 3: vscode-elements / vscode-elements-lite

Use existing VS Code-styled component libraries:

- **vscode-elements**: https://github.com/vscode-elements/elements / https://vscode-elements.github.io/
- **vscode-elements-lite**: https://github.com/vscode-elements/elements-lite

**Questions to answer**:

- What components are available? Do they cover our needs (cards, columns, drag-drop)?
- How mature/maintained are these libraries?
- What's the bundle size impact?
- How easy to extend with custom components?
- How do they handle testing - any patterns we can follow?
- What's the difference between vscode-elements and vscode-elements-lite?

### Option 4: Svelte 5 (without SvelteKit)

Use Svelte 5 for component architecture with compilation to vanilla JS.

**Questions to answer**:

- Can Svelte components be compiled for VS Code webview CSP constraints?
- How do we test Svelte components with Cypress (or should we use Svelte's testing approach)?
- What's the build pipeline look like (esbuild + Svelte compiler)?
- Any VS Code extension examples using Svelte for webviews?
- Svelte 5 specifically - what's new vs Svelte 4 that's relevant here?

### Option 5: Vue 3 (without Nuxt)

Use Vue 3 for component architecture.

**Questions to answer**:

- Same as Svelte: CSP compatibility, testing approach, build pipeline
- Vue Test Utils vs Cypress for component testing
- Any VS Code extension examples using Vue for webviews?
- Single File Components (SFC) workflow with current build setup

---

## Evaluation Criteria

Please research and compare each option against these criteria:

### 1. Component Testability

- Can components be tested in isolation?
- Can we use the same component code in tests and production?
- How well does it integrate with Cypress (or does it need different testing tools)?

### 2. VS Code Compatibility

- Works within webview CSP (nonces, no inline handlers)
- Integrates with VS Code theming (CSS custom properties)
- Any known issues or workarounds needed?

### 3. Developer Experience

- Learning curve (we're currently plain TS/HTML/CSS)
- Tooling quality (IDE support, debugging)
- Build complexity

### 4. Bundle Size & Performance

- Impact on extension package size
- Runtime performance in webviews

### 5. Maintenance & Longevity

- Project maturity and maintenance status
- Community adoption for VS Code extensions specifically

### 6. Migration Path

- How much of current code can be reused?
- Can we migrate incrementally?

---

## Specific Questions to Answer

1. **For any framework option**: Are there VS Code extensions using this approach that we can reference?

2. **For vscode-elements**: Is this actively maintained? What's the roadmap? How does it compare to building our own Web Components?

3. **For Svelte/Vue**: What's the minimal setup for VS Code webviews (no SSR, no routing, just components)?

4. **For all options**: What testing pattern eliminates the copy-paste between production and test code?

5. **Build tooling**: We use esbuild for the extension. How does each option integrate?

---

## Current Files for Reference

If you need to see the actual code:

- Production webview: `src/providers/TasksViewProvider.ts` (~1252 lines)
- Production webview: `src/providers/TaskDetailProvider.ts` (~780 lines)
- Test fixture: `cypress/webview-fixtures/kanban.html` (~408 lines)
- Test fixture: `cypress/webview-fixtures/task-detail.html` (~558 lines)
- VS Code mock: `cypress/support/vscode-mock.ts` (~145 lines)
- Build: `package.json`, `vite.config.ts`

---

## Desired Deliverable

A report covering:

1. **Feasibility assessment** for each option
2. **Pros/cons comparison table** against evaluation criteria
3. **Recommended approach** with justification
4. **Example patterns** or reference implementations
5. **Migration strategy** if switching frameworks
6. **Testing architecture** that eliminates duplication

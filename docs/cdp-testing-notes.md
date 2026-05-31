# CDP / Electron Testing Gotchas - Lessons Learned

## Summary

Hard-won insights from driving a real VS Code instance over the Chrome DevTools
Protocol (CDP) — used by the `bun run test:cdp` cross-view tests (`src/test/cdp/lib/`)
and by CDP-driven screenshot automation (the `visual-proof` skill). These are
non-obvious behaviors of VS Code's Electron host and webview iframe architecture
that cost real debugging time to discover. The lib code already encodes most of
them; this doc explains the _why_ so they survive refactors and environment moves.

## Connecting to VS Code over CDP

- **VS Code strips `--remote-debugging-pipe`.** You cannot use Playwright's
  `_electron.launch()` to attach the way you would for a vanilla Electron app.
  Launch VS Code with **`--remote-debugging-port=<port>`** instead and speak raw
  CDP over a WebSocket. See `vscode-launcher.ts` (`--remote-debugging-port`,
  `--user-data-dir`) and `CdpClient.ts`.
- Discover the target by fetching the HTTP `/json/list` endpoint on that port and
  reading `webSocketDebuggerUrl` for the `page` target (`vscode-launcher.ts`).

## Webview iframe architecture

The DOM nesting is three layers deep:

```
Main page  ->  vscode-webview:// outer frame  ->  inner content iframe (Svelte app, same-origin)
```

- You must call **`Target.setDiscoverTargets({ discover: true })` before
  `Target.getTargets()`** — otherwise the iframe targets are invisible.
- Filter targets by `type === 'iframe'` and `url.includes('vscode-webview')`.
- Attach to iframe targets with **`Target.attachToTarget({ flatten: true })`** to
  get a usable CDP session into the inner frame.

All of this lives in `webview-helpers.ts` (`discoverWebviewTargets`, attach logic).

## Dispatching events that Svelte actually handles

- **Svelte event handlers only fire for events constructed in the inner frame's own
  JS context.** A `MouseEvent`/`DragEvent`/`Event` created in the wrong realm is
  ignored by the framework's listeners.
- Always construct events with the inner frame's `window`:
  `new win.MouseEvent('click', { bubbles: true, ... })`, then `el.dispatchEvent(event)`.
- The same applies to `DragEvent` + `DataTransfer` for drag-and-drop tests and to
  `Event('change'|'input', { bubbles: true })` for form controls. See the click,
  select, drag, and input helpers in `webview-helpers.ts`.

## Theme detection and switching (VS Code 1.109+)

These bit us during screenshot automation and are easy to regress:

- **The theme class moved to `.monaco-workbench`** (not `document.body`):
  `vs-dark` for dark themes, `vs` for light. `.monaco-workbench` is also the
  readiness signal used in `wait-helpers.ts` (presence of `.monaco-workbench` +
  `.activitybar` means the workbench has rendered).
- **VS Code 1.109 ignores `settings.json` `colorTheme` on first launch** — it forces
  the 2026 default dark theme regardless. To get a deterministic theme you must
  switch via the command palette ("Preferences: Color Theme").
- **The command-palette theme switch must be the LAST step before capturing.** Any
  subsequent `Escape` keypress reverts the in-progress theme preview, silently
  undoing the switch. Order your scenario steps so the theme change is final.

## See also

- `src/test/cdp/lib/` — the implementation of all the above.
- `docs/e2e-tests-lessons-learned.md` — why we use vscode-extension-tester for the
  separate extension-activation e2e tier.
- `AGENTS.md` ("Testing Strategy" → "When to use CDP cross-view tests").

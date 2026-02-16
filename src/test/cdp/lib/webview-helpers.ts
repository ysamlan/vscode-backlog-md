/**
 * Webview interaction helpers for CDP-based tests.
 *
 * VS Code webviews have a layered iframe architecture:
 *   Main page -> vscode-webview:// outer frame -> inner content iframe (Svelte app)
 *
 * The outer frame is a CDP iframe target. The inner iframe is same-origin from
 * the outer frame and accessible via iframe.contentDocument.
 *
 * Svelte event handlers only fire with events created in the inner frame's JS
 * context: `new win.MouseEvent('click', ...)`.
 */

import { CdpClient } from './CdpClient';

/** Webview role corresponds to the body class set by each provider */
export type WebviewRole = 'tasks' | 'preview' | 'detail';

const ROLE_CLASS_MAP: Record<WebviewRole, string> = {
  tasks: 'tasks-page',
  preview: 'task-preview-page',
  detail: 'task-detail-page',
};

/**
 * Session cache: keeps webview sessions alive between operations to avoid
 * the overhead of re-discovering and re-attaching on every call.
 */
const sessionCache = new Map<WebviewRole, string>();

/** Clear the session cache (call between tests or after webview refresh). */
export function clearWebviewSessionCache(): void {
  sessionCache.clear();
}

/** Discover all vscode-webview iframe targets */
export async function discoverWebviewTargets(cdp: CdpClient): Promise<
  Array<{
    targetId: string;
    url: string;
  }>
> {
  try {
    await cdp.send('Target.setDiscoverTargets', { discover: true });
  } catch {
    /* ignore */
  }

  const { targetInfos } = (await cdp.send('Target.getTargets')) as {
    targetInfos: Array<{ targetId: string; type: string; url: string }>;
  };

  return targetInfos.filter((t) => t.type === 'iframe' && t.url?.includes('vscode-webview'));
}

/** Attach to a webview iframe target and return its session ID */
export async function attachToWebview(cdp: CdpClient, targetId: string): Promise<string> {
  const attached = (await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })) as { sessionId: string };

  await cdp.sendToSession(attached.sessionId, 'Runtime.enable');
  return attached.sessionId;
}

/** Detach from a webview session (best effort) */
export async function detachFromWebview(cdp: CdpClient, sessionId: string): Promise<void> {
  try {
    await cdp.send('Target.detachFromTarget', { sessionId });
  } catch {
    /* ignore */
  }
}

/** Evaluate a JS expression inside the inner iframe of a webview session */
export async function evaluateInWebview(
  cdp: CdpClient,
  sessionId: string,
  expression: string
): Promise<unknown> {
  const result = (await cdp.sendToSession(sessionId, 'Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      if (!iframe) return undefined;
      let doc, win;
      try {
        doc = iframe.contentDocument || iframe.contentWindow?.document;
        win = iframe.contentWindow;
      } catch(e) { return undefined; }
      if (!doc || !win) return undefined;
      return (function(doc, win) { ${expression} })(doc, win);
    })()`,
    returnByValue: true,
    awaitPromise: true,
  })) as { result?: { value?: unknown } };

  return result?.result?.value;
}

/**
 * Find a webview by its role (body class).
 * Uses a session cache to avoid re-discovery on every call.
 * Returns the session ID for the matching webview, or null.
 */
export async function findWebviewByRole(cdp: CdpClient, role: WebviewRole): Promise<string | null> {
  // Check cache: verify the session is still alive
  const cached = sessionCache.get(role);
  if (cached) {
    try {
      const alive = await evaluateInWebview(cdp, cached, 'return true;');
      if (alive === true) return cached;
    } catch {
      // Session died — fall through to rediscovery
    }
    sessionCache.delete(role);
  }

  // Discover and attach
  const targets = await discoverWebviewTargets(cdp);
  const bodyClass = ROLE_CLASS_MAP[role];

  for (const target of targets) {
    let sessionId: string;
    try {
      sessionId = await attachToWebview(cdp, target.targetId);
    } catch {
      continue;
    }

    try {
      const hasClass = await evaluateInWebview(
        cdp,
        sessionId,
        `return doc.body?.classList?.contains(${JSON.stringify(bodyClass)}) ?? false;`
      );

      if (hasClass) {
        sessionCache.set(role, sessionId);
        return sessionId;
      }
    } catch {
      // continue to next target
    }

    await detachFromWebview(cdp, sessionId);
  }

  return null;
}

/**
 * Click an element matching `selector` in a webview identified by role.
 * Uses the inner frame's MouseEvent constructor so Svelte handlers fire.
 */
export async function clickInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    if (!el) return 'not-found';
    const event = new win.MouseEvent('click', {
      bubbles: true, cancelable: true, view: win
    });
    el.dispatchEvent(event);
    return 'clicked';
    `
  );
  return result === 'clicked';
}

/**
 * Click an element containing specific text in a webview.
 * Searches within elements matching `selector`.
 */
export async function clickElementByTextInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string,
  text: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const elements = doc.querySelectorAll(${JSON.stringify(selector)});
    for (const el of elements) {
      if (el.textContent?.includes(${JSON.stringify(text)})) {
        const event = new win.MouseEvent('click', {
          bubbles: true, cancelable: true, view: win
        });
        el.dispatchEvent(event);
        return 'clicked';
      }
    }
    return 'not-found';
    `
  );
  return result === 'clicked';
}

/**
 * Get the text content of a webview's inner iframe.
 */
export async function getWebviewTextContent(
  cdp: CdpClient,
  role: WebviewRole
): Promise<string | null> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return null;

  const text = await evaluateInWebview(cdp, sessionId, `return doc.body?.textContent ?? '';`);
  return typeof text === 'string' ? text : null;
}

/**
 * Query a CSS property or check for a class on an element in a webview.
 */
export async function queryWebviewElement(
  cdp: CdpClient,
  role: WebviewRole,
  expression: string
): Promise<unknown> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return undefined;

  return await evaluateInWebview(cdp, sessionId, expression);
}

/**
 * Change a <select> element's value in a webview and dispatch a change event.
 */
export async function setSelectValueInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string,
  value: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const select = doc.querySelector(${JSON.stringify(selector)});
    if (!select) return 'not-found';
    select.value = ${JSON.stringify(value)};
    const event = new win.Event('change', { bubbles: true });
    select.dispatchEvent(event);
    return 'changed';
    `
  );
  return result === 'changed';
}

/**
 * Click a button with the given text content in a webview.
 */
export async function clickButtonInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  buttonText: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const buttons = [...doc.querySelectorAll('button, [role="button"], a')];
    const btn = buttons.find(b => b.textContent?.trim() === ${JSON.stringify(buttonText)});
    if (!btn) return 'not-found';
    const event = new win.MouseEvent('click', {
      bubbles: true, cancelable: true, view: win
    });
    btn.dispatchEvent(event);
    return 'clicked';
    `
  );
  return result === 'clicked';
}

/**
 * Perform a drag-and-drop within a webview.
 *
 * The drag-and-drop flow:
 * 1. dragstart on source card (sets DataTransfer data)
 * 2. Add .dragging class to source (handleDragStart does this via setTimeout)
 * 3. dragover on target .task-list (determines drop position)
 * 4. drop on target .task-list (reads DataTransfer data, calls onDrop)
 * 5. dragend on source card (removes .dragging class)
 *
 * Both sourceSelector and targetSelector are CSS selectors inside the inner iframe.
 * The targetSelector should point to a .task-list element (not .kanban-column).
 */
export async function dragAndDropInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  sourceSelector: string,
  targetSelector: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const source = doc.querySelector(${JSON.stringify(sourceSelector)});
    const target = doc.querySelector(${JSON.stringify(targetSelector)});
    if (!source) return 'source-not-found';
    if (!target) return 'target-not-found';

    // Create DataTransfer and set task ID data
    const dt = new win.DataTransfer();
    const taskId = source.getAttribute('data-task-id') || '';

    // 1. Dispatch dragstart on the card
    const dragStartEvent = new win.DragEvent('dragstart', {
      bubbles: true, cancelable: true, dataTransfer: dt
    });
    source.dispatchEvent(dragStartEvent);

    // The TaskCard handler calls dt.setData('text/plain', taskId)
    // But DataTransfer in DragEvent constructor may be read-only.
    // Manually add the dragging class and set data as fallback.
    source.classList.add('dragging');
    try { dt.setData('text/plain', taskId); } catch(e) { /* ok */ }

    // 2. Dispatch dragover on target task-list
    const targetRect = target.getBoundingClientRect();
    const dragOverEvent = new win.DragEvent('dragover', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + 10
    });
    target.dispatchEvent(dragOverEvent);

    // 3. Dispatch drop on target task-list
    const dropEvent = new win.DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + 10
    });
    target.dispatchEvent(dropEvent);

    // 4. Dispatch dragend on source card
    source.dispatchEvent(new win.DragEvent('dragend', {
      bubbles: true, cancelable: true, dataTransfer: dt
    }));
    source.classList.remove('dragging');

    return 'dropped';
    `
  );
  return result === 'dropped';
}

/**
 * Type text into a textarea or input in a webview by setting its value
 * and dispatching input events character by character.
 *
 * This simulates realistic typing: each character fires an input event,
 * which triggers Svelte's oninput handlers (including debounce logic).
 */
export async function typeInWebviewInput(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string,
  text: string,
  opts: { clearFirst?: boolean; delayMs?: number } = {}
): Promise<boolean> {
  const { clearFirst = false, delayMs = 30 } = opts;
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  // First, focus and optionally clear the element
  const prepared = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    if (!el) return 'not-found';
    el.focus();
    ${clearFirst ? 'el.value = "";' : ''}
    return 'ready';
    `
  );
  if (prepared !== 'ready') return false;

  // Type each character, dispatching input events
  for (const char of text) {
    await evaluateInWebview(
      cdp,
      sessionId,
      `
      const el = doc.querySelector(${JSON.stringify(selector)});
      if (!el) return;
      el.value += ${JSON.stringify(char)};
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
      `
    );
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return true;
}

/**
 * Check if an element is focused within a webview's inner iframe.
 */
export async function isElementFocusedInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    return doc.activeElement === el;
    `
  );
  return result === true;
}

/**
 * Get the value of an input/textarea element in a webview.
 */
export async function getInputValueInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string
): Promise<string | null> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return null;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    return el?.value ?? null;
    `
  );
  return typeof result === 'string' ? result : null;
}

/**
 * Type text into a contenteditable element inside a webview.
 * Uses document.execCommand('insertText') which triggers proper input events.
 */
export async function typeInWebviewContentEditable(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string,
  text: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    doc.execCommand('insertText', false, ${JSON.stringify(text)});
    return true;
    `
  );
  return result === true;
}

/**
 * Check if focus is inside a container element (or on it) within a webview.
 * Useful for contenteditable editors where the focused element may be a child.
 */
export async function isFocusInsideWebviewElement(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    if (!el || !doc.activeElement) return false;
    return el.contains(doc.activeElement);
    `
  );
  return result === true;
}

/**
 * Get the text content of a contenteditable element inside a webview.
 */
export async function getContentEditableTextInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string
): Promise<string | null> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return null;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `
    const el = doc.querySelector(${JSON.stringify(selector)});
    return el?.textContent ?? null;
    `
  );
  return typeof result === 'string' ? result : null;
}

/**
 * Check whether an element matching the selector exists in a webview.
 */
export async function elementExistsInWebview(
  cdp: CdpClient,
  role: WebviewRole,
  selector: string
): Promise<boolean> {
  const sessionId = await findWebviewByRole(cdp, role);
  if (!sessionId) return false;

  const result = await evaluateInWebview(
    cdp,
    sessionId,
    `return !!doc.querySelector(${JSON.stringify(selector)});`
  );
  return result === true;
}

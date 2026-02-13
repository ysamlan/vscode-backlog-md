/**
 * Minimal CDP (Chrome DevTools Protocol) client over WebSocket.
 *
 * Supports session-scoped commands for iframe targets (required for
 * VS Code webview interaction).
 *
 * Extracted from scripts/screenshots/generate.ts.
 */
export class CdpClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private commandTimeout = 15_000;

  /** Connect to a CDP WebSocket endpoint */
  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`WebSocket connection failed: ${wsUrl}`));
      ws.onmessage = (event) => {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }

  /** Send a CDP command to the main page target */
  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws) throw new Error('Not connected');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, this.commandTimeout);
    });
  }

  /** Send a CDP command to an attached session (for iframe targets) */
  async sendToSession(
    sessionId: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.ws) throw new Error('Not connected');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP session command timeout: ${method}`));
        }
      }, this.commandTimeout);
    });
  }

  /** Close the WebSocket connection */
  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

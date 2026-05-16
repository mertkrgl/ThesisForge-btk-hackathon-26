// Streaming client per docs/stack.md §3.
// WebSocket -> 3 retry (1s/2s/4s exponential backoff) -> REST polling degrade.
// Backend endpoints not implemented yet; this class is import-ready.

export type ThesisToken = {
  offset: number;
  // backend will define the rest; kept loose intentionally.
  [key: string]: unknown;
};

type StatusPayload = {
  new_tokens?: ThesisToken[];
  done?: boolean;
};

export class ResilientThesisClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private readonly maxRetries = 3;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly onToken: (token: ThesisToken) => void,
    private readonly onDone?: () => void
  ) {}

  connect(sessionId: string) {
    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsUrl}/ws/thesis/${sessionId}`);
    this.ws.onopen = () => {
      this.retries = 0;
    };
    this.ws.onclose = () => this.handleDisconnect(sessionId);
    this.ws.onerror = () => this.handleDisconnect(sessionId);
    this.ws.onmessage = (e) => {
      try {
        this.onToken(JSON.parse(e.data) as ThesisToken);
      } catch {
        // ignore malformed frames; backend is the source of truth
      }
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private handleDisconnect(sessionId: string) {
    if (this.retries < this.maxRetries) {
      const delay = 1000 * Math.pow(2, this.retries);
      setTimeout(() => {
        this.retries++;
        this.connect(sessionId);
      }, delay);
    } else {
      this.startPolling(sessionId);
    }
  }

  private startPolling(sessionId: string) {
    let lastOffset = 0;
    this.pollingTimer = setInterval(async () => {
      try {
        const res = await fetch(
          `${this.baseUrl}/api/thesis/${sessionId}/status?after=${lastOffset}`
        );
        const data: StatusPayload = await res.json();
        data.new_tokens?.forEach((t) => {
          if (typeof t.offset === "number") lastOffset = t.offset;
          this.onToken(t);
        });
        if (data.done && this.pollingTimer) {
          clearInterval(this.pollingTimer);
          this.pollingTimer = null;
          this.onDone?.();
        }
      } catch {
        // backend down — keep polling; UI shows degraded state separately.
      }
    }, 2000);
  }
}

/**
 * Backend `/ws/thesis/{thesis_id}` WebSocket bağlantısı.
 *
 * - Bağlantı düşerse 3 deneme: 1s/2s/4s exponential backoff.
 * - 3 deneme de fail olursa onError ile error yayınlar; UI fallback olarak
 *   `GET /api/thesis/{id}` ile final tezi çekebilir.
 * - Backend event'leri `StreamAdapter` üzerinden frontend StreamEvent'lerine
 *   çevrilir; çoklu event üretebilir (örn. backend `stage` → frontend `phase`
 *   + birden çok `agent_start`/`agent_done`).
 */

import { wsUrl as buildWsUrl } from "@/lib/api/client";
import { createStreamAdapter } from "@/lib/adapters/stream";
import type { StreamEvent } from "@/lib/mock/types";
import type { BackendWsEvent } from "@/lib/types/backend";

export type ConnectOptions = {
  thesisId: string;
  /** Backend `/chat` response'undaki relative ws_url (örn. `/ws/thesis/xxx`). */
  wsUrl: string;
};

export type ResilientClientOptions = {
  onEvent: (e: StreamEvent) => void;
  onError?: (msg: string) => void;
  /** WS yerine demo fixture stream'i için ?force_demo=1 ekle. */
  forceDemo?: boolean;
  maxRetries?: number;
};

export class ResilientThesisClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private readonly maxRetries: number;
  private stopped = false;
  private lastConnect: ConnectOptions | null = null;
  private adapter = createStreamAdapter();

  constructor(private readonly opts: ResilientClientOptions) {
    this.maxRetries = opts.maxRetries ?? 3;
  }

  connect(options: ConnectOptions): void {
    this.lastConnect = options;
    this.stopped = false;
    this.openSocket();
  }

  disconnect(): void {
    this.stopped = true;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  private openSocket(): void {
    if (this.stopped || !this.lastConnect) return;

    const path = this.lastConnect.wsUrl.startsWith("/")
      ? this.lastConnect.wsUrl
      : `/ws/thesis/${this.lastConnect.thesisId}`;

    const fullUrl = buildWsUrl(
      this.opts.forceDemo ? `${path}?force_demo=1` : path,
    );

    let ws: WebSocket;
    try {
      ws = new WebSocket(fullUrl);
    } catch (err) {
      this.opts.onError?.(
        err instanceof Error ? err.message : "WebSocket oluşturulamadı",
      );
      this.handleDisconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
    };

    ws.onmessage = (evt) => {
      try {
        const raw = JSON.parse(evt.data) as BackendWsEvent;
        const adapted = this.adapter.push(raw);
        for (const e of adapted) this.opts.onEvent(e);
        const err = this.adapter.consumeError();
        if (err) this.opts.onError?.(err);
      } catch (e) {
        // Geçersiz JSON / unknown event — sessizce geç, backend ground truth
        console.warn("WS message parse fail", e);
      }
    };

    ws.onerror = () => {
      // close() handler'ı tetiklenecek; tekrarlama orada
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.stopped) return;
      // Adapter zaten "done" gördüyse pipeline başarılı bitmiş; reconnect yok
      if (this.adapter.doneThesisId()) return;
      this.handleDisconnect();
    };
  }

  private handleDisconnect(): void {
    if (this.stopped || !this.lastConnect) return;
    if (this.retries >= this.maxRetries) {
      this.opts.onError?.(
        "Canlı bağlantı kurulamadı. Pipeline arka planda devam ediyor; tez tamamlandığında geçmiş sayfasından ulaşabilirsiniz.",
      );
      return;
    }
    const delay = 1000 * Math.pow(2, this.retries);
    this.retries += 1;
    setTimeout(() => this.openSocket(), delay);
  }
}

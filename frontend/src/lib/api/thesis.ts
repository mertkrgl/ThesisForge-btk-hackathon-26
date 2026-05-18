import { getThesisById, listThesesByTicker } from "@/lib/mock/theses";
import { createMockThesisStream } from "@/lib/mock/stream";
import type { StreamEvent, Thesis } from "@/lib/mock/types";
import { apiFetch } from "@/lib/api/client";
import {
  adaptThesis,
  adaptThesisSummary,
} from "@/lib/adapters/thesis";
import type {
  BackendChatResponse,
  BackendCitation,
  BackendThesis,
  BackendThesisSummary,
} from "@/lib/types/backend";
import { ResilientThesisClient } from "@/lib/ws/ResilientThesisClient";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

export async function getThesis(id: string): Promise<Thesis | undefined> {
  if (USE_MOCKS) return getThesisById(id);
  try {
    const bt = await apiFetch<BackendThesis>(`/api/thesis/${id}`);
    let citations: BackendCitation[] | undefined;
    try {
      citations = await apiFetch<BackendCitation[]>(
        `/api/thesis/${id}/citations`,
      );
    } catch {
      citations = undefined;
    }
    return adaptThesis(bt, { citations });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      return undefined;
    }
    throw err;
  }
}

type ThesesPageResponse = {
  items: BackendThesisSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type ThesesPage = {
  items: Thesis[];
  total: number;
  limit: number;
  offset: number;
};

export async function listTheses(ticker?: string): Promise<Thesis[]> {
  if (USE_MOCKS) return listThesesByTicker(ticker);
  const page = await listThesesPage({ ticker, limit: 50, offset: 0 });
  return page.items;
}

export async function listThesesPage({
  ticker,
  limit = 10,
  offset = 0,
}: {
  ticker?: string;
  limit?: number;
  offset?: number;
}): Promise<ThesesPage> {
  if (USE_MOCKS) {
    const all = listThesesByTicker(ticker);
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    };
  }
  const qs = new URLSearchParams();
  if (ticker) qs.set("ticker", ticker);
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  const res = await apiFetch<ThesesPageResponse>(
    `/api/theses?${qs.toString()}`,
  );
  return {
    items: res.items.map(adaptThesisSummary),
    total: res.total,
    limit: res.limit,
    offset: res.offset,
  };
}

export type StartThesisInput = {
  symbol: string;
  persona?: "default" | "conservative";
  question?: string;
};

export type StartThesisResult = {
  thesisId: string;
  ticker: string;
  wsUrl: string;
};

export async function startThesis(
  input: StartThesisInput,
): Promise<StartThesisResult> {
  const message = input.question?.trim()
    ? input.question.trim()
    : `${input.symbol.toUpperCase()} hakkında analiz`;
  const body = {
    message,
    ticker: input.symbol.toUpperCase(),
    mode: input.persona ?? "default",
  };
  const res = await apiFetch<BackendChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    thesisId: res.thesis_id,
    ticker: res.ticker,
    wsUrl: res.ws_url,
  };
}

export type StreamHandle = { stop: () => void };
export type StreamThesisInput = StartThesisInput & {
  thesisId?: string;
  wsUrl?: string;
};

export type StreamCallbacks = {
  onEvent: (e: StreamEvent) => void;
  onError?: (msg: string) => void;
  onMeta?: (meta: { thesisId: string; ticker: string }) => void;
};

/**
 * `params.thesisId` ve `params.wsUrl` verilirse doğrudan o session'a bağlanır;
 * verilmezse önce `startThesis` ile yeni bir thesis kickoff eder.
 *
 * Mock mode'da `createMockThesisStream` kullanılır (offline dev için).
 */
export function streamThesis(
  params: StreamThesisInput,
  callbacks: StreamCallbacks | ((e: StreamEvent) => void),
): StreamHandle {
  const cb: StreamCallbacks =
    typeof callbacks === "function" ? { onEvent: callbacks } : callbacks;

  if (USE_MOCKS) {
    return createMockThesisStream(cb.onEvent, { speed: 1 });
  }

  const client = new ResilientThesisClient({
    onEvent: cb.onEvent,
    onError: (msg) => cb.onError?.(msg),
  });

  let stopped = false;

  const begin = async () => {
    try {
      let thesisId = params.thesisId;
      let wsUrl = params.wsUrl;
      let ticker = params.symbol.toUpperCase();
      if (!thesisId || !wsUrl) {
        const meta = await startThesis(params);
        thesisId = meta.thesisId;
        wsUrl = meta.wsUrl;
        ticker = meta.ticker;
      }
      if (stopped) return;
      cb.onMeta?.({ thesisId, ticker });
      client.connect({ thesisId, wsUrl: wsUrl! });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cb.onError?.(msg);
    }
  };

  void begin();

  return {
    stop: () => {
      stopped = true;
      client.disconnect();
    },
  };
}

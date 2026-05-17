import { apiFetch } from "@/lib/api/client";
import type { BackendQuote } from "@/lib/types/backend";

export async function fetchMarketQuote(ticker: string): Promise<BackendQuote> {
  return apiFetch<BackendQuote>(
    `/api/market/quote/${encodeURIComponent(ticker.toUpperCase())}`,
  );
}

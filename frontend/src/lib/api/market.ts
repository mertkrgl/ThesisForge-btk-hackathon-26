import { apiFetch } from "@/lib/api/client";
import type {
  BackendCompanyFeed,
  BackendHistory,
  BackendQuote,
  MarketHistoryPeriod,
} from "@/lib/types/backend";

export async function fetchMarketQuote(ticker: string): Promise<BackendQuote> {
  return apiFetch<BackendQuote>(
    `/api/market/quote/${encodeURIComponent(ticker.toUpperCase())}`,
  );
}

export async function fetchMarketHistory(
  ticker: string,
  period: MarketHistoryPeriod,
): Promise<BackendHistory> {
  return apiFetch<BackendHistory>(
    `/api/market/history/${encodeURIComponent(ticker.toUpperCase())}?period=${period}`,
  );
}

export async function fetchCompanyFeed(
  ticker: string,
  options: { days?: number; limit?: number } = {},
): Promise<BackendCompanyFeed> {
  const { days = 30, limit = 30 } = options;
  return apiFetch<BackendCompanyFeed>(
    `/api/market/feed/${encodeURIComponent(ticker.toUpperCase())}?days=${days}&limit=${limit}`,
  );
}

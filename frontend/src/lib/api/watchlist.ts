import { apiFetch, getDemoUserId } from "@/lib/api/client";
import { companyName } from "@/lib/data/companyNames";
import type {
  BackendQuote,
  BackendWatchlistRow,
} from "@/lib/types/backend";
import type { WatchlistItem } from "@/lib/mock/types";

async function fetchQuote(ticker: string): Promise<BackendQuote | null> {
  try {
    return await apiFetch<BackendQuote>(
      `/api/market/quote/${encodeURIComponent(ticker)}`,
    );
  } catch {
    return null;
  }
}

export async function listWatchlist(): Promise<WatchlistItem[]> {
  const userId = getDemoUserId();
  const qs = new URLSearchParams({ user_id: userId });
  const rows = await apiFetch<BackendWatchlistRow[]>(
    `/api/watchlist?${qs.toString()}`,
  );

  const quotes = await Promise.all(rows.map((r) => fetchQuote(r.ticker)));

  return rows.map((row, i) => {
    const q = quotes[i];
    const fallbackSpark = Array.from({ length: 24 }, (_, j) => 100 + j * 0.1);
    return {
      ticker: row.ticker,
      name: companyName(row.ticker),
      last: q?.last ?? 0,
      deltaPct: q?.delta_pct ?? 0,
      spark: q?.spark && q.spark.length > 0 ? q.spark : fallbackSpark,
    };
  });
}

export async function addToWatchlist(
  ticker: string,
): Promise<{ status: "added" | "exists" }> {
  return apiFetch<{ status: "added" | "exists" }>(`/api/watchlist`, {
    method: "POST",
    body: JSON.stringify({
      user_id: getDemoUserId(),
      ticker: ticker.toUpperCase(),
    }),
  });
}

export async function removeFromWatchlist(
  ticker: string,
): Promise<void> {
  const qs = new URLSearchParams({ user_id: getDemoUserId() });
  await apiFetch(
    `/api/watchlist/${encodeURIComponent(ticker.toUpperCase())}?${qs.toString()}`,
    { method: "DELETE" },
  );
}

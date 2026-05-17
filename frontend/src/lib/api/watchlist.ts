import { apiFetch, getDemoUserId } from "@/lib/api/client";
import { fetchMarketQuote } from "@/lib/api/market";
import { companyName } from "@/lib/data/companyNames";
import type { BackendWatchlistRow } from "@/lib/types/backend";
import type { WatchlistItem } from "@/lib/mock/types";

export async function listWatchlist(): Promise<WatchlistItem[]> {
  const userId = getDemoUserId();
  const qs = new URLSearchParams({ user_id: userId });
  const rows = await apiFetch<BackendWatchlistRow[]>(
    `/api/watchlist?${qs.toString()}`,
  );

  const quotes = await Promise.allSettled(
    rows.map((r) => fetchMarketQuote(r.ticker)),
  );

  return rows.map((row, i) => {
    const result = quotes[i];
    const q = result?.status === "fulfilled" ? result.value : null;
    return {
      ticker: row.ticker,
      name: companyName(row.ticker),
      last: q?.last ?? null,
      deltaPct: q?.delta_pct ?? null,
      spark: q?.spark && q.spark.length > 0 ? q.spark : [],
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

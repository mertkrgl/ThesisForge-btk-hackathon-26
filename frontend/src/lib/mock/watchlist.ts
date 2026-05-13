import type { WatchlistItem } from "./types";

function spark(seed: number, n = 24): number[] {
  const out: number[] = [];
  let v = 100 + seed;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 3 + seed) * 1.6;
    const noise = ((seed * (i + 1)) % 7) - 3;
    v += drift + noise * 0.4;
    out.push(Math.max(80, Math.min(140, v)));
  }
  return out;
}

export const MOCK_WATCHLIST: WatchlistItem[] = [
  { ticker: "TUPRS", name: "Tüpraş", last: 172.4, deltaPct: 1.82, spark: spark(7) },
  { ticker: "ASELS", name: "Aselsan", last: 112.8, deltaPct: 3.21, spark: spark(11) },
  { ticker: "EREGL", name: "Ereğli", last: 32.18, deltaPct: -0.41, spark: spark(3) },
  { ticker: "THYAO", name: "Türk Hava Yolları", last: 284.5, deltaPct: 0.88, spark: spark(5) },
  { ticker: "BIMAS", name: "BİM", last: 481.2, deltaPct: -0.62, spark: spark(2) },
];

export const MOCK_BIST100_SERIES: number[] = spark(1, 60).map(
  (v, i) => 9800 + v * 4 + i * 1.2
);

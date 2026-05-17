/**
 * Backend API response shape'leri — Pydantic schema'larıyla birebir.
 *
 * Bu tipler frontend Thesis/StreamEvent gibi UI tiplerinden ayrı tutulur;
 * dönüşüm `lib/adapters/`'daki adapter'larda yapılır.
 */

export type SquadType =
  | "Banking"
  | "Insurance"
  | "Finance"
  | "Brokerage"
  | "RealEstate"
  | "Energy"
  | "Defense"
  | "Automotive"
  | "Technology"
  | "Healthcare"
  | "Food"
  | "Retail"
  | "Construction"
  | "Industrial"
  | "Mining"
  | "Transportation"
  | "Holding"
  | "Generic";

export type BackendBullBearPoint = {
  point: string;
  call_id: string | null;
  score: number;
};

export type BackendCatalyst = {
  date: string;
  event: string;
  impact: "high" | "medium" | "low";
  call_id: string | null;
};

export type BackendConfidenceBreakdown = {
  data_quality: number;
  technical: number;
  fundamental: number;
  news_macro: number;
  memory_base: number;
  devil_inverse: number;
  weights: Record<string, number>;
  computed_raw: number;
  applied_cap: number | null;
  final: number;
};

export type BackendMemoryHit = {
  thesis_id: string;
  ticker: string;
  thesis_date: string;
  distance: number;
  outcome: "correct" | "partial" | "wrong" | "pending";
  ground_truth_return: number | null;
  confidence: number | null;
  squad: SquadType | null;
  summary: string;
};

/** GET /api/thesis/{id} — full DTO */
export type BackendThesis = {
  id: string;
  ticker: string;
  squad: SquadType | string;
  user_mode: "default" | "conservative";
  user_id: string | null;
  thesis_date: string | null;
  thesis_md: string | null;
  bull_points: BackendBullBearPoint[] | null;
  bear_points: BackendBullBearPoint[] | null;
  catalysts: BackendCatalyst[] | null;
  confidence: number | null;
  confidence_breakdown: BackendConfidenceBreakdown | null;
  memory_hits: BackendMemoryHit[];
  price_at_thesis: number | null;
  price_7d: number | null;
  price_30d: number | null;
  price_90d: number | null;
  ground_truth_return: number | null;
  outcome: "pending" | "correct" | "partial" | "wrong";
  had_kaynaksiz_flag: boolean;
};

/** GET /api/theses — listede thesis_md yok, kart için yeterli */
export type BackendThesisSummary = Omit<
  BackendThesis,
  | "thesis_md"
  | "confidence_breakdown"
  | "memory_hits"
  | "price_at_thesis"
  | "price_7d"
  | "price_30d"
  | "price_90d"
  | "ground_truth_return"
> & {
  bull_count: number;
  bear_count: number;
};

export type BackendCitation = {
  claim_text: string;
  call_id: string | null;
  tool_name: string | null;
  tool_result: Record<string, unknown> | null;
  is_kaynaksiz: boolean;
};

export type BackendChatResponse = {
  thesis_id: string;
  ticker: string;
  ws_url: string;
};

export type BackendWatchlistRow = {
  ticker: string;
  added_at: string;
};

export type BackendQuote = {
  ticker: string;
  last: number;
  previous_close: number;
  delta_pct: number;
  spark: number[];
};

export type BackendConfigInfo = {
  env: string;
  mode: string;
  cache_backend: string;
  models: {
    pro: string;
    flash: string;
    embed: string;
    embed_dimensions: number;
  };
  data_sources: {
    yfinance: boolean;
    isyatirim: boolean;
    tcmb_evds: boolean;
    mkk: boolean;
    kap: boolean;
    bist: boolean;
  };
};

/** WebSocket event'leri — backend `app/api/thesis_ws.py` */
export type BackendWsEvent =
  | {
      type: "agent_start";
      agent: string;
      thesis_id?: string;
      ticker?: string;
      user_mode?: string;
    }
  | { type: "stage"; stage: string; squad?: string }
  | { type: "token"; content: string }
  | {
      type: "critique";
      critique: {
        technical_pushback?: string[];
        fundamental_pushback?: string[];
        cross_cutting_risks?: string[];
        base_rate_warnings?: string[];
        overall_critique_strength?: number;
      };
    }
  | {
      type: "done";
      thesis_id: string;
      confidence?: number;
      had_kaynaksiz_flag?: boolean;
    }
  | { type: "error"; msg: string }
  | { type: "info"; msg?: string; ticker?: string };

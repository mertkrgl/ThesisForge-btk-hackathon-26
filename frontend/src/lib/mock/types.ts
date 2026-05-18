export type AgentTone =
  | "bull"
  | "bear"
  | "warn"
  | "violet"
  | "cyan"
  | "primary";

export type AgentMeta = {
  id: string;
  name: string;
  role: string;
  mandate: string;
  tone: AgentTone;
  icon: string;
};

export type StreamEventType =
  | "phase"
  | "agent_start"
  | "token"
  | "source"
  | "confidence"
  | "agent_done"
  | "tool_progress"
  | "done";

export type StreamEvent = {
  offset: number;
  type: StreamEventType;
  agentId?: string;
  payload?: string | number;
  phase?: string;
  /** tool_progress için ek meta (tool adı, ok/failed). */
  tool?: string;
  status?: "ok" | "failed";
};

export type Source = {
  id: string;
  label: string;
  url?: string;
  kind: "kap" | "evds" | "bist" | "mkk" | "news" | "filing";
};

export type Verdict = "bull" | "bear" | "neutral";

/** P2-20: bull/bear score toplamından türetilen kategorik sentiment. */
export type SentimentLabel = "POZITIF" | "NEGATIF" | "NÖTR";

export type ThesisPoint = {
  text: string;
  sources: string[];
};

export type Thesis = {
  id: string;
  ticker: string;
  company: string;
  sector: string;
  createdAt: string;
  verdict: Verdict;
  confidence: number;
  /** Bull/bear toplam skoruna göre kategorik etiket. Confidence (kanıt kalitesi)
   * ile bağımsız ölçü; backend null dönerse undefined kalır ve badge gizlenir. */
  sentimentLabel?: SentimentLabel;
  oneLiner: string;
  bull: ThesisPoint[];
  bear: ThesisPoint[];
  catalysts: ThesisPoint[];
  agents: Array<{
    id: string;
    summary: string;
    confidence: number;
  }>;
  sources: Source[];
  kpis: Array<{ label: string; value: string; delta?: string; tone?: AgentTone }>;
  /** Backend synthesizer'dan gelen tam markdown rapor (TL;DR + tüm bölümler). */
  thesisMd?: string;
  /** Citation lookup: `[kaynak: UUID]` chip'inin popover'ı için tool detayı. */
  citationLookup?: Array<CitationDetail>;
};

export type CitationDetail = {
  call_id: string;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
  tool_ts: string | null;
};

export type WatchlistItem = {
  ticker: string;
  name: string;
  last: number | null;
  deltaPct: number | null;
  spark: number[];
};

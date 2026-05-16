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
  | "done";

export type StreamEvent = {
  offset: number;
  type: StreamEventType;
  agentId?: string;
  payload?: string | number;
  phase?: string;
};

export type Source = {
  id: string;
  label: string;
  url?: string;
  kind: "kap" | "evds" | "bist" | "mkk" | "news" | "filing";
};

export type Verdict = "bull" | "bear" | "neutral";

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
};

export type WatchlistItem = {
  ticker: string;
  name: string;
  last: number;
  deltaPct: number;
  spark: number[];
};

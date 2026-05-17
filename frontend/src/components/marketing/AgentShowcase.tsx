"use client";

import {
  ReactFlow,
  Handle,
  Position,
  getSmoothStepPath,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  LineChart,
  Calculator,
  ShieldAlert,
  Sparkles,
  History,
  Zap,
  Radio,
  AlertTriangle,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { SectionHeader } from "@/components/shared/SectionHeader";

const AGENT_ICON_MAP: Record<string, LucideIcon> = {
  LineChart,
  Calculator,
  ShieldAlert,
  Sparkles,
  History,
  Zap,
  Radio,
  AlertTriangle,
  Compass: Sparkles,
  Globe: Radio,
};

// Marketing AgentShowcase mimari diyagramı için "anlatımsal" agent meta'ları —
// gerçek pipeline'da olmayan (catalyst/sentiment/risk) chip'ler dekoratif amaçlı
// burada tanımlı. Live runner ve thesis viewer sadece AGENT_REGISTRY'yi kullanır.
const SHOWCASE_AGENT_META: Record<
  string,
  { name: string; icon: string }
> = {
  technical: { name: "Teknik Analist", icon: "LineChart" },
  fundamental: { name: "Temel Analist", icon: "Calculator" },
  "devils-advocate": { name: "Şeytan Avukatı", icon: "ShieldAlert" },
  devil: { name: "Şeytan Avukatı", icon: "ShieldAlert" },
  synthesizer: { name: "Sentez", icon: "Sparkles" },
  memory: { name: "Bellek", icon: "History" },
  catalyst: { name: "Katalist Avcısı", icon: "Zap" },
  sentiment: { name: "Algı", icon: "Radio" },
  risk: { name: "Risk Yönetimi", icon: "AlertTriangle" },
  "sector-router": { name: "Sektör Yönlendirici", icon: "Compass" },
  macro: { name: "Makro Bağlam", icon: "Globe" },
};

const findAgent = (id: string) => {
  const real = AGENT_REGISTRY.find((a) => a.id === id);
  if (real) return real;
  const meta = SHOWCASE_AGENT_META[id];
  return {
    id,
    name: meta?.name ?? id,
    role: "",
    mandate: "",
    tone: "primary" as const,
    icon: meta?.icon ?? "Sparkles",
  };
};

// ----- Types -----

type Variant = "source" | "worker" | "critic" | "context" | "hub" | "output";

type HandleSpec = {
  kind: "source" | "target";
  side: "left" | "right";
  id: string;
  topPct?: number;
};

type ChipData = {
  variant: Variant;
  icon: LucideIcon;
  label: string;
  sub?: string;
  status?: string;
  logoSrc?: string;
  logoDarkSrc?: string;
  handles: HandleSpec[];
  stage: 1 | 2 | 3 | 4;
  // Live state injected via useMemo on hover/reveal:
  activeStage?: number;
  hoveredId?: string | null;
  connected?: boolean;
};

type FlowEdgeData = {
  kind: "data" | "challenge" | "context" | "risk" | "out" | "debate";
  stage: 1 | 2 | 3 | 4;
  route?: Array<{ x: number; y: number }>;
  activeStage?: number;
  hoveredId?: string | null;
  connected?: boolean;
  sourceId?: string;
  targetId?: string;
};

// ----- Color palette -----

const STROKE = {
  data: "var(--color-primary)",
  challenge: "var(--color-bear)",
  context: "var(--color-violet)",
  risk: "var(--color-warn)",
  out: "var(--color-bull)",
  debate: "var(--color-bear)",
} as const;

// ----- Chip styles -----

const VARIANT_RING: Record<Variant, string> = {
  source: "ring-primary/35",
  worker: "ring-primary/35",
  critic: "ring-bear/45",
  context: "ring-violet/40",
  hub: "ring-primary/60",
  output: "ring-bull/45",
};

const VARIANT_BG: Record<Variant, string> = {
  source: "bg-card",
  worker: "bg-card",
  critic: "bg-bear/[0.04] dark:bg-bear/[0.08]",
  context: "bg-violet/[0.04] dark:bg-violet/[0.08]",
  hub: "bg-gradient-to-br from-primary via-primary to-violet",
  output: "bg-card",
};

const VARIANT_BORDER: Record<Variant, string> = {
  source: "border-slate-200 dark:border-border",
  worker: "border-slate-200 dark:border-border",
  critic: "border-bear/35",
  context: "border-violet/35",
  hub: "border-primary/40",
  output: "border-slate-200 dark:border-border",
};

// ----- ChipNode -----

function ChipNode({ data }: NodeProps<Node<ChipData>>) {
  const Icon = data.icon;
  const isHub = data.variant === "hub";
  const isOutput = data.variant === "output";

  const stageActive =
    data.activeStage === undefined || data.activeStage >= data.stage;
  const hoverDimmed =
    data.hoveredId !== null &&
    data.hoveredId !== undefined &&
    data.connected === false;
  const hoverHighlighted =
    data.hoveredId !== null &&
    data.hoveredId !== undefined &&
    data.connected === true;

  const width = isHub ? 280 : isOutput ? 280 : 250;

  return (
    <div
      className="relative transition-all duration-500"
      style={{
        width,
        opacity: stageActive ? (hoverDimmed ? 0.28 : 1) : 0,
        transform: stageActive ? "translateY(0)" : "translateY(8px)",
      }}
    >
      {/* Sentez radial glow */}
      {isHub && <span className="tf-sentez-glow" aria-hidden />}

      <div
        className={`relative flex items-center gap-3.5 rounded-2xl border px-4.5 py-3.5 transition-all duration-200 ${
          VARIANT_BORDER[data.variant]
        } ${VARIANT_BG[data.variant]} ${
          isHub ? "text-white" : "text-slate-900 dark:text-white"
        } ${
          hoverHighlighted
            ? `ring-2 ${VARIANT_RING[data.variant]} shadow-lg`
            : "ring-1 ring-black/[0.02] dark:ring-white/[0.04]"
        }`}
        style={{
          boxShadow: hoverHighlighted
            ? undefined
            : isHub
              ? "0 2px 4px rgba(37,99,235,0.18), 0 14px 36px -14px rgba(37,99,235,0.48)"
              : "0 1px 2px rgba(15,23,42,0.05), 0 10px 28px -18px rgba(15,23,42,0.2)",
        }}
      >
        {(data.handles ?? []).map((h) => (
          <Handle
            key={h.id}
            id={h.id}
            type={h.kind}
            position={h.side === "left" ? Position.Left : Position.Right}
            style={{
              top: h.topPct !== undefined ? `${h.topPct}%` : undefined,
              background: "transparent",
              border: "none",
            }}
          />
        ))}

        {/* Icon / logo */}
        {data.logoSrc ? (
          <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 dark:border-border bg-white p-1.5 shadow-inner">
            <Image
              src={data.logoSrc}
              alt=""
              width={44}
              height={44}
              className={`h-full w-full object-contain ${data.logoDarkSrc ? "dark:hidden" : ""}`}
            />
            {data.logoDarkSrc && (
              <Image
                src={data.logoDarkSrc}
                alt=""
                width={44}
                height={44}
                className="hidden h-full w-full object-contain dark:block"
              />
            )}
          </span>
        ) : (
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              isHub
                ? "bg-white/20 text-white ring-1 ring-white/30"
                : "border border-slate-200 dark:border-border bg-background text-slate-700 dark:text-text-2 shadow-inner"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
        )}

        {/* Text content */}
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className={`truncate text-[14px] font-semibold tracking-tight ${
              isHub ? "text-white" : ""
            }`}
          >
            {data.label}
          </div>
          {data.sub && (
            <div
              className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                isHub ? "text-white/70" : "text-muted-foreground"
              }`}
            >
              {data.sub}
            </div>
          )}
          {data.status && !isOutput && (
            <div
              className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${
                isHub ? "text-white/80" : "text-slate-600 dark:text-text-2"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  isHub
                    ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    : "bg-bull shadow-[0_0_6px_rgba(34,197,94,0.7)]"
                }`}
                style={{ animation: "tf-debate-pulse 2s ease-in-out infinite" }}
              />
              <span className="truncate">{data.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Output rozet bandı */}
      {isOutput && (
        <div className="mt-2 flex items-center justify-center gap-1.5 font-mono text-[10px]">
          <span className="rounded-md border border-bull/30 bg-bull/10 px-1.5 py-0.5 font-semibold text-bull">
            Bull
          </span>
          <span className="rounded-md border border-bear/30 bg-bear/10 px-1.5 py-0.5 font-semibold text-bear">
            Bear
          </span>
          <span className="rounded-md border border-violet/40 bg-violet/10 px-1.5 py-0.5 font-semibold text-violet">
            Kat
          </span>
          <span className="ml-1 text-muted-foreground">+ güven</span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { chip: ChipNode };

// ----- AnimatedFlowEdge -----

const orthogonalPath = (
  points: Array<{ x: number; y: number }>,
  radius = 26
) => {
  if (points.length < 2) return "";

  const commands = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];

    if (!next) {
      commands.push(`L ${current.x} ${current.y}`);
      continue;
    }

    const inDistance = Math.hypot(current.x - prev.x, current.y - prev.y);
    const outDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(radius, inDistance / 2, outDistance / 2);

    if (cornerRadius <= 0) {
      commands.push(`L ${current.x} ${current.y}`);
      continue;
    }

    const start = {
      x: current.x - ((current.x - prev.x) / inDistance) * cornerRadius,
      y: current.y - ((current.y - prev.y) / inDistance) * cornerRadius,
    };
    const end = {
      x: current.x + ((next.x - current.x) / outDistance) * cornerRadius,
      y: current.y + ((next.y - current.y) / outDistance) * cornerRadius,
    };

    commands.push(`L ${start.x} ${start.y}`);
    commands.push(`Q ${current.x} ${current.y} ${end.x} ${end.y}`);
  }

  return commands.join(" ");
};

function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const route = data?.route;
  const edgePath =
    route && route.length > 0
      ? orthogonalPath([
          { x: sourceX, y: sourceY },
          ...route,
          { x: targetX, y: targetY },
        ])
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 18,
        })[0];

  const kind = data?.kind ?? "data";
  const color = STROKE[kind];

  const stageActive =
    data?.activeStage === undefined ||
    data?.stage === undefined ||
    data.activeStage >= data.stage;
  const hovered = data?.hoveredId != null;
  const isConnected = data?.connected === true;
  const isDimmed = hovered && !isConnected;

  const opacity = stageActive ? (isDimmed ? 0.12 : isConnected ? 1 : 0.85) : 0;
  const strokeWidth = isConnected ? 2.6 : 1.8;
  const particleDur = isConnected ? "1.6s" : "3.2s";

  return (
    <g style={{ transition: "opacity 400ms ease" }} opacity={opacity}>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ transition: "stroke-width 200ms ease" }}
      />
      {stageActive && (
        <>
          <circle r={2.6} fill={color} opacity={0.95}>
            <animateMotion dur={particleDur} repeatCount="indefinite" begin="0s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          <circle r={2} fill={color} opacity={0.5}>
            <animateMotion
              dur={particleDur}
              repeatCount="indefinite"
              begin="0.55s"
            >
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
        </>
      )}
    </g>
  );
}

// ----- DebateEdge (curved + 💬 badge) -----

function DebateEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.55,
  });

  const color = STROKE.debate;
  const stageActive =
    data?.activeStage === undefined ||
    data?.stage === undefined ||
    data.activeStage >= data.stage;
  const hovered = data?.hoveredId != null;
  const isConnected = data?.connected === true;
  const isDimmed = hovered && !isConnected;
  const opacity = stageActive ? (isDimmed ? 0.12 : isConnected ? 1 : 0.85) : 0;
  const strokeWidth = isConnected ? 2.6 : 1.8;

  return (
    <g style={{ transition: "opacity 400ms ease" }} opacity={opacity}>
      <defs>
        <marker
          id={`${id}-arrow-end`}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L8,5 L0,10 Z" fill={color} />
        </marker>
        <marker
          id={`${id}-arrow-start`}
          viewBox="0 0 10 10"
          refX="4"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M10,0 L2,5 L10,10 Z" fill={color} />
        </marker>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray="5 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        markerStart={`url(#${id}-arrow-start)`}
        markerEnd={`url(#${id}-arrow-end)`}
        style={{ transition: "stroke-width 200ms ease" }}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-20"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

const edgeTypes = {
  flow: AnimatedFlowEdge,
  debate: DebateEdge,
};

// ----- Layout (flow-space px) -----

const X = { src: 40, work: 440, crit: 840, hub: 1240, out: 1580 };
const Y_SRC = [40, 160, 280, 400, 520];
const Y_WORK = [70, 220, 370, 520];
const Y_CRIT = [40, 335, 560];
const Y_HUB = 315;
const Y_OUT = 315;

// Stage column percentage positions inside the React Flow viewport.
// Tuned to the fitted flow bounds so labels sit above their node columns.
const STAGES = [
  { id: 1, label: "01 — Veri", sub: "Borsa, KAP, TCMB, Haber, MKK", pct: 12.2 },
  { id: 2, label: "02 — Analiz", sub: "4 uzman ajan", pct: 31.4 },
  {
    id: 3,
    label: "03 — Tartışma & Bağlam",
    sub: "Şeytan, Bellek, Risk",
    pct: 50.7,
  },
  { id: 4, label: "04 — Sentez", sub: "Konsensüs + tez", pct: 75.2 },
] as const;
const DIVIDER_PCT = [23.0, 43.7, 64.7];

// ----- Node helpers -----

const chip = (
  id: string,
  x: number,
  y: number,
  data: ChipData
): Node<ChipData> => ({
  id,
  type: "chip",
  position: { x, y },
  data,
  draggable: false,
  selectable: false,
  connectable: false,
});

const H_SRC_OUT: HandleSpec = { kind: "source", side: "right", id: "out" };
const H_TGT_IN: HandleSpec = { kind: "target", side: "left", id: "in" };

// ----- Base nodes -----

const BASE_NODES: Node<ChipData>[] = [
  // --- Stage 1: data sources ---
  chip("kap", X.src, Y_SRC[0], {
    variant: "source",
    icon: Newspaper,
    label: "KAP",
    sub: "Bildirim",
    status: "canlı · stream",
    logoSrc: "/logos/kap-logo.jpeg",
    handles: [H_SRC_OUT],
    stage: 1,
  }),
  chip("bist", X.src, Y_SRC[1], {
    variant: "source",
    icon: Newspaper,
    label: "Borsa İstanbul",
    sub: "Seans",
    status: "canlı · OHLCV",
    logoSrc: "/logos/borsa-istanbul-logo.png",
    handles: [H_SRC_OUT],
    stage: 1,
  }),
  chip("tcmb", X.src, Y_SRC[2], {
    variant: "source",
    icon: Newspaper,
    label: "TCMB EVDS",
    sub: "Makro",
    status: "günlük · 12 seri",
    logoSrc: "/logos/TCMB_logo.svg",
    handles: [H_SRC_OUT],
    stage: 1,
  }),
  chip("news", X.src, Y_SRC[3], {
    variant: "source",
    icon: Newspaper,
    label: "Haber akışı",
    sub: "TR-tr",
    status: "canlı · 40+ kaynak",
    handles: [H_SRC_OUT],
    stage: 1,
  }),
  chip("mkk", X.src, Y_SRC[4], {
    variant: "source",
    icon: Newspaper,
    label: "MKK",
    sub: "Olay",
    status: "canlı · kurumsal",
    logoSrc: "/logos/MKK-EN-Dikey-Logo-Siyah.png",
    handles: [H_SRC_OUT],
    stage: 1,
  }),

  // --- Stage 2: workers ---
  chip("fundamental", X.work, Y_WORK[0], {
    variant: "worker",
    icon: AGENT_ICON_MAP[findAgent("fundamental").icon],
    label: findAgent("fundamental").name,
    sub: "Bilanço",
    status: "4 metrik · DCF",
    handles: [
      { kind: "target", side: "left", id: "in", topPct: 50 },
      { kind: "source", side: "right", id: "out", topPct: 30 },
      { kind: "source", side: "right", id: "out-debate", topPct: 70 },
      { kind: "target", side: "right", id: "in-debate", topPct: 80 },
    ],
    stage: 2,
  }),
  chip("technical", X.work, Y_WORK[1], {
    variant: "worker",
    icon: AGENT_ICON_MAP[findAgent("technical").icon],
    label: findAgent("technical").name,
    sub: "Momentum",
    status: "6 sinyal · RSI/MACD",
    handles: [
      { kind: "target", side: "left", id: "in", topPct: 50 },
      { kind: "source", side: "right", id: "out", topPct: 30 },
      { kind: "source", side: "right", id: "out-debate", topPct: 70 },
      { kind: "target", side: "right", id: "in-debate", topPct: 20 },
    ],
    stage: 2,
  }),
  chip("sentiment", X.work, Y_WORK[2], {
    variant: "worker",
    icon: AGENT_ICON_MAP[findAgent("sentiment").icon],
    label: findAgent("sentiment").name,
    sub: "Sentiment",
    status: "12 doküman · TR-NLP",
    handles: [H_TGT_IN, H_SRC_OUT],
    stage: 2,
  }),
  chip("catalyst", X.work, Y_WORK[3], {
    variant: "worker",
    icon: AGENT_ICON_MAP[findAgent("catalyst").icon],
    label: findAgent("catalyst").name,
    sub: "Olay",
    status: "3 katalist",
    handles: [
      { kind: "target", side: "left", id: "in", topPct: 30 },
      { kind: "target", side: "left", id: "in-mkk", topPct: 70 },
      H_SRC_OUT,
    ],
    stage: 2,
  }),

  // --- Stage 3: critic + context ---
  chip("devil", X.crit, Y_CRIT[0], {
    variant: "critic",
    icon: AGENT_ICON_MAP[findAgent("devil").icon],
    label: findAgent("devil").name,
    sub: "Karşıt tez",
    status: "tartışma aktif",
    handles: [
      { kind: "target", side: "left", id: "debate-fund", topPct: 38 },
      { kind: "target", side: "left", id: "debate-tech", topPct: 78 },
      { kind: "source", side: "right", id: "out", topPct: 50 },
    ],
    stage: 3,
  }),
  chip("memory", X.crit, Y_CRIT[1], {
    variant: "context",
    icon: AGENT_ICON_MAP[findAgent("memory").icon],
    label: findAgent("memory").name,
    sub: "Benzer geçmiş",
    status: "5 benzer dönem",
    handles: [H_SRC_OUT],
    stage: 3,
  }),
  chip("risk", X.crit, Y_CRIT[2], {
    variant: "context",
    icon: AGENT_ICON_MAP[findAgent("risk").icon],
    label: findAgent("risk").name,
    sub: "Risk profili",
    status: "3 risk · 1 uyarı",
    handles: [H_SRC_OUT],
    stage: 3,
  }),

  // --- Stage 4: hub + output ---
  chip("sentez", X.hub, Y_HUB, {
    variant: "hub",
    icon: Sparkles,
    label: "Sentez",
    sub: "Konsensüs",
    status: "8 ajan · kalibre",
    handles: [
      { kind: "target", side: "left", id: "in-fund", topPct: 14 },
      { kind: "target", side: "left", id: "in-tech", topPct: 28 },
      { kind: "target", side: "left", id: "in-sent", topPct: 42 },
      { kind: "target", side: "left", id: "in-cat", topPct: 56 },
      { kind: "target", side: "left", id: "in-devil", topPct: 70 },
      { kind: "target", side: "left", id: "in-mem", topPct: 84 },
      { kind: "target", side: "left", id: "in-risk", topPct: 96 },
      { kind: "source", side: "right", id: "out", topPct: 50 },
    ],
    stage: 4,
  }),
  chip("output", X.out, Y_OUT, {
    variant: "output",
    icon: Sparkles,
    label: "Gerekçeli tez",
    sub: "rapor",
    handles: [H_TGT_IN],
    stage: 4,
  }),
];

// ----- Base edges -----

const fe = (
  id: string,
  source: string,
  target: string,
  kind: FlowEdgeData["kind"],
  stage: 1 | 2 | 3 | 4,
  opts: {
    sourceHandle?: string;
    targetHandle?: string;
    route?: FlowEdgeData["route"];
  } = {}
): Edge<FlowEdgeData> => ({
  id,
  source,
  target,
  type: kind === "debate" ? "debate" : "flow",
  data: { kind, stage, route: opts.route, sourceId: source, targetId: target },
  sourceHandle: opts.sourceHandle,
  targetHandle: opts.targetHandle,
});

const BASE_EDGES: Edge<FlowEdgeData>[] = [
  // Stage 2 inflows (sources → workers)
  fe("kap→fund", "kap", "fundamental", "data", 2, { targetHandle: "in" }),
  fe("tcmb→fund", "tcmb", "fundamental", "data", 2, { targetHandle: "in" }),
  fe("bist→tech", "bist", "technical", "data", 2, { targetHandle: "in" }),
  fe("news→sent", "news", "sentiment", "data", 2),
  fe("kap→cat", "kap", "catalyst", "data", 2, { targetHandle: "in" }),
  fe("mkk→cat", "mkk", "catalyst", "data", 2, { targetHandle: "in-mkk" }),

  // Stage 3 debate loops (bidirectional, single curved edge with badge)
  fe("debate:fund↔devil", "fundamental", "devil", "debate", 3, {
    sourceHandle: "out-debate",
    targetHandle: "debate-fund",
  }),
  fe("debate:tech↔devil", "technical", "devil", "debate", 3, {
    sourceHandle: "out-debate",
    targetHandle: "debate-tech",
  }),

  // Stage 4: workers → sentez
  fe("fund→sen", "fundamental", "sentez", "data", 4, {
    sourceHandle: "out",
    targetHandle: "in-fund",
    route: [
      { x: 760, y: 98 },
      { x: 760, y: 270 },
      { x: 1210, y: 270 },
    ],
  }),
  fe("tech→sen", "technical", "sentez", "data", 4, {
    sourceHandle: "out",
    targetHandle: "in-tech",
    route: [
      { x: 800, y: 248 },
      { x: 800, y: 290 },
      { x: 1210, y: 290 },
    ],
  }),
  fe("sent→sen", "sentiment", "sentez", "data", 4, {
    targetHandle: "in-sent",
    route: [
      { x: 760, y: 398 },
      { x: 760, y: 315 },
      { x: 1210, y: 315 },
    ],
  }),
  fe("cat→sen", "catalyst", "sentez", "data", 4, {
    targetHandle: "in-cat",
    route: [
      { x: 760, y: 548 },
      { x: 760, y: 448 },
      { x: 1210, y: 448 },
    ],
  }),

  // Stage 4: critic + context → sentez
  fe("devil→sen", "devil", "sentez", "challenge", 4, {
    sourceHandle: "out",
    targetHandle: "in-devil",
    route: [
      { x: 1180, y: 70 },
      { x: 1180, y: 365 },
    ],
  }),
  fe("mem→sen", "memory", "sentez", "context", 4, {
    targetHandle: "in-mem",
    route: [
      { x: 1140, y: 365 },
      { x: 1140, y: 392 },
    ],
  }),
  fe("risk→sen", "risk", "sentez", "risk", 4, {
    targetHandle: "in-risk",
    route: [
      { x: 1100, y: 590 },
      { x: 1100, y: 420 },
      { x: 1210, y: 420 },
    ],
  }),

  // Stage 4: sentez → output
  fe("sen→out", "sentez", "output", "out", 4, {
    route: [{ x: 1530, y: 345 }],
  }),
];

// ----- Stage reveal hook -----

function useStageReveal(ref: React.RefObject<HTMLElement | null>) {
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timers = [
      setTimeout(() => setStage(1), 80),
      setTimeout(() => setStage(2), 380),
      setTimeout(() => setStage(3), 680),
      setTimeout(() => setStage(4), 980),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return stage;
}

// ----- Connected-set helper -----

function useConnectedSets(hoveredId: string | null) {
  return useMemo(() => {
    if (!hoveredId) {
      return {
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
      };
    }
    const nodeIds = new Set<string>([hoveredId]);
    const edgeIds = new Set<string>();
    for (const e of BASE_EDGES) {
      if (e.source === hoveredId || e.target === hoveredId) {
        edgeIds.add(e.id);
        nodeIds.add(e.source);
        nodeIds.add(e.target);
      }
    }
    return { nodeIds, edgeIds };
  }, [hoveredId]);
}

// ----- Stage rail -----

function StageRail({ activeStage }: { activeStage: number }) {
  return (
    <div className="tf-stage-rail relative mx-auto h-[86px] w-full max-w-[1360px]">
      <div className="absolute left-[8%] right-[8%] top-[43px] h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent dark:via-border" />
      {STAGES.map((s, i) => {
        const active = activeStage >= s.id;
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{
              opacity: active ? 1 : 0.25,
              y: active ? 0 : -4,
            }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="pointer-events-none absolute top-2 -translate-x-1/2"
            style={{ left: `${s.pct}%` }}
          >
            <div
              className={`flex flex-col items-center gap-1 rounded-2xl border px-4 py-2 backdrop-blur-sm transition-colors ${
                s.id === 4
                  ? "border-primary/40 bg-gradient-to-r from-primary/10 via-violet/10 to-primary/10"
                  : active
                    ? "border-slate-200/80 bg-background/85 dark:border-border dark:bg-background/60"
                    : "border-slate-200/40 bg-background/45 dark:bg-background/30"
              }`}
            >
              <span
                className={`absolute -bottom-[18px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border ${
                  active
                    ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                    : "border-slate-300 bg-background dark:border-border"
                }`}
              />
              <div
                className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  s.id === 4
                    ? "text-primary dark:text-primary"
                    : "text-slate-700 dark:text-text-2"
                }`}
              >
                {s.label}
              </div>
              <div className="text-[9.5px] text-muted-foreground">{s.sub}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ----- Lane dividers overlay -----

function LaneDividers() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {DIVIDER_PCT.map((pct, i) => (
        <div
          key={i}
          className="tf-stage-divider absolute top-8 bottom-8 w-px"
          style={{ left: `${pct}%` }}
        />
      ))}
    </div>
  );
}

// ----- Legend -----

function LegendDot({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-slate-600 dark:text-text-2">
      <span
        className="inline-block h-2.5 w-4 rounded"
        style={{ background: color }}
      />
      {children}
    </span>
  );
}

// ----- Main -----

export function AgentShowcase() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const activeStage = useStageReveal(diagramRef);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { nodeIds, edgeIds } = useConnectedSets(hoveredId);

  const nodes = useMemo<Node<ChipData>[]>(
    () =>
      BASE_NODES.map((n) => ({
        ...n,
        data: {
          ...n.data,
          activeStage,
          hoveredId,
          connected: hoveredId === null ? undefined : nodeIds.has(n.id),
        },
      })),
    [activeStage, hoveredId, nodeIds]
  );

  const edges = useMemo<Edge<FlowEdgeData>[]>(
    () =>
      BASE_EDGES.map((e) => ({
        ...e,
        data: {
          ...e.data!,
          activeStage,
          hoveredId,
          connected: hoveredId === null ? undefined : edgeIds.has(e.id),
        },
      })),
    [activeStage, hoveredId, edgeIds]
  );

  return (
    <section
      id="ajanlar"
      className="relative border-b border-slate-200 dark:border-border/60"
    >
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 md:py-24">
        <SectionHeader
          kicker="Komite"
          title="8 ajan. Veri çekme, tartışma, sentez."
          subtitle="Veri kaynakları workerlara akar, Şeytan Avukatı Temel & Teknik ajanların teziyle tartışır, Bellek ve Risk bağlam sağlar, Sentez hepsini kalibre eder. Aşağıda komitenin canlı haberleşme şeması."
        />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <LegendDot color={STROKE.data}>Veri / analiz akışı</LegendDot>
          <LegendDot color={STROKE.challenge}>Karşıt tez (Devil)</LegendDot>
          <LegendDot color={STROKE.context}>Bağlam (Bellek)</LegendDot>
          <LegendDot color={STROKE.risk}>Risk uyarısı</LegendDot>
          <LegendDot color={STROKE.out}>Nihai tez</LegendDot>
        </div>

        {/* Desktop diagram */}
        <div
          ref={diagramRef}
          className="mt-8 hidden md:block"
        >
          <StageRail activeStage={activeStage} />
          <div
            className="tf-flow tf-flow-v2 tf-flow-open relative overflow-hidden"
            style={{ height: 760 }}
          >
            <LaneDividers />
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              panOnScroll={false}
              panOnDrag={false}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
              fitViewOptions={{ padding: 0.06 }}
              onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
              onNodeMouseLeave={() => setHoveredId(null)}
            />
          </div>
        </div>

        {/* Mobile fallback */}
        <div className="mt-10 grid grid-cols-1 gap-2 md:hidden">
          {AGENT_REGISTRY.filter((a) => a.id !== "synthesizer").map((agent) => {
            const Icon = AGENT_ICON_MAP[agent.icon] ?? Sparkles;
            return (
              <div
                key={agent.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-border bg-card px-3 py-2.5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-border bg-background text-slate-700 dark:text-text-2">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {agent.name}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {agent.role}
                  </div>
                </div>
                <span className="font-mono text-muted-foreground">↓</span>
              </div>
            );
          })}
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                Sentez
              </div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Konsensüs + güven
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

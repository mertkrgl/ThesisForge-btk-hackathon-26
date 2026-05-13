import { AGENT_REGISTRY } from "@/lib/mock/agents";
import { cn } from "@/lib/utils";
import type { AgentTone } from "@/lib/mock/types";

const FEED = [
  { agent: "synthesizer", action: "TUPRS sentezi yayınlandı", time: "2 dk", confidence: 67 },
  { agent: "fundamental", action: "ASELS bilanço analizi tamamlandı", time: "14 dk", confidence: 72 },
  { agent: "risk", action: "EREGL volatilite uyarısı", time: "31 dk", confidence: 60 },
  { agent: "catalyst", action: "THYAO yaz trafik katalisti eklendi", time: "1 sa", confidence: 70 },
  { agent: "memory", action: "Benzer marj toparlanma örneği işaretlendi", time: "1 sa", confidence: 62 },
  { agent: "devil", action: "BIMAS marj baskısı argümanı eklendi", time: "2 sa", confidence: 54 },
  { agent: "sentiment", action: "Haber akışı duygu skoru güncellendi", time: "3 sa", confidence: 55 },
  { agent: "technical", action: "TUPRS 20G EMA testi geçildi", time: "4 sa", confidence: 58 },
];

const TONE_DOT: Record<AgentTone, string> = {
  bull: "bg-bull",
  bear: "bg-bear",
  warn: "bg-warn",
  violet: "bg-violet",
  cyan: "bg-cyan",
  primary: "bg-primary",
};

export function AgentActivityFeed() {
  return (
    <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,#0C1428,#0A1122)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-white">Ajan Aktivitesi</h2>
        <span className="text-[11px] text-muted-foreground">son 4 saat</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {FEED.map((f, i) => {
          const meta = AGENT_REGISTRY.find((a) => a.id === f.agent);
          if (!meta) return null;
          return (
            <li
              key={i}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.02]"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  TONE_DOT[meta.tone]
                )}
              />
              <span className="text-[12px] font-semibold text-white">
                {meta.name}
              </span>
              <span className="truncate text-[12px] text-text-2">
                {f.action}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">
                {f.time}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

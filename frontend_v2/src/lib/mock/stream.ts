import type { StreamEvent } from "./types";

const tok = (
  offset: number,
  agentId: string,
  payload: string
): StreamEvent => ({ offset, type: "token", agentId, payload });

export const MOCK_STREAM_SCRIPT: StreamEvent[] = [
  { offset: 0, type: "phase", phase: "Yönlendirme" },
  { offset: 200, type: "agent_start", agentId: "technical" },
  tok(400, "technical", "TUPRS 168 TL üzerinde "),
  tok(900, "technical", "20 günlük EMA testi tamamlandı."),
  tok(1400, "technical", " RSI 58, "),
  tok(1700, "technical", "momentum nötr-pozitif."),
  { offset: 1900, type: "source", agentId: "technical", payload: "BIST-PX" },
  { offset: 2000, type: "confidence", payload: 38 },
  { offset: 2100, type: "phase", phase: "Müzakere" },
  { offset: 2200, type: "agent_start", agentId: "fundamental" },
  tok(2400, "fundamental", "FAVÖK marjı %14.2, "),
  tok(2900, "fundamental", "3Ç bilançosu beklentinin %6 üzerinde."),
  tok(3400, "fundamental", " Net borç/FAVÖK 1.1x"),
  { offset: 3600, type: "source", agentId: "fundamental", payload: "KAP-24Q3" },
  { offset: 3700, type: "confidence", payload: 58 },
  { offset: 3800, type: "agent_start", agentId: "devil" },
  tok(4000, "devil", "Ürün spread'leri "),
  tok(4400, "devil", "global resesyon senaryosunda zayıflayabilir."),
  tok(4900, "devil", " 4Ç'de tek seferlik kalem riski."),
  { offset: 5100, type: "source", agentId: "devil", payload: "IEA-OutlookQ4" },
  { offset: 5200, type: "confidence", payload: 54 },
  { offset: 5300, type: "agent_start", agentId: "synthesizer" },
  tok(5500, "synthesizer", "Bull/bear dengelendi, "),
  tok(5900, "synthesizer", "katalist takvimi öne çıkıyor."),
  tok(6300, "synthesizer", " Net pozisyon: tutmaya değer."),
  { offset: 6500, type: "confidence", payload: 67 },
  { offset: 6700, type: "agent_done", agentId: "synthesizer" },
  { offset: 6900, type: "done" },
];

export type MockStreamHandle = { stop: () => void };

export function createMockThesisStream(
  onEvent: (e: StreamEvent) => void,
  opts: { loop?: boolean; speed?: number } = {}
): MockStreamHandle {
  const { loop = false, speed = 1 } = opts;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;

  const runOnce = () => {
    MOCK_STREAM_SCRIPT.forEach((evt) => {
      const t = setTimeout(() => {
        if (stopped) return;
        onEvent(evt);
      }, evt.offset / speed);
      timers.push(t);
    });
    if (loop) {
      const restart = setTimeout(
        () => {
          if (stopped) return;
          runOnce();
        },
        (MOCK_STREAM_SCRIPT[MOCK_STREAM_SCRIPT.length - 1].offset + 1800) /
          speed
      );
      timers.push(restart);
    }
  };

  runOnce();

  return {
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
    },
  };
}

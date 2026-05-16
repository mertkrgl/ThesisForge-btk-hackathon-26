import type { Verdict } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const MAP: Record<
  Verdict,
  { label: string; cls: string }
> = {
  bull: {
    label: "Pozitif",
    cls: "bg-bull/15 text-[#86EFAC] border-bull/30",
  },
  bear: {
    label: "Negatif",
    cls: "bg-bear/15 text-[#FCA5A5] border-bear/30",
  },
  neutral: {
    label: "Nötr",
    cls: "bg-warn/15 text-warn border-warn/30",
  },
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: Verdict;
  className?: string;
}) {
  const { label, cls } = MAP[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider",
        cls,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

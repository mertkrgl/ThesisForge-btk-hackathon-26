import { cn } from "@/lib/utils";

export function ConfidenceBar({
  value,
  label = "Güven Skoru",
  size = "md",
  className,
}: {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const h = size === "sm" ? "h-1" : size === "lg" ? "h-2.5" : "h-1.5";
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[12px] font-semibold text-slate-900">
          {Math.round(value).toString().padStart(2, "0")}%
        </span>
      </div>
      <div className={cn("mt-1.5 w-full overflow-hidden rounded-full bg-line/60", h)}>
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#3B82F6,#A78BFA,#22D3EE)] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

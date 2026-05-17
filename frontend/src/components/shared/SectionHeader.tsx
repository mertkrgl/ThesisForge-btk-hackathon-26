import { cn } from "@/lib/utils";

export function SectionHeader({
  kicker,
  title,
  subtitle,
  align = "center",
  kickerTone = "violet",
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  kickerTone?: "violet" | "cyan" | "primary" | "warn";
}) {
  const toneClass =
    kickerTone === "cyan"
      ? "text-cyan"
      : kickerTone === "primary"
        ? "text-primary"
        : kickerTone === "warn"
          ? "text-warn"
          : "text-violet";

  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left"
      )}
    >
      {kicker && (
        <div
          className={cn(
            "text-[10.5px] font-semibold uppercase tracking-[0.18em]",
            toneClass
          )}
        >
          {kicker}
        </div>
      )}
      <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-[14px] leading-relaxed text-text-2">
          {subtitle}
        </p>
      )}
    </div>
  );
}

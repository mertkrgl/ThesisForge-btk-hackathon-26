import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperItem = {
  id: string;
  label: string;
};

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: StepperItem[];
  current: string;
  className?: string;
}) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-2",
        className
      )}
    >
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              done && "border-bull/30 bg-bull/10 text-[#86EFAC]",
              active &&
                "border-primary/40 bg-primary/10 text-slate-900 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]",
              !done && !active && "border-line bg-card text-muted-foreground"
            )}
          >
            <span className="grid h-4 w-4 place-items-center rounded-full bg-current/10">
              {done ? (
                <Check className="h-3 w-3" />
              ) : active ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-current"
                  style={{
                    animation: "tf-pulse-dot 1.4s ease-in-out infinite",
                  }}
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              )}
            </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

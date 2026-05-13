import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const icon =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "grid place-items-center rounded-lg bg-[radial-gradient(120%_120%_at_20%_0%,#3B82F6_0%,#1D4ED8_50%,#0B1220_100%)] shadow-[0_6px_20px_-8px_#3B82F6,inset_0_0_0_1px_#2A4D9C]",
          sz
        )}
      >
        <Sparkles className={cn("text-white", icon)} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-extrabold tracking-tight text-white">
          ThesisForge
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Yatırım Komitesi
        </span>
      </div>
    </div>
  );
}

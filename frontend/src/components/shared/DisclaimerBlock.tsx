import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DisclaimerBlock({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-warn/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.10),rgba(245,158,11,0.04))] p-4 text-warn-2",
        className
      )}
      role="note"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <div className="text-[12.5px] leading-relaxed text-text-2">
        <span className="font-semibold text-warn">
          Yatırım tavsiyesi değildir.
        </span>{" "}
        ThesisForge, çok ajanlı yapay zekâ ile{" "}
        <span className="text-white">karar destek</span> sağlar; al/sat sinyali
        üretmez. Üretilen tezler, kaynak bağlantılarıyla birlikte sunulan
        analizlerdir.{" "}
        {!compact && (
          <>
            Yatırım kararlarınızdan yalnızca siz sorumlusunuz. Geçmiş performans,
            gelecekteki sonuçların garantisi değildir.
          </>
        )}
      </div>
    </div>
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
  showSubtitle = true,
  markOnly = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  markOnly?: boolean;
}) {
  const markSize =
    size === "sm" ? "h-12 w-12" : size === "lg" ? "h-16 w-16" : "h-14 w-14";
  const textSize =
    size === "sm" ? "text-[16px]" : size === "lg" ? "text-[19px]" : "text-[18px]";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "relative grid shrink-0 place-items-center",
          markSize,
        )}
      >
        <Image
          src="/logos/tf-black-logo.svg"
          alt=""
          width={48}
          height={48}
          className="h-full w-full scale-[1.35] object-contain dark:hidden"
        />
        <Image
          src="/logos/tf-white-logo.svg"
          alt=""
          width={48}
          height={48}
          className="hidden h-full w-full scale-[1.35] object-contain dark:block"
        />
      </span>
      {!markOnly && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              "font-extrabold tracking-tight text-slate-900 dark:text-white",
              textSize,
            )}
          >
            ThesisForge
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Yatırım Komitesi
            </span>
          )}
        </div>
      )}
    </div>
  );
}

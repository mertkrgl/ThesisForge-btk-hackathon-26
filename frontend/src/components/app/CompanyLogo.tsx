import { cn } from "@/lib/utils";

type CompanyLogoProps = {
  ticker: string;
  company?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-8 w-8 rounded-lg text-[10px]",
  md: "h-10 w-10 rounded-xl text-[12px]",
  lg: "h-12 w-12 rounded-xl text-[14px]",
};

export function CompanyLogo({
  ticker,
  company,
  size = "md",
  className,
}: CompanyLogoProps) {
  const normalizedTicker = ticker.trim().toUpperCase();

  return (
    <span
      aria-label={company ? `${company} simgesi` : `${normalizedTicker} simgesi`}
      className={cn(
        "grid shrink-0 place-items-center bg-[linear-gradient(135deg,#3B82F6,#A78BFA)] font-mono font-bold text-white",
        sizeClass[size],
        className
      )}
    >
      {normalizedTicker.slice(0, 2)}
    </span>
  );
}

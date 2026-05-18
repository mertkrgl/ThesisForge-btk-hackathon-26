"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"] as const;

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

const pixelSize = {
  sm: 32,
  md: 40,
  lg: 48,
};

export function CompanyLogo({
  ticker,
  company,
  size = "md",
  className,
}: CompanyLogoProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const [attempt, setAttempt] = useState(0);

  const sources = useMemo(
    () =>
      EXTENSIONS.map(
        (extension) => `/company-logos/${normalizedTicker}.${extension}`
      ),
    [normalizedTicker]
  );

  if (!normalizedTicker || attempt >= sources.length) {
    return (
      <span
        aria-label={company ? `${company} logosu` : `${normalizedTicker} logosu`}
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

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden border border-border bg-white p-1.5",
        sizeClass[size],
        className
      )}
    >
      <Image
        src={sources[attempt]}
        alt={company ? `${company} logosu` : `${normalizedTicker} logosu`}
        width={pixelSize[size]}
        height={pixelSize[size]}
        className="h-full w-full object-contain"
        onError={() => setAttempt((current) => current + 1)}
      />
    </span>
  );
}

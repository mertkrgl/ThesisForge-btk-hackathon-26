"use client";

import { BrainCircuit } from "lucide-react";

export function ThesisSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <BrainCircuit className="h-5 w-5 animate-pulse text-primary" />
        </div>
        <div>
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      
      <div className="mt-6 space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
      </div>
      
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded bg-[#089981]/20" />
          <div className="h-5 w-16 animate-pulse rounded bg-[#f23645]/20" />
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-primary/70">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
        </span>
        Yapay Zeka Analiz Ediyor...
      </div>
    </div>
  );
}

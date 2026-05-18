"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Breadcrumbs } from "@/components/app/Breadcrumbs";
import { CommandPalette } from "@/components/app/CommandPalette";
import { UserMenu } from "@/components/app/UserMenu";

export function Topbar() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[60px] items-center gap-2 border-b border-slate-200 bg-card/90 px-4 backdrop-blur-md dark:border-border dark:bg-[rgba(7,10,18,0.78)] sm:gap-3.5 sm:px-6">
        <Link
          href="/app"
          aria-label="ThesisForge"
          className="flex items-center gap-2 md:hidden"
        >
          <span className="text-[14px] font-extrabold tracking-tight">
            ThesisForge
          </span>
        </Link>

        <div className="hidden md:block">
          <Breadcrumbs />
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Arama"
          className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] dark:border-border dark:bg-muted dark:text-dim dark:hover:border-border dark:hover:text-white md:w-[320px]"
        >
          <Search className="h-4 w-4" />
          <span className="hidden flex-1 text-left text-muted-foreground md:inline">
            Sembol, sektör veya tez ara…
          </span>
          <span className="hidden rounded border border-slate-300 bg-slate-100 px-1.5 py-px font-mono text-[10.5px] text-slate-500 dark:border-border dark:bg-[#1A243F] dark:text-muted-foreground md:inline">
            ⌘K
          </span>
        </button>

        <div className="hidden h-[22px] w-px bg-line md:block" />

        <UserMenu />
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

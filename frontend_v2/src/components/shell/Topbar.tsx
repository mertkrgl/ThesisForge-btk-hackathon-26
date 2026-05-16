"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Breadcrumbs } from "@/components/app/Breadcrumbs";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationPanel } from "@/components/app/NotificationPanel";
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
      <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3.5 border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md">
        <Breadcrumbs />

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto flex w-[320px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left text-muted-foreground">
            Sembol, sektör veya tez ara…
          </span>
          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-px font-mono text-[10.5px] text-slate-500">
            ⌘K
          </span>
        </button>

        <div className="h-[22px] w-px bg-line" />

        <NotificationPanel />
        <UserMenu />
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

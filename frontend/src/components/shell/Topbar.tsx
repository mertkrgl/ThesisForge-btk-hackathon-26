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
      <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3.5 border-b border-line bg-[rgba(7,10,18,0.78)] px-6 backdrop-blur-md">
        <Breadcrumbs />

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto flex w-[320px] items-center gap-2 rounded-lg border border-line bg-[#0E1830] px-2.5 py-1.5 text-[13px] text-dim transition-colors hover:border-line-2 hover:text-white focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left text-muted-foreground">
            Sembol, sektör veya tez ara…
          </span>
          <span className="rounded border border-line-2 bg-[#1A243F] px-1.5 py-px font-mono text-[10.5px] text-muted-foreground">
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

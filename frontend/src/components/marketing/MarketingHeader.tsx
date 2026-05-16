"use client";

import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useState, useEffect } from "react";

const NAV = [
  { label: "Ürün", href: "#urun" },
  { label: "Ajanlar", href: "#ajanlar" },
  { label: "Nasıl Çalışır", href: "#nasil-calisir" },
  { label: "Veri Kaynakları", href: "#kaynaklar" },
];

export function MarketingHeader() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(`#${entry.target.id}`);
          }
        });
      },
      {
        rootMargin: "-100px 0px -40% 0px", // Trigger when section is in the top-middle of the viewport
      }
    );

    NAV.forEach((item) => {
      const el = document.querySelector(item.href);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 glass-strong">
      <div className="mx-auto flex h-[64px] w-full max-w-[1280px] items-center gap-6 px-6">
        <Link href="/" className="flex items-center">
          <Logo size="sm" />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const isActive = activeSection === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/[0.03] hover:text-white ${
                  isActive ? "bg-white/10 text-white" : "text-text-2"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden h-9 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:border-line-2 hover:text-white sm:inline-flex"
          >
            <GitBranch className="h-3.5 w-3.5" />
            GitHub
          </a>
          <Link
            href="/app"
            className="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_#3B82F6] transition-all hover:bg-[#2563EB]"
          >
            Uygulamayı Aç
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

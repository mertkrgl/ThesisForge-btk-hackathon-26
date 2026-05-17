"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.69-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.51-1.47.11-3.07 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.6.23 2.78.11 3.07.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useState, useEffect } from "react";

const NAV = [
  { label: "Özellikler", href: "#urun" },
  { label: "Kimler İçin", href: "#personalar" },
  { label: "Ajanlar", href: "#ajanlar" },
  { label: "Nasıl Çalışır", href: "#nasil-calisir" },
  { label: "S.S.S.", href: "#sss" },
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
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto grid h-[72px] w-full max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-6">
        <Link
          href="/"
          className="flex items-center text-[15.5px] font-bold tracking-[-0.01em] text-slate-900 dark:text-white"
        >
          ThesisForge
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const isActive = activeSection === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-md px-3.5 py-2 text-[13.5px] font-semibold tracking-tight transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white ${
                  isActive
                    ? "bg-blue-50 dark:bg-white/10 text-blue-700 dark:text-white"
                    : "text-slate-600 dark:text-text-2"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2.5">
          <a
            href="https://github.com/mertkrgl/btk-hackathon-26"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-border bg-card dark:bg-accent/50 text-slate-600 dark:text-text-2 transition-colors hover:border-slate-300 dark:hover:border-border hover:text-slate-900 dark:hover:text-white sm:inline-flex"
          >
            <GithubMark className="h-[18px] w-[18px]" />
          </a>
          <ThemeToggle />
          <Link
            href="/app"
            className="group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[14px] font-bold tracking-tight text-primary-foreground transition-colors hover:bg-[#2563EB]"
          >
            Uygulamayı Aç
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "thesisforge.onboarding_done.v2";
const TARGET_PADDING = 10;
const POPOVER_GAP = 14;
const POPOVER_WIDTH = 360;

type Placement = "top" | "right" | "bottom" | "left";

type TourStep = {
  id: string;
  title: string;
  body: string;
  href?: string;
  target?: string;
  placement?: Placement;
  mode?: "welcome";
};

const STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "ThesisForge'a hoş geldiniz",
    body: "Kısa bir turla dashboard, watchlist, BIST endeksi, yeni tez üretimi, şirketler ve tez arşivini birlikte gezelim.",
    mode: "welcome",
  },
  {
    id: "dashboard-watchlist",
    title: "Watchlist özeti",
    body: "Takip ettiğiniz hisselerin son fiyatlarını, günlük değişimini ve küçük grafiğini dashboard'dan hızlıca izleyebilirsiniz.",
    href: "/app",
    target: "dashboard-watchlist",
    placement: "bottom",
  },
  {
    id: "dashboard-bist",
    title: "BIST 100 nabzı",
    body: "Piyasanın genel yönünü burada takip edin. Detay düğmesi daha geniş mum grafiğini açar.",
    href: "/app",
    target: "dashboard-bist",
    placement: "right",
  },
  {
    id: "dashboard-new-thesis",
    title: "Yeni tez başlatma",
    body: "Tez üretimi aktif olduğunda bu düğmeden yeni analiz akışını başlatabilirsiniz.",
    href: "/app",
    target: "dashboard-new-thesis",
    placement: "left",
  },
  {
    id: "companies-search",
    title: "Şirketler sayfası",
    body: "BIST şirketlerini sembol veya unvanla arayarak hızlıca bulabilirsiniz.",
    href: "/app/companies",
    target: "companies-search",
    placement: "bottom",
  },
  {
    id: "companies-thesis",
    title: "Şirketten tez üretme",
    body: "Şirket kartındaki Tez Üret aksiyonu, seçili sembolle yeni tez ekranını açar.",
    href: "/app/companies",
    target: "company-thesis-action",
    placement: "top",
  },
  {
    id: "companies-watchlist",
    title: "Watchlist'e ekleme",
    body: "Aynı karttan şirketi watchlist'e ekleyip daha sonra dashboard ve watchlist sayfasında takip edebilirsiniz.",
    href: "/app/companies",
    target: "company-watchlist-action",
    placement: "top",
  },
  {
    id: "history-table",
    title: "Tezler arşivi",
    body: "Üretilen tüm tezler burada listelenir; sembol, karar ve güven skoruna göre hızlıca kontrol edebilirsiniz.",
    href: "/app/history",
    target: "history-table",
    placement: "top",
  },
  {
    id: "watchlist-add",
    title: "Watchlist yönetimi",
    body: "Yeni sembol ekleyin, takip ettiğiniz hisseden tez başlatın veya geçmiş tezlere geçin.",
    href: "/app/watchlist",
    target: "watchlist-add",
    placement: "left",
  },
];

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function samePath(pathname: string, href?: string) {
  if (!href) return true;
  return pathname === href;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetRect(target: string): TargetRect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function getPopoverStyle(rect: TargetRect | null, placement: Placement) {
  if (!rect) return undefined;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(POPOVER_WIDTH, viewportWidth - 32);
  const heightEstimate = 220;
  const centeredLeft = rect.left + rect.width / 2 - width / 2;
  const centeredTop = rect.top + rect.height / 2 - heightEstimate / 2;

  let top = rect.top + rect.height + POPOVER_GAP;
  let left = centeredLeft;

  if (placement === "top") {
    top = rect.top - heightEstimate - POPOVER_GAP;
    left = centeredLeft;
  } else if (placement === "right") {
    top = centeredTop;
    left = rect.left + rect.width + POPOVER_GAP;
  } else if (placement === "left") {
    top = centeredTop;
    left = rect.left - width - POPOVER_GAP;
  }

  return {
    width,
    top: clamp(top, 16, viewportHeight - heightEstimate - 16),
    left: clamp(left, 16, viewportWidth - width - 16),
  };
}

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const current = STEPS[step];
  const isWelcome = current.mode === "welcome";
  const progress = `${step + 1} / ${STEPS.length}`;

  const done = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    setTargetRect(null);
  }, []);

  const goToStep = useCallback(
    (nextStep: number) => {
      const bounded = clamp(nextStep, 0, STEPS.length - 1);
      const destination = STEPS[bounded];
      setStep(bounded);
      setTargetRect(null);
      if (destination.href && !samePath(pathname, destination.href)) {
        router.push(destination.href);
      }
    },
    [pathname, router],
  );

  const next = () => {
    if (step === STEPS.length - 1) done();
    else goToStep(step + 1);
  };

  const previous = () => {
    if (step > 0) goToStep(step - 1);
  };

  useEffect(() => {
    const restart = () => {
      localStorage.removeItem(STORAGE_KEY);
      setStep(0);
      setTargetRect(null);
      setOpen(true);
    };
    window.addEventListener("thesisforge:onboarding_restart", restart);
    return () =>
      window.removeEventListener("thesisforge:onboarding_restart", restart);
  }, []);

  useEffect(() => {
    if (pathname === "/app" && localStorage.getItem(STORAGE_KEY) !== "1") {
      const id = window.setTimeout(() => setOpen(true), 250);
      return () => window.clearTimeout(id);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open || isWelcome || !current.target || !samePath(pathname, current.href)) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const measure = (attempt = 0) => {
      if (cancelled || !current.target) return;
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${current.target}"]`,
      );

      if (!el) {
        if (attempt < 20) timeout = setTimeout(() => measure(attempt + 1), 100);
        else setTargetRect(null);
        return;
      }

      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      frame = window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          if (!cancelled && current.target) {
            setTargetRect(getTargetRect(current.target));
          }
        }, 180);
      });
    };

    measure();

    const refresh = () => {
      if (current.target) setTargetRect(getTargetRect(current.target));
    };
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [current, isWelcome, open, pathname]);

  const popoverStyle = useMemo(
    () => getPopoverStyle(targetRect, current.placement ?? "bottom"),
    [current.placement, targetRect],
  );

  if (!open) return null;

  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - TARGET_PADDING,
        left: targetRect.left - TARGET_PADDING,
        width: targetRect.width + TARGET_PADDING * 2,
        height: targetRect.height + TARGET_PADDING * 2,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {targetRect ? (
        <div
          className="pointer-events-none absolute rounded-2xl border border-primary/70 bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.58),0_18px_45px_-26px_rgba(37,99,235,0.9)] ring-4 ring-primary/15 transition-all duration-200"
          style={spotlightStyle}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/58 backdrop-blur-[2px]" />
      )}

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={cn(
          "pointer-events-auto fixed rounded-xl border border-border bg-card p-5 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] transition-all duration-200",
          isWelcome || !targetRect
            ? "left-1/2 top-1/2 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2"
            : "max-w-[calc(100vw-32px)]",
        )}
        style={!isWelcome && targetRect ? popoverStyle : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {progress}
            </div>
            <h2
              id="onboarding-title"
              className="mt-1 text-lg font-bold text-slate-900 dark:text-white"
            >
              {current.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={done}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-text-2"
            aria-label="Turu kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-text-2">
          {current.body}
        </p>

        <div className="mt-5 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToStep(i)}
              aria-label={`${i + 1}. adıma git`}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={done}
            className="text-[12.5px] font-semibold text-primary hover:underline"
          >
            Bir daha gösterme
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previous}
              disabled={step === 0}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12.5px] font-semibold text-text-2 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Geri
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
            >
              {step === STEPS.length - 1 ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Bitir
                </>
              ) : (
                <>
                  İleri
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

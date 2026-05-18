"use client";

import { useEffect, useState } from "react";
import { KeyRound, PlayCircle, Star, UserRound, FileText } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";
import { useAuth } from "@/lib/auth/AuthProvider";
import { changePassword } from "@/lib/api/profile";
import { listThesesPage } from "@/lib/api/thesis";
import { listWatchlist } from "@/lib/api/watchlist";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);
  const [thesisCount, setThesisCount] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    listWatchlist()
      .then((items) => {
        if (!cancelled) setWatchlistCount(items.length);
      })
      .catch(() => {
        if (!cancelled) setWatchlistCount(0);
      });
    listThesesPage({ limit: 1, offset: 0 })
      .then((page) => {
        if (!cancelled) setThesisCount(page.total);
      })
      .catch(() => {
        if (!cancelled) setThesisCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const restartTour = () => {
    localStorage.removeItem("thesisforge.onboarding_done");
    localStorage.removeItem("thesisforge.onboarding_done.v2");
    window.dispatchEvent(new Event("thesisforge:onboarding_restart"));
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordBusy || newPassword.length < 8) return;
    setPasswordBusy(true);
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg("Parola güncellendi.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Parola güncellenemedi.");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[980px] px-4 py-6 sm:px-6 sm:py-8">
        <FadeIn>
          <div className="mb-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Hesap
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Profil
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-text-2">
              Hesap bilgileri, kullanım özeti ve ürün turu.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <FadeIn delay={0.05}>
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-[18px] font-extrabold text-primary">
                  {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "TF"}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                    {isLoading ? "Yükleniyor…" : user?.name || "ThesisForge kullanıcısı"}
                  </h2>
                  <p className="mt-1 truncate text-[13px] text-muted-foreground">
                    {user?.email ?? "Oturum bilgisi bulunamadı"}
                  </p>
                  {user && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{user.tier.toUpperCase()}</Badge>
                      <Badge>{user.user_mode === "conservative" ? "Temkinli" : "Standart"}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </FadeIn>

          <FadeIn delay={0.1}>
            <section className="grid grid-cols-2 gap-3">
              <Metric
                icon={<Star className="h-4 w-4" />}
                label="Watchlist"
                value={watchlistCount}
              />
              <Metric
                icon={<FileText className="h-4 w-4" />}
                label="Tez"
                value={thesisCount}
              />
            </section>
          </FadeIn>

          <FadeIn delay={0.15}>
            <form
              onSubmit={updatePassword}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                  Parola
                </h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PasswordField
                  label="Mevcut parola"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
                <PasswordField
                  label="Yeni parola"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                />
              </div>
              {passwordError && (
                <div className="mt-3 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-[12px] text-bear">
                  {passwordError}
                </div>
              )}
              {passwordMsg && (
                <div className="mt-3 rounded-lg border border-bull/30 bg-bull/10 px-3 py-2 text-[12px] text-bull">
                  {passwordMsg}
                </div>
              )}
              <button
                type="submit"
                disabled={
                  passwordBusy ||
                  !currentPassword ||
                  newPassword.length < 8 ||
                  !isAuthenticated
                }
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passwordBusy ? "Güncelleniyor…" : "Parolayı güncelle"}
              </button>
            </form>
          </FadeIn>

          <FadeIn delay={0.2}>
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2.5">
                <UserRound className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                  Ürün Turu
                </h2>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-2">
                Dashboard, şirketler, yeni tez ve watchlist akışını tekrar gösterir.
              </p>
              <button
                type="button"
                onClick={restartTour}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Turu yeniden başlat
              </button>
            </section>
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-accent/40 px-2 py-1 font-mono text-[10.5px] font-semibold text-text-2">
      {children}
    </span>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-primary">{icon}</div>
      <div className="mt-3 font-mono text-2xl font-bold text-slate-900 dark:text-white">
        {value ?? "—"}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder="••••••••"
        className="h-10 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20"
      />
    </label>
  );
}

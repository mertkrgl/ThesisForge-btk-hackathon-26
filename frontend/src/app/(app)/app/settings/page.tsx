"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  KeyRound,
  Monitor,
  PlayCircle,
  Star,
  Trash2,
  UserRound,
  FileText,
} from "lucide-react";
import { useTheme } from "next-themes";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";
import { useAuth } from "@/lib/auth/AuthProvider";
import { changePassword } from "@/lib/api/profile";
import { listThesesPage } from "@/lib/api/thesis";
import { listWatchlist } from "@/lib/api/watchlist";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "thesisforge.settings.v2";

type Settings = {
  theme: "light" | "dark" | "system";
};

const DEFAULTS: Settings = { theme: "light" };

export default function AccountPage() {
  const { setTheme } = useTheme();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [saved, setSaved] = useState(false);

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
      .then((items) => { if (!cancelled) setWatchlistCount(items.length); })
      .catch(() => { if (!cancelled) setWatchlistCount(0); });
    listThesesPage({ limit: 1, offset: 0 })
      .then((page) => { if (!cancelled) setThesisCount(page.total); })
      .catch(() => { if (!cancelled) setThesisCount(0); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const updateTheme = (theme: Settings["theme"]) => {
    setSettings((s) => ({ ...s, theme }));
    setTheme(theme);
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch { /* localStorage unavailable */ }
  };

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

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "ThesisForge kullanıcısı";
  const avatarLetter = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "TF";

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <FadeIn>
          <div className="mb-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Hesap
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Hesabım
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-text-2">
              Profil bilgileri, görünüm tercihi ve hesap işlemleri.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* User info */}
          <FadeIn delay={0.05}>
            <section className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<UserRound className="h-4 w-4" />} title="Profil" />
              <div className="mt-4 flex items-start gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-[18px] font-extrabold text-primary">
                  {avatarLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    {isLoading ? "Yükleniyor…" : displayName}
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

          {/* Metrics */}
          <FadeIn delay={0.08}>
            <section className="grid grid-cols-2 gap-3">
              <Metric icon={<Star className="h-4 w-4" />} label="Takip" value={watchlistCount} />
              <Metric icon={<FileText className="h-4 w-4" />} label="Tez" value={thesisCount} />
            </section>
          </FadeIn>

          {/* Theme */}
          <FadeIn delay={0.1}>
            <section className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<Monitor className="h-4 w-4" />} title="Görünüm" subtitle="Tema tercihi bu cihazda saklanır." />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["dark", "light", "system"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => updateTheme(theme)}
                    aria-pressed={settings.theme === theme}
                    className={cn(
                      "h-10 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors",
                      settings.theme === theme
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-text-2 hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {theme === "dark" ? "Koyu" : theme === "light" ? "Açık" : "Sistem"}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
                >
                  {saved && <Check className="h-3.5 w-3.5" />}
                  {saved ? "Kaydedildi" : "Kaydet"}
                </button>
              </div>
            </section>
          </FadeIn>

          {/* Password */}
          <FadeIn delay={0.13}>
            <form onSubmit={updatePassword} className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<KeyRound className="h-4 w-4" />} title="Parola" />
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
                disabled={passwordBusy || !currentPassword || newPassword.length < 8 || !isAuthenticated}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passwordBusy ? "Güncelleniyor…" : "Parolayı güncelle"}
              </button>
            </form>
          </FadeIn>

          {/* Product tour */}
          <FadeIn delay={0.16}>
            <section className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<PlayCircle className="h-4 w-4" />} title="Ürün Turu" subtitle="Dashboard, şirketler, yeni tez ve takip listesi akışını tekrar gösterir." />
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

          {/* Account deletion */}
          <FadeIn delay={0.19}>
            <section className="rounded-xl border border-border bg-card p-5">
              <SectionHeader icon={<AlertTriangle className="h-4 w-4" />} title="Hesap" subtitle="Hesap silme işlemi teslim sonrası backend endpoint'ine bağlanacak." />
              <button
                type="button"
                disabled
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-bear/30 bg-bear/10 px-3 text-[12.5px] font-semibold text-bear opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hesabı sil
              </button>
            </section>
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg border border-border bg-accent/40 text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-accent/40 px-2 py-1 font-mono text-[10.5px] font-semibold text-text-2">
      {children}
    </span>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
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

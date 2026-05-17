"use client";

import { useEffect, useState } from "react";
import { Check, User, Cpu, Database, Bell, Code2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getConfigInfo } from "@/lib/api/config";
import type { BackendConfigInfo } from "@/lib/types/backend";

type TabId = "profile" | "models" | "data" | "notifications" | "developer";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profil", icon: User },
  { id: "models", label: "Modeller", icon: Cpu },
  { id: "data", label: "Veri Kaynakları", icon: Database },
  { id: "notifications", label: "Bildirimler", icon: Bell },
  { id: "developer", label: "Geliştirici", icon: Code2 },
];

const STORAGE_KEY = "thesisforge.settings.v1";

type Settings = {
  displayName: string;
  email: string;
  model: "pro" | "flash";
  sources: Record<string, boolean>;
  notif: { email: boolean; push: boolean; weekly: boolean };
  apiKey: string;
  mockMode: boolean;
};

const DEFAULTS: Settings = {
  displayName: "Melih Genel",
  email: "mlihgenel@gmail.com",
  model: "pro",
  sources: { kap: true, evds: true, mkk: true, bist: true, news: false },
  notif: { email: true, push: false, weekly: true },
  apiKey: "",
  mockMode: true,
};

export function SettingsPanels() {
  const [tab, setTab] = useState<TabId>("profile");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<BackendConfigInfo | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getConfigInfo()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch((e) => {
        if (!cancelled)
          setConfigError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
      <nav className="flex flex-col gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 dark:text-text-2 transition-all hover:bg-slate-100 dark:hover:bg-secondary hover:text-slate-900 dark:hover:text-white",
                active &&
                  "bg-blue-50 dark:bg-accent text-blue-700 dark:text-white shadow-[inset_2px_0_0_#2563EB] dark:shadow-[inset_0_0_0_1px_#1E2A44,inset_2px_0_0_#3B82F6]"
              )}
            >
              <Icon className="h-4 w-4 opacity-80" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-border bg-card p-6">
        {tab === "profile" && (
          <FormSection
            title="Profil"
            subtitle="Hesabınız ve görünen adınız."
          >
            <Field label="Görünen ad">
              <input
                value={settings.displayName}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, displayName: e.target.value }))
                }
                className="input-base"
              />
            </Field>
            <Field label="E-posta">
              <input
                type="email"
                value={settings.email}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, email: e.target.value }))
                }
                className="input-base"
              />
            </Field>
          </FormSection>
        )}

        {tab === "models" && (
          <FormSection
            title="Modeller"
            subtitle="Komiteyi yürüten Gemini sürümleri sunucu tarafında yapılandırılmıştır."
          >
            <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-[12px] text-warn">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span className="font-semibold">Sunucu tarafı yapılandırma</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Bu ayarlar backend env değişkenleriyle belirlenir ve buradan
                değiştirilemez.
              </p>
            </div>
            {configError && (
              <div className="rounded-lg border border-bear/30 bg-bear/10 p-3 text-[12px] text-bear">
                Backend ayarları alınamadı: {configError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ConfigChip
                title="Akıl Yürütme (Pro)"
                value={config?.models.pro ?? "—"}
                hint="Sentez ve şeytan avukatı için derin model."
              />
              <ConfigChip
                title="Hızlı Yanıt (Flash)"
                value={config?.models.flash ?? "—"}
                hint="Teknik, temel ve makro işçi ajanları için."
              />
              <ConfigChip
                title="Embedding Modeli"
                value={config?.models.embed ?? "—"}
                hint={`Hafıza similarity araması · ${config?.models.embed_dimensions ?? "?"} boyut`}
              />
              <ConfigChip
                title="Çalışma Modu"
                value={config ? `${config.mode} (${config.env})` : "—"}
                hint={`Cache: ${config?.cache_backend ?? "?"}`}
              />
            </div>
          </FormSection>
        )}

        {tab === "data" && (
          <FormSection
            title="Veri Kaynakları"
            subtitle="Ajanların eriştiği veri sağlayıcılarının sunucu tarafı durumu."
          >
            <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-[12px] text-warn">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span className="font-semibold">Read-only</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Veri kaynakları backend env (TCMB_EVDS_KEY, MKK_API_KEY vs.)
                üzerinden aktive edilir.
              </p>
            </div>
            <ul className="divide-y divide-line/60 rounded-xl border border-border bg-card">
              {[
                { id: "yfinance", label: "Yfinance · Fiyat ve OHLCV" },
                { id: "isyatirim", label: "İş Yatırım · BIST verisi" },
                { id: "kap", label: "KAP · Kamuyu Aydınlatma" },
                { id: "tcmb_evds", label: "TCMB EVDS · Makro veri" },
                { id: "mkk", label: "MKK · Olay verisi" },
                { id: "bist", label: "BIST · İndeks ve fiyat" },
              ].map((row) => {
                const active =
                  (config?.data_sources as Record<string, boolean> | undefined)?.[
                    row.id
                  ] ?? false;
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="text-[13px] text-text-2">{row.label}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        active
                          ? "border-bull/30 bg-bull/10 text-bull"
                          : "border-muted bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {active ? "Aktif" : "Pasif"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </FormSection>
        )}

        {tab === "notifications" && (
          <FormSection
            title="Bildirimler"
            subtitle="Tez tamamlandığında veya watchlist olayında nasıl haberdar olmak istersiniz?"
          >
            <ToggleRow
              label="E-posta bildirimleri"
              on={settings.notif.email}
              onChange={(v) =>
                setSettings((s) => ({ ...s, notif: { ...s.notif, email: v } }))
              }
            />
            <ToggleRow
              label="Tarayıcı push bildirimleri"
              on={settings.notif.push}
              onChange={(v) =>
                setSettings((s) => ({ ...s, notif: { ...s.notif, push: v } }))
              }
            />
            <ToggleRow
              label="Haftalık özet"
              on={settings.notif.weekly}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  notif: { ...s.notif, weekly: v },
                }))
              }
            />
          </FormSection>
        )}

        {tab === "developer" && (
          <FormSection
            title="Geliştirici"
            subtitle="API anahtarı ve demo modu ayarları."
          >
            <Field label="API anahtarı (opsiyonel)">
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, apiKey: e.target.value }))
                }
                placeholder="sk-…"
                className="input-base font-mono"
              />
            </Field>
            <ToggleRow
              label="Mock veri modu"
              hint="Açıkken stream ve tezler mock veriden okunur."
              on={settings.mockMode}
              onChange={(v) =>
                setSettings((s) => ({ ...s, mockMode: v }))
              }
            />
          </FormSection>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-bull">
              <Check className="h-3.5 w-3.5" />
              Kaydedildi
            </span>
          )}
          <button
            type="button"
            onClick={save}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
          >
            Kaydet
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.input-base) {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--tf-line);
          background: var(--card, #fff);
          color: var(--foreground, #0F172A);
          font-size: 13px;
        }
        :global(.input-base:focus) {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
      `}</style>
    </div>
  );
}

function ConfigChip({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-1 font-mono text-[13px] font-semibold text-slate-900 dark:text-white">
        {value}
      </div>
      {hint && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-2">{hint}</p>
      )}
    </div>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] text-slate-900 dark:text-white">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        on
          ? "border-primary/50 bg-primary/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
          : "border-border bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-card shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

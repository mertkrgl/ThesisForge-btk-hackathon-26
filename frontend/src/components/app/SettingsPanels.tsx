"use client";

import { useState } from "react";
import { AlertTriangle, Check, Monitor, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "thesisforge.settings.v2";

type Settings = {
  theme: "light" | "dark" | "system";
};

const DEFAULTS: Settings = {
  theme: "system",
};

export function SettingsPanels() {
  const { setTheme } = useTheme();
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

  const updateTheme = (theme: Settings["theme"]) => {
    setSettings((s) => ({ ...s, theme }));
    setTheme(theme);
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      /* localStorage unavailable */
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionTitle
          icon={<Monitor className="h-4 w-4" />}
          title="Görünüm"
          subtitle="Tema tercihi bu cihazda saklanır."
        />
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
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <SectionTitle
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Hesap"
          subtitle="Hesap silme işlemi teslim sonrası backend endpoint'ine bağlanacak."
        />
        <button
          type="button"
          disabled
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-bear/30 bg-bear/10 px-3 text-[12.5px] font-semibold text-bear opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Hesabı sil
        </button>
      </section>

      <div className="flex justify-end lg:col-span-2">
        <button
          type="button"
          onClick={save}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[#2563EB]"
        >
          {saved && <Check className="h-3.5 w-3.5" />}
          {saved ? "Kaydedildi" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg border border-border bg-accent/40 text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

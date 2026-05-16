import { SettingsPanels } from "@/components/app/SettingsPanels";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <div className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Sistem
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          Ayarlar
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-text-2">
          Profil, modeller, veri kaynakları ve geliştirici seçenekleri.
        </p>
      </div>
      <SettingsPanels />
    </div>
  );
}

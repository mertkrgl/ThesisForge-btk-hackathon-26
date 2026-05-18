import { SettingsPanels } from "@/components/app/SettingsPanels";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";

export default function SettingsPage() {
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <FadeIn>
          <div className="mb-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Sistem
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Ayarlar
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-text-2">
              Görünüm, bildirim tercihleri ve hesap işlemleri.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <SettingsPanels />
        </FadeIn>
      </div>
    </PageTransition>
  );
}

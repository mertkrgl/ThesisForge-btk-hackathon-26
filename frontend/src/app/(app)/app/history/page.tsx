import { listTheses } from "@/lib/api/thesis";
import { HistoryTable } from "@/components/app/HistoryTable";
import { PageTransition, FadeIn } from "@/components/shared/MotionWrappers";

export default async function HistoryPage() {
  const theses = await listTheses();
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
        <FadeIn>
          <div className="mb-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Arşiv
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
              Geçmiş Tezler
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-text-2">
              Üretilen her tez burada arşivlenir. Filtreleyin, arayın veya
              görüntüleyin.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <HistoryTable theses={theses} />
        </FadeIn>
      </div>
    </PageTransition>
  );
}

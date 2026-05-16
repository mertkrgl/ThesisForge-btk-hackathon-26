import { listTheses } from "@/lib/api/thesis";
import { HistoryTable } from "@/components/app/HistoryTable";

export default async function HistoryPage() {
  const theses = await listTheses();
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">
      <div className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Arşiv
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          Geçmiş Tezler
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-text-2">
          Üretilen her tez burada arşivlenir. Filtreleyin, arayın veya
          görüntüleyin.
        </p>
      </div>
      <HistoryTable theses={theses} />
    </div>
  );
}

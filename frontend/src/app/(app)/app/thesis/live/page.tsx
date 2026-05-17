import { LiveThesisRunner } from "@/components/app/LiveThesisRunner";

export default async function LiveCommitteePage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; persona?: string }>;
}) {
  // Next.js 15+ searchParams is a Promise
  const resolvedParams = await searchParams;
  const explicitSymbol = (resolvedParams.symbol || "").trim().toUpperCase();
  const symbol = explicitSymbol || "TUPRS";
  const persona =
    resolvedParams.persona === "conservative" ? "conservative" : "default";

  const personaLabel =
    persona === "conservative" ? "Muhafazakâr Mod" : "Dengeli Mod";

  // Sembol açıkça verildiyse (örn. /app/thesis/new formundan veya watchlist'ten
  // gelindiyse) analiz otomatik başlasın. Sidebar'dan parametresiz gelindiyse
  // kullanıcı sembolü değiştirip "Komiteyi Başlat"a basana kadar bekle.
  const autoStart = explicitSymbol.length > 0;

  const subtitle = autoStart ? `${symbol} · ${personaLabel}` : "Yeni Tez";

  return (
    <LiveThesisRunner
      defaultSymbol={symbol}
      defaultPersona={persona}
      title="Canlı Komite"
      subtitle={subtitle}
      autoStart={autoStart}
    />
  );
}

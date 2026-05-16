import { LiveThesisRunner } from "@/components/app/LiveThesisRunner";

export default async function LiveCommitteePage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; persona?: string }>;
}) {
  // Next.js 15+ searchParams is a Promise
  const resolvedParams = await searchParams;
  const symbol = (resolvedParams.symbol || "TUPRS").toUpperCase();
  const persona = resolvedParams.persona || "default";

  // Personaya göre başlık ayarlayalım
  const personaLabel = persona === "conservative" ? "Muhafazakar Mod" : "Dengeli Mod";

  return (
    <LiveThesisRunner 
      defaultSymbol={symbol} 
      title={`Canlı Komite (${personaLabel})`} 
      subtitle={`${symbol} için ${personaLabel} analizi yapılıyor`} 
      autoStart={true}
    />
  );
}

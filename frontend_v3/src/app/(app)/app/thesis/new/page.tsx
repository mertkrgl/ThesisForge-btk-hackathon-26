import { LiveThesisRunner } from "@/components/app/LiveThesisRunner";

export default async function NewThesisPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  return <LiveThesisRunner defaultSymbol={(symbol || "TUPRS").toUpperCase()} title="Yeni Tez" subtitle="Başlat" />;
}

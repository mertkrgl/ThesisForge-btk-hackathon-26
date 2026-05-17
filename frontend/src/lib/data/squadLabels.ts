import type { SquadType } from "@/lib/types/backend";

export const SQUAD_LABELS: Record<SquadType, string> = {
  Banking: "Bankacılık",
  Insurance: "Sigorta",
  Finance: "Finans",
  Brokerage: "Aracılık",
  RealEstate: "Gayrimenkul",
  Energy: "Enerji",
  Defense: "Savunma",
  Automotive: "Otomotiv",
  Technology: "Teknoloji",
  Healthcare: "Sağlık",
  Food: "Gıda",
  Retail: "Perakende",
  Construction: "İnşaat",
  Industrial: "Sanayi",
  Mining: "Madencilik",
  Transportation: "Ulaştırma",
  Holding: "Holding",
  Generic: "Genel",
};

export function squadLabel(squad: string | null | undefined): string {
  if (!squad) return "Genel";
  return SQUAD_LABELS[squad as SquadType] ?? squad;
}

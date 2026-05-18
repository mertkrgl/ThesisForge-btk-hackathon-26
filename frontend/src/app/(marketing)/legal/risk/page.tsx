import { LegalPage } from "../_components/LegalPage";

export default function RiskPage() {
  return (
    <LegalPage
      eyebrow="Yasal"
      title="Risk Bildirimi"
      intro="Borsa İstanbul payları ve sermaye piyasası araçları fiyat dalgalanması, likidite ve haber akışı kaynaklı ciddi riskler taşır."
      sections={[
        {
          title: "Piyasa riski",
          body: "Hisse fiyatları makro veri, şirket haberleri, likidite, kur, faiz ve beklenmeyen olaylar nedeniyle hızlı değişebilir. Geçmiş performans gelecekteki sonucu garanti etmez.",
        },
        {
          title: "Model riski",
          body: "Yapay zekâ çıktıları eksik, gecikmeli veya yanlış yorumlanmış veriden etkilenebilir. Güven skoru bir kesinlik ölçüsü değil, kullanılan kaynak kalitesine dair yardımcı göstergedir.",
        },
        {
          title: "Kullanıcı sorumluluğu",
          body: "Her karar bağımsız doğrulama gerektirir. Tek bir model çıktısına dayanarak işlem yapmak önemli finansal kayıplara yol açabilir.",
        },
      ]}
    />
  );
}

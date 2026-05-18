import { LegalPage } from "../_components/LegalPage";

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Yasal"
      title="Yasal Uyarı"
      intro="ThesisForge bir karar destek ve araştırma ürünüdür. Üretilen içerikler yatırım danışmanlığı, portföy yönetimi veya alım-satım tavsiyesi değildir."
      sections={[
        {
          title: "Yatırım tavsiyesi değildir",
          body: "Platformda gösterilen tezler, skorlar, kaynak özetleri ve etiketler genel bilgilendirme amaçlıdır. Kişisel mali durumunuz, risk-getiri tercihleriniz ve yatırım hedefleriniz dikkate alınmaz.",
        },
        {
          title: "SPK lisansı kapsamında değildir",
          body: "Bu ürün, Sermaye Piyasası Kurulu lisanslı yatırım danışmanlığı hizmeti sunmaz. Yatırım kararları için yetkili kurum ve profesyonellerden destek alınmalıdır.",
        },
        {
          title: "Sorumluluk",
          body: "Veri sağlayıcılar, piyasa koşulları ve model çıktıları değişebilir. İşlem kararlarından ve doğabilecek kâr/zarardan kullanıcı sorumludur.",
        },
      ]}
    />
  );
}

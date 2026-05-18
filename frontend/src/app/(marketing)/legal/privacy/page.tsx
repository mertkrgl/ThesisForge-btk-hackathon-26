import { LegalPage } from "../_components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Yasal"
      title="Gizlilik"
      intro="ThesisForge hesap, watchlist ve tez geçmişi gibi ürün kullanım verilerini hizmeti çalıştırmak ve iyileştirmek için işler."
      sections={[
        {
          title: "İşlenen veriler",
          body: "E-posta, görünen ad, oturum bilgileri, watchlist kayıtları ve üretilen tez geçmişi tutulabilir. Hassas finansal portföy verisi zorunlu değildir.",
        },
        {
          title: "Kullanım amacı",
          body: "Veriler oturum yönetimi, kullanıcıya özel watchlist/tez görünümü, hata ayıklama ve ürün güvenilirliğini artırma amaçlarıyla kullanılır.",
        },
        {
          title: "Kontrol",
          body: "Kullanıcılar hesap bilgilerini profil ekranından görebilir. Hesap silme ve veri ihracı akışları üretim sürümünde backend endpoint'lerine bağlanacaktır.",
        },
      ]}
    />
  );
}

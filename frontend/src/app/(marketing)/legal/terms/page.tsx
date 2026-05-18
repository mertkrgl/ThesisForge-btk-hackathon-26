import { LegalPage } from "../_components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Yasal"
      title="Kullanım Şartları"
      intro="ThesisForge'u kullanarak çıktıları bağımsız araştırma gerektiren bilgi amaçlı içerik olarak değerlendirmeyi kabul edersiniz."
      sections={[
        {
          title: "Hizmet kapsamı",
          body: "Platform; halka açık kaynakları, piyasa verilerini ve ajan çıktısını bir araya getirerek araştırma akışı sağlar. Emir iletimi veya portföy yönetimi yapmaz.",
        },
        {
          title: "Kabul edilebilir kullanım",
          body: "Servisin kötüye kullanımı, yetkisiz erişim denemeleri, otomatik yoğun istekler ve yanıltıcı içerik üretimi yasaktır.",
        },
        {
          title: "Değişiklikler",
          body: "Hackathon sürümünde özellikler ve veri kaynakları hızlı değişebilir. Üretim öncesi içerikler bağlayıcı hizmet seviyesi taahhüdü oluşturmaz.",
        },
      ]}
    />
  );
}

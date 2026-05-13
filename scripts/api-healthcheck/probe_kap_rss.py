"""KAP RSS feed — key'siz fallback probe."""
import xml.etree.ElementTree as ET
import httpx

RSS_URLS = [
    "https://www.kap.org.tr/tr/RssAjax?sectionId=1102",
    "https://www.kap.org.tr/tr/rss",
    "https://www.kap.org.tr/rss",
]


def probe() -> dict:
    with httpx.Client(timeout=15, headers={"User-Agent": "ThesisForge/0.1"}) as client:
        for url in RSS_URLS:
            try:
                r = client.get(url)
                if r.status_code != 200:
                    continue

                root = ET.fromstring(r.text)
                items = root.findall(".//item")
                if not items:
                    items = root.findall(".//{http://www.w3.org/2005/Atom}entry")

                titles = [
                    (item.findtext("title") or item.findtext("{http://www.w3.org/2005/Atom}title") or "?")
                    for item in items[:5]
                ]

                return {
                    "status": "OK",
                    "note": f"{len(items)} bildirim | URL: {url}",
                    "detail": {"url": url, "item_count": len(items), "sample_titles": titles},
                }
            except ET.ParseError:
                # RSS değil, muhtemelen HTML döndü
                return {
                    "status": "WARN",
                    "note": f"200 döndü ama geçerli XML değil ({url})",
                    "detail": {"url": url, "raw_start": r.text[:300]},
                }
            except Exception as e:
                continue

    return {
        "status": "FAIL",
        "note": "Denenen tüm RSS URL'leri başarısız",
        "detail": {"tried": RSS_URLS},
    }


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False))

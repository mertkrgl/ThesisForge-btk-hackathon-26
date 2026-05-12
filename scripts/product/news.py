"""Haber kaynakları — Google News RSS (şirket-spesifik) + Mynet (makro).

Strateji:
  - Şirket haberleri: Google News RSS, "TICKER OR 'şirket adı'" Türkçe filtresi
  - Makro/piyasa haberleri: Mynet finans anasayfa
  - Detay: Hedef URL'i takip et → meta description al

Tüm istekler 1 saniye rate-limited, ücretsiz, key gerekmez.

Kullanım:
    from product.news import get_company_news, get_market_news, get_news_detail
    news = get_company_news("THYAO", count=10, with_summary=True)
"""
import re
import time
import urllib.parse
from xml.etree import ElementTree as ET

import httpx
from bs4 import BeautifulSoup
from googlenewsdecoder import gnewsdecoder
from companies import get_company_by_ticker

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ThesisForge/0.1"
TIMEOUT = 15
_LAST_REQUEST_TS = [0.0]
_MIN_INTERVAL = 1.0


def _rate_limited_get(url: str, follow_redirects: bool = True) -> httpx.Response:
    """1 sn rate limit ile GET."""
    elapsed = time.time() - _LAST_REQUEST_TS[0]
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    _LAST_REQUEST_TS[0] = time.time()
    return httpx.get(
        url, headers={"User-Agent": UA},
        timeout=TIMEOUT, follow_redirects=follow_redirects,
    )


def _clean_company_name(title: str) -> str:
    """'TÜRK HAVA YOLLARI A.O.' → 'TÜRK HAVA YOLLARI'."""
    title = re.sub(
        r"\s+(A\.?\s*Ş\.?|A\.?\s*O\.?|T\.?\s*A\.?\s*Ş\.?|HOLDİNG)\b\.?",
        "", title, flags=re.IGNORECASE
    )
    return title.strip(" .,")


def get_company_news(
    ticker: str,
    count: int = 10,
    with_summary: bool = False,
    days: int = 30,
) -> list[dict]:
    """Bir şirkete ait haberler — Google News RSS.

    Args:
        ticker: BIST sembolü (ör. 'THYAO')
        count: Kaç haber
        with_summary: True ise her haberin URL'ini açıp meta description al (yavaş)
        days: Son kaç gün (Google News varsayılan: son haftalar)

    Returns:
        [{
            'title': '...',
            'source': 'Mynet Finans',
            'date': 'Tue, 12 May 2026 15:56:00 GMT',
            'url': 'https://news.google.com/rss/articles/...',
            'summary': '...' (opsiyonel),
        }, ...]
    """
    company = get_company_by_ticker(ticker)
    if not company:
        raise ValueError(f"{ticker} MKK'da bulunamadı")

    company_name = _clean_company_name(company["title"])
    # Tırnak içinde tam adla ve ticker ile birlikte ara
    query = f'"{company_name}" OR {ticker}'
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=tr&gl=TR&ceid=TR:tr"

    r = _rate_limited_get(url)
    r.raise_for_status()

    root = ET.fromstring(r.text)
    items = root.findall(".//item")

    results = []
    for item in items[:count]:
        title = item.findtext("title", "")
        pub = item.findtext("pubDate", "")
        link = item.findtext("link", "")
        source_el = item.find("source")
        source = source_el.text if source_el is not None else ""
        description = item.findtext("description", "")

        # Google News description bazen HTML içerir, temizle
        if description:
            desc_soup = BeautifulSoup(description, "html.parser")
            description = desc_soup.get_text(strip=True)

        news_item = {
            "title": title,
            "source": source,
            "date": pub,
            "url": link,
            "snippet": description[:300] if description else "",
        }

        if with_summary and link:
            try:
                detail = get_news_detail(link)
                news_item["summary"] = detail.get("summary", "")
                if detail.get("date"):
                    news_item["published_at"] = detail["date"]
                if detail.get("real_url"):
                    news_item["real_url"] = detail["real_url"]
            except Exception as e:
                news_item["summary_error"] = str(e)[:100]

        results.append(news_item)
    return results


def get_market_news(count: int = 10) -> list[dict]:
    """Genel piyasa/makro haberleri — Google News + Mynet ekonomi.

    Returns:
        [{'title': '...', 'source': '...', 'url': '...', 'snippet': '...'}, ...]
    """
    query = "BIST 100 borsa İstanbul ekonomi"
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=tr&gl=TR&ceid=TR:tr"

    r = _rate_limited_get(url)
    r.raise_for_status()

    root = ET.fromstring(r.text)
    items = root.findall(".//item")

    results = []
    for item in items[:count]:
        title = item.findtext("title", "")
        pub = item.findtext("pubDate", "")
        link = item.findtext("link", "")
        source_el = item.find("source")
        source = source_el.text if source_el is not None else ""
        desc = item.findtext("description", "")
        if desc:
            desc = BeautifulSoup(desc, "html.parser").get_text(strip=True)

        results.append({
            "title": title,
            "source": source,
            "date": pub,
            "url": link,
            "snippet": desc[:300] if desc else "",
        })
    return results


def _resolve_google_news_url(url: str) -> str:
    """Google News obfuscated URL'ini gerçek kaynak URL'ine çevir."""
    if "news.google.com" not in url:
        return url
    try:
        result = gnewsdecoder(url, interval=1)
        if result.get("status") and result.get("decoded_url"):
            return result["decoded_url"]
    except Exception:
        pass
    return url


def get_news_detail(news_url: str) -> dict:
    """Bir haber URL'inin gerçek sayfasını açıp özet+başlık al.

    Google News URL'i ise önce decode edilir, ardından gerçek kaynaktan
    meta description çekilir. Türk haber sitelerinin %95'i meta tag kullanır.

    Returns:
        {
            'title': '...',
            'date': '...',
            'summary': '...',
            'real_url': 'https://finans.mynet.com/...',
        }
    """
    real_url = _resolve_google_news_url(news_url)

    try:
        r = _rate_limited_get(real_url, follow_redirects=True)
    except Exception as e:
        return {"error": str(e)[:100], "real_url": real_url}

    if r.status_code != 200:
        return {"error": f"HTTP {r.status_code}", "real_url": real_url}

    soup = BeautifulSoup(r.text, "html.parser")

    # Başlık
    title = ""
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
    if not title:
        og_t = soup.find("meta", attrs={"property": "og:title"})
        if og_t:
            title = og_t.get("content", "")

    # Tarih
    date = ""
    time_tag = soup.find("time")
    if time_tag:
        date = time_tag.get("datetime") or time_tag.get_text(strip=True)
    if not date:
        for prop in ["article:published_time", "og:updated_time"]:
            meta = soup.find("meta", attrs={"property": prop})
            if meta:
                date = meta.get("content", "")
                break

    # Özet: meta description (Türk haber sitelerinin %95'i bunu kullanıyor)
    summary = ""
    for attr in [
        {"name": "description"},
        {"property": "og:description"},
        {"name": "twitter:description"},
    ]:
        meta = soup.find("meta", attrs=attr)
        if meta:
            content = meta.get("content", "").strip()
            if content and len(content) > 30:
                summary = content
                break

    # Eğer özet hâlâ boşsa, ilk anlamlı paragrafı dene
    if not summary:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 80 and "favorilerim" not in text.lower():
                summary = text
                break

    return {
        "title": title,
        "date": date,
        "summary": summary,
        "real_url": real_url,
    }


if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "THYAO"

    print(f"=== {ticker} HABERLERİ (Google News, şirket-spesifik) ===\n")
    news = get_company_news(ticker, count=8, with_summary=True)
    for i, n in enumerate(news, 1):
        print(f"{i}. {n['title'][:90]}")
        print(f"   📰 {n.get('source', '?')} | 🕐 {n.get('date', '?')[:25]}")
        if n.get("summary"):
            print(f"   📝 {n['summary'][:200]}")
        elif n.get("snippet"):
            print(f"   📝 {n['snippet'][:200]}")
        print()

    print(f"\n=== PİYASA / MAKRO HABERLERİ ===\n")
    market = get_market_news(count=5)
    for i, n in enumerate(market, 1):
        print(f"{i}. {n['title'][:90]}")
        print(f"   📰 {n.get('source', '?')} | 🕐 {n.get('date', '?')[:25]}")
        print()

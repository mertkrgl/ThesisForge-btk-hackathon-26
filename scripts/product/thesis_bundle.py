"""Tek bir ticker için **tüm tez verisini** tek çağrıda topla.

Bu, Synthesizer agent'ına gidecek context'i hazırlar:
  - Makro paragraf (TCMB)
  - Şirket genel bilgi (MKK)
  - 90 günlük fiyat + teknik (yfinance + pandas-ta)
  - Son finansal tablo (isyatirim)
  - Son KAP bildirimleri (MKK + pykap)
  - Analist tavsiyesi (borsapy)

Kullanım:
    from product.thesis_bundle import build_thesis_bundle
    data = build_thesis_bundle("THYAO")
"""
import time
from datetime import datetime

from macro import get_macro_context
from companies import get_company_by_ticker
from prices import get_ohlcv, get_dividends, get_brent_oil
from financials import get_latest_quarter, compute_basic_ratios
from disclosures import get_company_disclosures
from analyst import get_recommendation
from technicals import compute_indicators, technical_signal
from news import get_market_news, get_company_news


def build_thesis_bundle(ticker: str, days: int = 90) -> dict:
    """Bir ticker için Synthesizer'a gidecek tüm veriyi topla.

    Args:
        ticker: BIST sembolü (ör. 'THYAO')
        days: Fiyat geçmişi gün sayısı

    Returns:
        {
            'ticker': 'THYAO',
            'fetched_at': '2026-05-12T20:30:00',
            'macro': {...},
            'company': {...},
            'price': {'last_close': ..., 'change_pct_30d': ...},
            'technical': {'rsi_14': ..., 'macd': ..., 'signal': {...}},
            'financials': {...},
            'ratios': {...},
            'disclosures': [...],
            'analyst': {...},
            'errors': {...},  # hangi modül başarısız oldu
        }
    """
    bundle = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
        "errors": {},
    }

    # 1. Makro context
    t0 = time.time()
    try:
        bundle["macro"] = get_macro_context()
    except Exception as e:
        bundle["errors"]["macro"] = str(e)
    bundle["_t_macro"] = round(time.time() - t0, 2)

    # 2. Şirket bilgi
    t0 = time.time()
    try:
        bundle["company"] = get_company_by_ticker(ticker)
    except Exception as e:
        bundle["errors"]["company"] = str(e)
    bundle["_t_company"] = round(time.time() - t0, 2)

    # 3. Fiyat + teknik
    t0 = time.time()
    try:
        ohlcv = get_ohlcv(ticker, days=days)
        last_close = float(ohlcv.iloc[-1]["Close"])
        first_close = float(ohlcv.iloc[0]["Close"])
        change_pct = round((last_close - first_close) / first_close * 100, 2)

        bundle["price"] = {
            "source": ohlcv.attrs.get("source"),
            "rows": len(ohlcv),
            "last_close": round(last_close, 2),
            "first_close": round(first_close, 2),
            "change_pct": change_pct,
            "last_date": str(ohlcv.index[-1].date()) if hasattr(ohlcv.index[-1], "date") else None,
        }
        ind = compute_indicators(ohlcv)
        bundle["technical"] = {**ind, "signal": technical_signal(ind)}
    except Exception as e:
        bundle["errors"]["price"] = str(e)
    bundle["_t_price"] = round(time.time() - t0, 2)

    # 4. Finansal tablo
    t0 = time.time()
    try:
        bundle["financials"] = get_latest_quarter(ticker)
        bundle["ratios"] = compute_basic_ratios(ticker)
    except Exception as e:
        bundle["errors"]["financials"] = str(e)
    bundle["_t_financials"] = round(time.time() - t0, 2)

    # 5. KAP bildirimleri (son 30 gün)
    t0 = time.time()
    try:
        disclosures = get_company_disclosures(ticker, days=30)
        bundle["disclosures"] = [
            {
                "date": d.get("publishDate", "")[:10] if d.get("publishDate") else None,
                "title": d.get("title", "")[:120],
            }
            for d in disclosures[:15]
        ]
    except Exception as e:
        bundle["errors"]["disclosures"] = str(e)
    bundle["_t_disclosures"] = round(time.time() - t0, 2)

    # 6. Analist tavsiyesi
    t0 = time.time()
    try:
        bundle["analyst"] = get_recommendation(ticker)
    except Exception as e:
        bundle["errors"]["analyst"] = str(e)
    bundle["_t_analyst"] = round(time.time() - t0, 2)

    # 7. Brent (Energy squad için, opsiyonel)
    try:
        brent = get_brent_oil(days=30)
        bundle["brent_oil_usd"] = round(float(brent.iloc[-1]["Close"]), 2)
    except Exception:
        pass

    # 8. Şirkete-özel haberler (Google News, özetli)
    t0 = time.time()
    try:
        bundle["company_news"] = get_company_news(ticker, count=8, with_summary=True)
    except Exception as e:
        bundle["errors"]["company_news"] = str(e)
    try:
        bundle["market_news"] = get_market_news(count=8)
    except Exception as e:
        bundle["errors"]["market_news"] = str(e)
    bundle["_t_news"] = round(time.time() - t0, 2)

    return bundle


if __name__ == "__main__":
    import json
    import sys

    ticker = sys.argv[1] if len(sys.argv) > 1 else "THYAO"
    print(f"=== {ticker} tez paketi hazırlanıyor... ===\n")

    bundle = build_thesis_bundle(ticker)

    # Süreleri ayır
    timings = {k: v for k, v in bundle.items() if k.startswith("_t_")}

    # Bölüm bölüm bas — hepsi terminale sığsın
    print("─" * 70)
    print(f"  {bundle.get('ticker')} | {bundle.get('fetched_at')}")
    print("─" * 70)

    print("\n📊 MAKRO")
    print(json.dumps(bundle.get("macro", {}), indent=2, ensure_ascii=False))

    print("\n🏢 ŞİRKET")
    print(json.dumps(bundle.get("company", {}), indent=2, ensure_ascii=False))

    print("\n💹 FİYAT")
    print(json.dumps(bundle.get("price", {}), indent=2, ensure_ascii=False, default=str))

    print("\n📈 TEKNİK")
    print(json.dumps(bundle.get("technical", {}), indent=2, ensure_ascii=False))

    print("\n💰 ANALİST TAVSİYESİ")
    print(json.dumps(bundle.get("analyst", {}), indent=2, ensure_ascii=False))

    print("\n📋 TEMEL ORANLAR")
    print(json.dumps(bundle.get("ratios", {}), indent=2, ensure_ascii=False, default=str))

    print(f"\n🛢  Brent: ${bundle.get('brent_oil_usd', '?')}")

    print(f"\n📰 {ticker} HABERLERİ (Google News, şirket-spesifik)")
    for i, n in enumerate(bundle.get("company_news", []), 1):
        print(f"\n  {i}. {n['title'][:100]}")
        print(f"     📍 {n.get('source', '?')} | 🕐 {n.get('date', '?')[:25]}")
        summary = n.get("summary") or n.get("snippet") or ""
        if summary:
            print(f"     📝 {summary[:250]}")

    print("\n🌐 PİYASA HABERLERİ")
    for i, n in enumerate(bundle.get("market_news", [])[:5], 1):
        print(f"  {i}. [{n.get('source', '?')[:15]}] {n['title'][:90]}")

    print("\n📅 KAP BİLDİRİMLERİ (son 30 gün)")
    for d in bundle.get("disclosures", [])[:10]:
        print(f"  • {d.get('date', '?')} | {d.get('title', '')[:80]}")

    fin = bundle.get("financials", {})
    if fin:
        print(f"\n💼 FİNANSAL (son çeyrek: {fin.get('period', '?')})")
        # En önemli 8 kalemi göster
        for k in list(fin.keys())[2:10]:  # period, ticker'ı atla
            print(f"  {k}: {fin[k]}")

    errors = bundle.get("errors", {})
    if errors:
        print("\n⚠️  HATALAR")
        for k, v in errors.items():
            print(f"  {k}: {v[:120]}")

    print("\n" + "─" * 70)
    print("  Süreler")
    print("─" * 70)
    for k, v in timings.items():
        print(f"  {k[3:]:15s}: {v}s")
    print(f"  {'TOPLAM':15s}: {sum(timings.values()):.2f}s")

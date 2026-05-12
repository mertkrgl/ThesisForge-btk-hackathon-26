"""Hızlı kullanım örnekleri — kopyala/uyarla.

Çalıştır:
    python3 examples.py
"""
import base64
import httpx
import pandas as pd
from config import MKK_API_KEY, MKK_API_SECRET


def mkk_auth() -> str:
    """Tek satırda MKK Basic Auth header."""
    return "Basic " + base64.b64encode(
        f"{MKK_API_KEY}:{MKK_API_SECRET}".encode()
    ).decode()


# ─────────────────────────────────────────────────────────
# Örnek 1: Sadece BIST listeli şirketleri çek (IGS filtresi)
# ─────────────────────────────────────────────────────────
def bist_companies_only():
    r = httpx.get(
        "https://apigwdev.mkk.com.tr/api/vyk/members",
        headers={"Authorization": mkk_auth()},
        timeout=30,
    )
    df = pd.DataFrame(r.json())
    bist = df[df["memberType"].str.contains("IGS", na=False)].copy()
    print(f"BIST listeli şirket sayısı: {len(bist)}")
    print(bist[["stockCode", "title"]].head(10).to_string())
    return bist


# ─────────────────────────────────────────────────────────
# Örnek 2: Bir şirketin son 30 günlük KAP bildirimleri
# ─────────────────────────────────────────────────────────
def last_disclosures_for_company(stock_code: str = "THYAO", limit: int = 30):
    import pykap
    from datetime import date, timedelta

    comp = pykap.BISTCompany(stock_code)
    disclosures = comp.get_historical_disclosure_list(
        fromdate=date.today() - timedelta(days=30),
        todate=date.today(),
    )
    print(f"{stock_code}: son 30 gün {len(disclosures)} bildirim")
    for d in disclosures[:limit]:
        print(f"  {d.get('publishDate', '?')[:10]} | {d.get('title', '')[:80]}")
    return disclosures


# ─────────────────────────────────────────────────────────
# Örnek 3: Son N bildirimin detayını MKK API'den çek
# ─────────────────────────────────────────────────────────
def latest_disclosure_details(count: int = 5):
    headers = {"Authorization": mkk_auth()}
    with httpx.Client(timeout=30, headers=headers) as c:
        # Son bildirim ID'sini al
        last = c.get("https://apigwdev.mkk.com.tr/api/vyk/lastDisclosureIndex").json()
        last_id = int(last["lastDisclosureIndex"])
        print(f"Son bildirim ID: {last_id}")

        # Son N bildirimin detayını al
        for i in range(count):
            disc_id = last_id - i
            r = c.get(
                f"https://apigwdev.mkk.com.tr/api/vyk/disclosureDetail/{disc_id}",
                params={"fileType": "data"},
            )
            if r.status_code != 200:
                continue
            d = r.json()
            sender = d.get("senderTitle", "?")
            subject = d.get("subject", {}).get("tr", "?")
            time_ = d.get("time", "?")
            print(f"  {disc_id} | {time_[:16]} | {sender[:40]} | {subject[:50]}")


# ─────────────────────────────────────────────────────────
# Örnek 4: THYAO fiyat verisi (yfinance, 90 gün)
# ─────────────────────────────────────────────────────────
def stock_price_90d(ticker: str = "THYAO"):
    import yfinance as yf
    df = yf.Ticker(f"{ticker}.IS").history(period="3mo")
    print(f"{ticker}: {len(df)} satır OHLCV")
    print(df.tail(5)[["Open", "High", "Low", "Close", "Volume"]].to_string())
    return df


# ─────────────────────────────────────────────────────────
# Örnek 5: THYAO finansal tablo (isyatirimhisse, IFRS)
# ─────────────────────────────────────────────────────────
def financial_statements(ticker: str = "THYAO"):
    from isyatirimhisse import fetch_financials
    df = fetch_financials(ticker, start_year=2024, end_year=2026, financial_group="1")
    print(f"{ticker}: {len(df)} satır finansal kalem")
    print(df[["FINANCIAL_ITEM_NAME_TR"] + [c for c in df.columns if "/" in str(c)][:4]].head(15).to_string())
    return df


# ─────────────────────────────────────────────────────────
# Örnek 6: Analist tavsiyesi (borsapy)
# ─────────────────────────────────────────────────────────
def analyst_recommendation(ticker: str = "THYAO"):
    import borsapy as bp
    rec = bp.Ticker(ticker).recommendations
    print(f"{ticker} analist tavsiyesi: {rec}")
    return rec


# ─────────────────────────────────────────────────────────
# Örnek 7: TCMB makro (USD/TRY son 90 gün)
# ─────────────────────────────────────────────────────────
def macro_usd_try():
    from config import TCMB_EVDS_KEY
    r = httpx.get(
        "https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.DK.USD.A.YTL"
        "&startDate=01-02-2026&endDate=12-05-2026&type=json",
        headers={"key": TCMB_EVDS_KEY},
        timeout=15,
    )
    items = r.json()["items"]
    print(f"USD/TRY son {len(items)} gün:")
    for it in items[-5:]:
        print(f"  {it['Tarih']}: {it['TP_DK_USD_A_YTL']} ₺")


if __name__ == "__main__":
    examples = [
        ("BIST şirketleri (MKK)",       bist_companies_only),
        ("Son KAP bildirimleri (MKK)",  latest_disclosure_details),
        ("THYAO son 30 gün bildirim",   last_disclosures_for_company),
        ("THYAO 90 gün OHLCV",          stock_price_90d),
        ("THYAO finansal tablo",        financial_statements),
        ("THYAO analist tavsiyesi",     analyst_recommendation),
        ("USD/TRY (TCMB)",              macro_usd_try),
    ]
    for title, fn in examples:
        print(f"\n{'='*70}\n{title}\n{'='*70}")
        try:
            fn()
        except Exception as e:
            print(f"❌ Hata: {e}")

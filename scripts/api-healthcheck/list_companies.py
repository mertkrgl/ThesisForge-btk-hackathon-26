"""Tüm KAP şirketlerini listeleme — 3 farklı yöntem.

Çalıştır:
    python3 list_companies.py mkk      # MKK API (1037 şirket, resmi)
    python3 list_companies.py pykap    # pykap (759 BIST şirketi, hızlı)
    python3 list_companies.py borsapy  # borsapy (BIST şirketleri)
"""
import base64
import sys
import httpx
import pandas as pd

from config import MKK_API_KEY, MKK_API_SECRET


def from_mkk(save_csv: bool = True) -> pd.DataFrame:
    """MKK API'den tüm üyeleri çek (1037 — şirket + fon yöneticileri dahil)."""
    auth = "Basic " + base64.b64encode(f"{MKK_API_KEY}:{MKK_API_SECRET}".encode()).decode()
    r = httpx.get(
        "https://apigwdev.mkk.com.tr/api/vyk/members",
        headers={"Authorization": auth},
        timeout=30,
    )
    r.raise_for_status()
    df = pd.DataFrame(r.json())
    print(f"MKK API'den {len(df)} üye geldi")
    print(f"Kolonlar: {list(df.columns)}")
    print(f"\nİlk 10:\n{df.head(10).to_string()}")

    if save_csv:
        out = "mkk_companies.csv"
        df.to_csv(out, index=False)
        print(f"\n✅ Kaydedildi: {out}")
    return df


def from_pykap(save_csv: bool = True) -> pd.DataFrame:
    """pykap (KAP.org.tr public API) — 759 BIST şirketi, bundled = anında."""
    import pykap
    df = pykap.get_bist_companies(online=False)  # offline = bundled, çok hızlı
    print(f"pykap'tan {len(df)} BIST şirketi geldi")
    print(f"Kolonlar: {list(df.columns)}")
    print(f"\nİlk 10:\n{df.head(10).to_string()}")

    if save_csv:
        out = "pykap_companies.csv"
        df.to_csv(out, index=False)
        print(f"\n✅ Kaydedildi: {out}")
    return df


def from_borsapy(save_csv: bool = True) -> pd.DataFrame:
    """borsapy ile BIST şirketleri."""
    import borsapy as bp
    companies = bp.companies()
    df = pd.DataFrame(companies) if not isinstance(companies, pd.DataFrame) else companies
    print(f"borsapy'den {len(df)} şirket geldi")
    print(f"Kolonlar: {list(df.columns)}")
    print(f"\nİlk 10:\n{df.head(10).to_string()}")

    if save_csv:
        out = "borsapy_companies.csv"
        df.to_csv(out, index=False)
        print(f"\n✅ Kaydedildi: {out}")
    return df


if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else "mkk"

    if source == "mkk":
        from_mkk()
    elif source == "pykap":
        from_pykap()
    elif source == "borsapy":
        from_borsapy()
    else:
        print("Kullanım: python3 list_companies.py [mkk|pykap|borsapy]")
        sys.exit(1)

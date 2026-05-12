"""BIST şirket listesi — MKK API.

Kullanım:
    from product.companies import get_bist_companies, get_company_by_ticker
    df = get_bist_companies()       # 704 BIST şirketi
    company = get_company_by_ticker("THYAO")
"""
import base64
import httpx
import pandas as pd
from config import MKK_API_KEY, MKK_API_SECRET, MKK_BASE, DEFAULT_TIMEOUT


def _mkk_auth_header() -> dict:
    raw = f"{MKK_API_KEY}:{MKK_API_SECRET}".encode()
    return {"Authorization": "Basic " + base64.b64encode(raw).decode()}


def get_all_members() -> pd.DataFrame:
    """MKK üye listesi (1037 üye: şirket + denetim + portföy)."""
    r = httpx.get(
        f"{MKK_BASE}/api/vyk/members",
        headers=_mkk_auth_header(),
        timeout=DEFAULT_TIMEOUT,
    )
    r.raise_for_status()
    return pd.DataFrame(r.json())


def get_bist_companies() -> pd.DataFrame:
    """Sadece BIST listeli şirketler (IGS memberType filtresi, ~704 şirket).

    Returns:
        DataFrame with columns: id, title, stockCode, memberType, kfifUrl
    """
    df = get_all_members()
    bist = df[df["memberType"].fillna("").str.contains("IGS")].copy()
    bist = bist.reset_index(drop=True)
    return bist


def get_company_by_ticker(ticker: str) -> dict | None:
    """Bir ticker için şirket bilgisi.

    Args:
        ticker: Hisse sembolü (ör. 'THYAO')

    Returns:
        {'id': ..., 'title': ..., 'stockCode': ..., 'memberType': ..., 'kfifUrl': ...}
        veya None
    """
    df = get_bist_companies()
    # stockCode birden fazla olabilir: "A1CAP, ACP" gibi
    matches = df[df["stockCode"].fillna("").str.contains(rf"\b{ticker}\b", regex=True)]
    if matches.empty:
        return None
    return matches.iloc[0].to_dict()


def get_funds() -> pd.DataFrame:
    """Tüm yatırım fonları (3467 fon)."""
    r = httpx.get(
        f"{MKK_BASE}/api/vyk/funds",
        headers=_mkk_auth_header(),
        timeout=30,
    )
    r.raise_for_status()
    return pd.DataFrame(r.json())


if __name__ == "__main__":
    print("=== BIST Şirketleri ===")
    bist = get_bist_companies()
    print(f"Toplam: {len(bist)} şirket\n")
    print(bist[["stockCode", "title"]].head(10).to_string())

    print("\n=== THYAO ===")
    print(get_company_by_ticker("THYAO"))

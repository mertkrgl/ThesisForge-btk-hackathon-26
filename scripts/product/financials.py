"""Finansal tablolar — isyatirimhisse primary (IFRS/XI_29 çeyreklik).

Kullanım:
    from product.financials import get_financials, get_latest_quarter
    df = get_financials("THYAO", years=2)   # Son 2 yıl çeyreklik
    q = get_latest_quarter("THYAO")          # Son çeyrek dict
"""
from datetime import date
import pandas as pd
from isyatirimhisse import fetch_financials


def get_financials(
    ticker: str,
    years: int = 2,
    financial_group: str = "1",
    exchange: str = "TRY",
) -> pd.DataFrame:
    """Çeyreklik finansal tablo.

    Args:
        ticker: BIST sembolü
        years: Son kaç yıl
        financial_group:
            '1' → XI_29 (eski format)
            '2' → UFRS
            '3' → UFRS_K (konsolide)
        exchange: 'TRY' veya 'USD'

    Returns:
        DataFrame — satırlar finansal kalemler, kolonlar çeyrekler (2024/3, 2024/6...)
    """
    current_year = date.today().year
    df = fetch_financials(
        ticker,
        start_year=current_year - years,
        end_year=current_year,
        financial_group=financial_group,
        exchange=exchange,
    )
    if df is None or df.empty:
        # Diğer formatları dene
        for group in ["2", "3"]:
            if group == financial_group:
                continue
            df = fetch_financials(
                ticker,
                start_year=current_year - years,
                end_year=current_year,
                financial_group=group,
            )
            if df is not None and not df.empty:
                df.attrs["financial_group"] = group
                return df
        raise RuntimeError(f"{ticker} için finansal veri bulunamadı")

    df.attrs["financial_group"] = financial_group
    return df


def get_latest_quarter(ticker: str) -> dict:
    """En son çeyreğin temel kalemlerini sözlük olarak döndür.

    Returns:
        {
            'period': '2024/12',
            'Dönen Varlıklar': 447533961344,
            'Duran Varlıklar': 1384442925850,
            'Hasılat': ...,
            ...
        }
    """
    df = get_financials(ticker)

    # Çeyrek kolonlarını bul (format: "2024/3", "2024/6", ...)
    quarter_cols = [c for c in df.columns if isinstance(c, str) and "/" in c]
    if not quarter_cols:
        raise RuntimeError(f"{ticker} için çeyrek kolonu bulunamadı")

    latest = quarter_cols[-1]
    name_col = "FINANCIAL_ITEM_NAME_TR"

    result = {"period": latest, "ticker": ticker}
    for _, row in df.iterrows():
        item = row.get(name_col)
        val = row.get(latest)
        if pd.notna(item) and pd.notna(val):
            result[item] = val
    return result


def _f(val) -> float | None:
    """isyatirim string sayıları float'a çevir."""
    if val is None or pd.isna(val):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def compute_basic_ratios(ticker: str) -> dict:
    """Temel oranlar — son çeyreğe göre.

    Returns:
        {
            'cari_oran': ...,  # Dönen / Kısa vadeli yükümlülükler
            'borc_ozkaynak': ...,
            'aktif_toplam': ...,
        }
    """
    q = get_latest_quarter(ticker)

    donen = _f(q.get("Dönen Varlıklar"))
    duran = _f(q.get("Duran Varlıklar"))
    kisa_borc = _f(q.get("Kısa Vadeli Yükümlülükler"))
    uzun_borc = _f(q.get("Uzun Vadeli Yükümlülükler"))
    ozkaynak = _f(q.get("Ana Ortaklığa Ait Özkaynaklar")) or _f(q.get("Özkaynaklar"))

    ratios = {"period": q["period"], "ticker": ticker}
    if donen and kisa_borc:
        ratios["cari_oran"] = round(donen / kisa_borc, 2)
    if (kisa_borc or uzun_borc) and ozkaynak:
        ratios["borc_ozkaynak"] = round(((kisa_borc or 0) + (uzun_borc or 0)) / ozkaynak, 2)
    if donen and duran:
        ratios["aktif_toplam"] = donen + duran
    return ratios


if __name__ == "__main__":
    import json
    print("=== THYAO finansal tablo ===")
    df = get_financials("THYAO", years=2)
    print(f"{len(df)} satır, kaynak: {df.attrs.get('financial_group')}")
    qcols = [c for c in df.columns if "/" in str(c)]
    print(f"Çeyrekler: {qcols}")

    print("\n=== THYAO son çeyrek ===")
    q = get_latest_quarter("THYAO")
    print(f"Dönem: {q['period']}")
    for k in list(q.keys())[1:8]:
        print(f"  {k}: {q[k]}")

    print("\n=== THYAO temel oranlar ===")
    print(json.dumps(compute_basic_ratios("THYAO"), indent=2, ensure_ascii=False, default=str))

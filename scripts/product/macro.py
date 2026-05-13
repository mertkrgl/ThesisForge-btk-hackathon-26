"""Makro veriler — TCMB EVDS.

Kullanım:
    from product.macro import get_macro_context, get_series
    ctx = get_macro_context()
    # → {"USD/TRY": 45.29, "EUR/TRY": ..., "TUFE_YoY": ..., "policy_rate": 40.0}
"""
from datetime import date, timedelta
import httpx
from config import TCMB_EVDS_KEY, TCMB_BASE, DEFAULT_TIMEOUT

# TCMB EVDS seri kodları
SERIES_USD_TRY = "TP.DK.USD.A.YTL"
SERIES_EUR_TRY = "TP.DK.EUR.A.YTL"
SERIES_TUFE = "TP.AB.A01"
SERIES_POLICY_RATE = "TP.APIFON4"


def get_series(series_code: str, start: str, end: str) -> list[dict]:
    """Tek bir seri için tarih aralığında veri çek.

    Args:
        series_code: TCMB EVDS seri kodu (ör. 'TP.DK.USD.A.YTL')
        start: 'dd-mm-yyyy'
        end: 'dd-mm-yyyy'

    Returns:
        [{'Tarih': '12-05-2026', 'TP_DK_USD_A_YTL': '45.29', ...}, ...]
    """
    url = (
        f"{TCMB_BASE}/series={series_code}"
        f"&startDate={start}&endDate={end}&type=json"
    )
    r = httpx.get(url, headers={"key": TCMB_EVDS_KEY}, timeout=DEFAULT_TIMEOUT)
    r.raise_for_status()
    return r.json().get("items", [])


def _last_valid_value(items: list[dict], col_prefix: str) -> float | None:
    """items içinde col_prefix ile başlayan kolonun son non-None değerini bul."""
    for item in reversed(items):
        for k, v in item.items():
            if k.startswith(col_prefix) and v not in (None, "", "null"):
                try:
                    return float(v)
                except (TypeError, ValueError):
                    continue
    return None


def get_macro_context() -> dict:
    """Tek çağrıda tüm makro verileri al — Macro Context Agent için.

    Returns:
        {
            'usd_try': 45.29,
            'eur_try': 50.12,
            'tufe_last': 10882.47,
            'policy_rate': 40.0,
            'as_of': '12-05-2026',
        }
    """
    end = date.today().strftime("%d-%m-%Y")
    start = (date.today() - timedelta(days=90)).strftime("%d-%m-%Y")

    result = {"as_of": end}

    try:
        usd = get_series(SERIES_USD_TRY, start, end)
        result["usd_try"] = _last_valid_value(usd, "TP_DK_USD")
    except Exception as e:
        result["usd_try"] = None
        result["_usd_err"] = str(e)

    try:
        eur = get_series(SERIES_EUR_TRY, start, end)
        result["eur_try"] = _last_valid_value(eur, "TP_DK_EUR")
    except Exception as e:
        result["eur_try"] = None

    try:
        tufe = get_series(SERIES_TUFE, start, end)
        result["tufe_last"] = _last_valid_value(tufe, "TP_AB")
    except Exception as e:
        result["tufe_last"] = None

    try:
        rate = get_series(SERIES_POLICY_RATE, start, end)
        result["policy_rate"] = _last_valid_value(rate, "TP_APIFON")
    except Exception as e:
        result["policy_rate"] = None

    return result


if __name__ == "__main__":
    import json
    print(json.dumps(get_macro_context(), indent=2, ensure_ascii=False))

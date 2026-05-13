"""Analist tavsiyesi + sektör/peer arama — borsapy.

Kullanım:
    from product.analyst import get_recommendation, search_sector
    rec = get_recommendation("THYAO")
    # → {'recommendation': 'AL', 'target_price': 455.0, 'upside_potential': 48.81}
    peers = search_sector("banka")
"""
import borsapy as bp


def get_recommendation(ticker: str) -> dict:
    """Analist konsensüs tavsiyesi.

    Returns:
        {
            'recommendation': 'AL' | 'TUT' | 'SAT',
            'target_price': 455.0,
            'upside_potential': 48.81,
        }
    """
    return bp.Ticker(ticker).recommendations or {}


def get_quick_info(ticker: str) -> dict:
    """Anlık fiyat + temel bilgi."""
    info = bp.Ticker(ticker).info
    return info or {}


def search_sector(keyword: str) -> list[str]:
    """Sektör kelimesiyle hisse arama.

    Args:
        keyword: 'banka', 'çimento', 'gayrimenkul', 'hava', vb.

    Returns:
        ['BANKA', 'BANKADD', 'BANKASIA', ...]
    """
    results = bp.search(keyword)
    return results if isinstance(results, list) else []


def screen_high_dividend() -> list[dict] | None:
    """Yüksek temettülü hisseler (borsapy template)."""
    return bp.screen_stocks(template="high_dividend")


def get_fx_rate(currency: str = "USD") -> dict:
    """Anlık döviz kuru — borsapy.

    Args:
        currency: 'USD', 'EUR', 'gram-altin', 'ceyrek-altin', vb.

    Returns:
        {'symbol': 'USD', 'last': 45.36, 'high': ..., 'low': ..., ...}
    """
    return bp.FX(currency).current or {}


if __name__ == "__main__":
    import json
    print("=== THYAO tavsiye ===")
    print(json.dumps(get_recommendation("THYAO"), indent=2, ensure_ascii=False, default=str))

    print("\n=== Banka sektörü arama ===")
    print(search_sector("banka")[:10])

    print("\n=== USD ===")
    print(json.dumps(get_fx_rate("USD"), indent=2, ensure_ascii=False, default=str))

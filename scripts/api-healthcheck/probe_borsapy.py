"""borsapy — hisse, analist, screener probe."""
import borsapy as bp
from config import TEST_TICKER


def probe() -> dict:
    results = {}

    # 1. Şirket listesi
    try:
        companies = bp.companies()
        results["companies"] = {
            "ok": True if companies is not None else False,
            "count": len(companies) if companies is not None else 0,
        }
    except Exception as e:
        results["companies"] = {"ok": False, "error": str(e)}

    # 2. Hisse anlık veri
    try:
        stock = bp.Ticker(TEST_TICKER)
        info = stock.info
        if info:
            results["ticker_info"] = {"ok": True, "keys": list(info.keys())[:8]}
        else:
            results["ticker_info"] = {"ok": False, "error": "boş yanıt"}
    except Exception as e:
        results["ticker_info"] = {"ok": False, "error": str(e)}

    # 3. OHLCV geçmişi
    try:
        stock = bp.Ticker(TEST_TICKER)
        hist = stock.history(period="1mo")
        if hist is not None and not hist.empty:
            results["ohlcv"] = {
                "ok": True,
                "rows": len(hist),
                "columns": list(hist.columns),
                "last_close": round(float(hist.iloc[-1].get("close", hist.iloc[-1].iloc[-1])), 2),
            }
        else:
            results["ohlcv"] = {"ok": False, "error": "boş DataFrame"}
    except Exception as e:
        results["ohlcv"] = {"ok": False, "error": str(e)}

    # 4. Bilanço / finansallar
    try:
        stock = bp.Ticker(TEST_TICKER)
        bs = stock.balance_sheet
        results["balance_sheet"] = {
            "ok": bs is not None and not bs.empty,
            "shape": list(bs.shape) if bs is not None and not bs.empty else None,
        }
    except Exception as e:
        results["balance_sheet"] = {"ok": False, "error": str(e)}

    # 5. Analist tavsiyesi (data.md'de primary)
    try:
        stock = bp.Ticker(TEST_TICKER)
        rec = stock.recommendations
        results["recommendations"] = {
            "ok": isinstance(rec, dict) and bool(rec),
            "data": rec,
        }
    except Exception as e:
        results["recommendations"] = {"ok": False, "error": str(e)}

    # 6. Sektör arama (peer scanner için)
    try:
        peers = bp.search("banka")
        results["sector_search"] = {
            "ok": isinstance(peers, list) and len(peers) > 0,
            "count": len(peers) if isinstance(peers, list) else 0,
            "sample": peers[:5] if isinstance(peers, list) else None,
        }
    except Exception as e:
        results["sector_search"] = {"ok": False, "error": str(e)}

    # 7. Screener (template ile)
    try:
        screened = bp.screen_stocks(template="high_dividend")
        results["screener"] = {
            "ok": screened is not None,
            "count": len(screened) if screened is not None else 0,
        }
    except Exception as e:
        results["screener"] = {"ok": False, "error": str(e)}

    # 8. Döviz (USD)
    try:
        usd = bp.FX("USD")
        rate = usd.current
        results["fx_usd"] = {"ok": rate is not None, "rate": rate}
    except Exception as e:
        results["fx_usd"] = {"ok": False, "error": str(e)}

    ok_count = sum(1 for v in results.values() if v.get("ok"))
    total = len(results)
    status = "OK" if ok_count == total else ("PARTIAL" if ok_count > 0 else "FAIL")

    note = f"{ok_count}/{total} test başarılı"
    if results.get("ohlcv", {}).get("ok"):
        note += f" | {TEST_TICKER} {results['ohlcv']['rows']} satır"
    if results.get("recommendations", {}).get("ok"):
        rec = results["recommendations"]["data"]
        if isinstance(rec, dict):
            note += f" | Tavsiye: {rec.get('recommendation')} (hedef {rec.get('target_price')})"
    if results.get("fx_usd", {}).get("ok"):
        rate = results['fx_usd']['rate']
        if isinstance(rate, dict):
            note += f" | USD/TRY: {rate.get('last')}"

    return {"status": status, "note": note, "detail": results}


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False, default=str))

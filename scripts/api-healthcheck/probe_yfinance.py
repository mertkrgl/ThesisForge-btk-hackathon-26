"""yfinance — BIST fiyat ve finansal probe."""
import yfinance as yf
from config import TEST_TICKER


def probe() -> dict:
    results = {}
    ticker_is = f"{TEST_TICKER}.IS"

    t = yf.Ticker(ticker_is)

    # 1. OHLCV 90 gün
    try:
        hist = t.history(period="3mo")
        if hist.empty:
            results["ohlcv_90d"] = {"ok": False, "error": "boş DataFrame döndü"}
        else:
            last = hist.iloc[-1]
            results["ohlcv_90d"] = {
                "ok": True,
                "rows": len(hist),
                "last_close": round(float(last["Close"]), 2),
                "last_date": str(hist.index[-1].date()),
            }
    except Exception as e:
        results["ohlcv_90d"] = {"ok": False, "error": str(e)}

    # 2. BIST100 endeksi
    try:
        xu100 = yf.Ticker("XU100.IS")
        idx = xu100.history(period="5d")
        if idx.empty:
            results["bist100"] = {"ok": False, "error": "boş DataFrame"}
        else:
            results["bist100"] = {
                "ok": True,
                "last_close": round(float(idx.iloc[-1]["Close"]), 0),
                "date": str(idx.index[-1].date()),
            }
    except Exception as e:
        results["bist100"] = {"ok": False, "error": str(e)}

    # 3. Temettü geçmişi
    try:
        div = t.dividends
        results["dividends"] = {
            "ok": True,
            "count": len(div),
            "last": str(div.index[-1].date()) if len(div) > 0 else "temettü yok",
        }
    except Exception as e:
        results["dividends"] = {"ok": False, "error": str(e)}

    # 4. Finansal tablolar (yfinance Türk hisse için zayıf — test amaçlı)
    try:
        inc = t.income_stmt
        results["income_stmt"] = {
            "ok": not inc.empty,
            "columns": list(inc.columns.astype(str))[:4] if not inc.empty else [],
            "note": "boş — yfinance TR finansalları desteklemiyor olabilir" if inc.empty else "OK",
        }
    except Exception as e:
        results["income_stmt"] = {"ok": False, "error": str(e)}

    # 5. Brent petrolü — Energy squad refining margin için kritik
    try:
        brent = yf.Ticker("BZ=F").history(period="1mo")
        if brent.empty:
            results["brent_oil"] = {"ok": False, "error": "boş DataFrame"}
        else:
            results["brent_oil"] = {
                "ok": True,
                "rows": len(brent),
                "last_close_usd": round(float(brent.iloc[-1]["Close"]), 2),
            }
    except Exception as e:
        results["brent_oil"] = {"ok": False, "error": str(e)}

    ok_count = sum(1 for v in results.values() if v.get("ok"))
    total = len(results)
    status = "OK" if ok_count == total else ("PARTIAL" if ok_count > 0 else "FAIL")

    note = f"{ok_count}/{total} test başarılı"
    if results.get("ohlcv_90d", {}).get("ok"):
        r = results["ohlcv_90d"]
        note += f" | {ticker_is} son kapanış: {r['last_close']} ({r['last_date']})"

    return {"status": status, "note": note, "detail": results}


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False))

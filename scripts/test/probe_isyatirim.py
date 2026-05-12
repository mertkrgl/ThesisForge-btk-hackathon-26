"""isyatirimhisse — BIST fiyat + IFRS finansal probe."""
from isyatirimhisse import fetch_stock_data, fetch_index_data, fetch_financials
from config import TEST_TICKER, TEST_START, TEST_END


def probe() -> dict:
    results = {}

    # 1. Hisse fiyatı
    try:
        df = fetch_stock_data(TEST_TICKER, TEST_START, TEST_END)
        if df is None or df.empty:
            results["stock_price"] = {"ok": False, "error": "boş DataFrame"}
        else:
            results["stock_price"] = {
                "ok": True,
                "rows": len(df),
                "columns": list(df.columns),
                "last_row": df.iloc[-1].to_dict(),
            }
    except Exception as e:
        results["stock_price"] = {"ok": False, "error": str(e)}

    # 2. Endeks verisi (XU100)
    try:
        idx = fetch_index_data("XU100", TEST_START, TEST_END)
        if idx is None or idx.empty:
            results["index_xu100"] = {"ok": False, "error": "boş DataFrame"}
        else:
            results["index_xu100"] = {
                "ok": True,
                "rows": len(idx),
                "columns": list(idx.columns),
            }
    except Exception as e:
        results["index_xu100"] = {"ok": False, "error": str(e)}

    # 3. Finansal tablolar — XI_29 (grup 1) — start_year + end_year zorunlu
    try:
        fin1 = fetch_financials(TEST_TICKER, start_year=2024, end_year=2026, financial_group="1")
        if fin1 is None or fin1.empty:
            results["financials_xi29"] = {"ok": False, "error": "boş DataFrame"}
        else:
            sample_cols = [str(c) for c in fin1.columns[:6]]
            results["financials_xi29"] = {
                "ok": True,
                "rows": len(fin1),
                "columns_sample": sample_cols,
                "note": "XI_29 formatı, çeyreklik",
            }
    except Exception as e:
        results["financials_xi29"] = {"ok": False, "error": str(e)}

    # 4. Finansal tablolar — UFRS (grup 2)
    try:
        fin2 = fetch_financials(TEST_TICKER, start_year=2024, end_year=2026, financial_group="2")
        if fin2 is None or fin2.empty:
            results["financials_ifrs"] = {"ok": False, "note": "boş — hisse XI_29 rapor ediyor olabilir"}
        else:
            results["financials_ifrs"] = {
                "ok": True,
                "rows": len(fin2),
                "columns_sample": [str(c) for c in fin2.columns[:6]],
            }
    except Exception as e:
        results["financials_ifrs"] = {"ok": False, "error": str(e)}

    ok_count = sum(1 for v in results.values() if v.get("ok"))
    total = len(results)
    status = "OK" if ok_count == total else ("PARTIAL" if ok_count > 0 else "FAIL")

    note = f"{ok_count}/{total} test başarılı"
    if results.get("stock_price", {}).get("ok"):
        note += f" | {TEST_TICKER} {results['stock_price']['rows']} satır"
    if results.get("financials_xi29", {}).get("ok"):
        note += f" | XI_29: {results['financials_xi29']['rows']} satır"

    return {"status": status, "note": note, "detail": results}


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False, default=str))

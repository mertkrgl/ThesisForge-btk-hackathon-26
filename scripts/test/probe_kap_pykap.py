"""pykap — KAP.org.tr wrapper probe."""
from datetime import date, timedelta
import pykap
from config import TEST_TICKER


def probe() -> dict:
    results = {}

    # 1. Şirket listesi (offline = bundled, hızlı)
    try:
        companies = pykap.get_bist_companies(online=False, output_format="dict")
        results["company_list"] = {
            "ok": True,
            "count": len(companies),
            "sample": [c.get("ticker") for c in companies[:5]],
            "mode": "offline (bundled)",
        }
    except Exception as e:
        results["company_list"] = {"ok": False, "error": str(e)}

    # 2. Şirket arama
    try:
        found = pykap.search_companies("Türk Hava")
        results["search"] = {"ok": True, "count": len(found), "first": found[0] if found else None}
    except Exception as e:
        results["search"] = {"ok": False, "error": str(e)}

    # 3. Şirket genel bilgi
    try:
        info = pykap.get_general_info(tick=TEST_TICKER)
        results["general_info"] = {"ok": True, "ticker": info.get("ticker"), "name": info.get("name")}
    except Exception as e:
        results["general_info"] = {"ok": False, "error": str(e)}

    comp = pykap.BISTCompany(TEST_TICKER)

    # 4. Tarihsel bildirimler
    try:
        hist = comp.get_historical_disclosure_list(
            fromdate=date.today() - timedelta(days=180),
            todate=date.today(),
        )
        results["historical_disclosures"] = {"ok": True, "count": len(hist), "sample": hist[:2] if hist else []}
    except Exception as e:
        results["historical_disclosures"] = {"ok": False, "error": str(e)}

    # 5. Faaliyet raporları
    try:
        reports = comp.get_disclosures("FAR")
        results["activity_reports"] = {"ok": True, "count": len(reports), "latest": reports[0] if reports else None}
    except Exception as e:
        results["activity_reports"] = {"ok": False, "error": str(e)}

    # 6. Finansal raporlar
    try:
        fin = comp.get_financial_reports()
        results["financial_reports"] = {"ok": True, "periods": list(fin.keys())[:4]}
    except Exception as e:
        results["financial_reports"] = {"ok": False, "error": str(e)}

    ok_count = sum(1 for v in results.values() if v.get("ok"))
    total = len(results)

    if ok_count == total:
        status = "OK"
    elif ok_count > 0:
        status = "PARTIAL"
    else:
        status = "FAIL"

    note = f"{ok_count}/{total} test başarılı"
    if results.get("company_list", {}).get("ok"):
        note += f" | {results['company_list']['count']} şirket"
    if results.get("historical_disclosures", {}).get("ok"):
        note += f" | {TEST_TICKER}: {results['historical_disclosures']['count']} bildirim"

    return {"status": status, "note": note, "detail": results}


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False, default=str))

"""TCMB EVDS — makro veri probe.

5 Nisan 2024 sonrası: API key URL parametresi değil, HTTP header olarak gönderilir.
Yeni base URL: https://evds3.tcmb.gov.tr/igmevdsms-dis/
"""
import httpx
from config import TCMB_EVDS_KEY

BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis"

SERIES = {
    "USD/TRY": "TP.DK.USD.A.YTL",
    "EUR/TRY": "TP.DK.EUR.A.YTL",
    "TÜFE": "TP.AB.A01",
    "Politika Faizi": "TP.APIFON4",
}


def probe() -> dict:
    if not TCMB_EVDS_KEY or TCMB_EVDS_KEY.startswith("buraya"):
        return {"status": "SKIP", "note": "TCMB_EVDS_KEY ayarlanmamış"}

    results = {}
    headers = {"key": TCMB_EVDS_KEY}
    with httpx.Client(timeout=15, follow_redirects=False, headers=headers) as client:
        for name, series in SERIES.items():
            url = (
                f"{BASE}/series={series}"
                f"&startDate=01-01-2026&endDate=12-05-2026"
                f"&type=json"
            )
            try:
                r = client.get(url)
                ct = r.headers.get("content-type", "").lower()
                if r.status_code == 200 and "json" in ct:
                    data = r.json()
                    items = data.get("items", [])
                    last = items[-1] if items else {}
                    results[name] = {"ok": True, "rows": len(items), "last": last}
                elif r.status_code == 200 and "html" in ct:
                    results[name] = {
                        "ok": False,
                        "error": "HTML döndü — API key geçersiz olabilir, "
                                 "evds3.tcmb.gov.tr → Profil → API Anahtarını Kopyala",
                    }
                else:
                    results[name] = {"ok": False, "status": r.status_code, "body": r.text[:200]}
            except Exception as e:
                results[name] = {"ok": False, "error": str(e)}

    ok_count = sum(1 for v in results.values() if v.get("ok"))
    if ok_count == len(SERIES):
        status = "OK"
    elif ok_count > 0:
        status = "PARTIAL"
    else:
        status = "FAIL"

    first_ok = next((v for v in results.values() if v.get("ok")), {})
    note = f"{ok_count}/{len(SERIES)} seri başarılı"
    if first_ok.get("last"):
        last_val = list(first_ok["last"].values())
        note += f" | Son değer örneği: {last_val[:2]}"

    return {"status": status, "note": note, "detail": results}


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False))

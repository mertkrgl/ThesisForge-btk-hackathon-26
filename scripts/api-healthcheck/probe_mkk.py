"""MKK API Gateway — KAP Veri Yayın Servisi probe.

Auth: Basic Auth → Authorization: Basic base64(apiKey:apiSecret)
Base URL: https://apigwdev.mkk.com.tr
"""
import base64
import httpx
from config import MKK_API_KEY, MKK_API_SECRET

BASE = "https://apigwdev.mkk.com.tr"

# Parametre gerektirmeyen servisler
STATIC_SERVICES = {
    "members":             "/api/vyk/members",
    "lastDisclosureIndex": "/api/vyk/lastDisclosureIndex",
    "funds":               "/api/vyk/funds",
    "blockedDisclosures":  "/api/vyk/blockedDisclosures",
}


def make_basic_token(api_key: str, api_secret: str) -> str:
    raw = f"{api_key}:{api_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def probe() -> dict:
    if not MKK_API_KEY or MKK_API_KEY.startswith("buraya"):
        return {"status": "SKIP", "note": "MKK_API_KEY ayarlanmamış"}

    token = make_basic_token(MKK_API_KEY, MKK_API_SECRET)
    headers = {"Authorization": token}

    working, errors = [], {}
    last_disclosure_id = None

    with httpx.Client(timeout=15) as client:
        # Önce statik servisleri test et
        for name, path in STATIC_SERVICES.items():
            try:
                r = client.get(BASE + path, headers=headers)
                if r.status_code == 200:
                    try:
                        body = r.json()
                        if isinstance(body, list):
                            rows = len(body)
                        elif isinstance(body, dict):
                            rows = body.get("totalElements") or body.get("count") or "dict"
                            if name == "lastDisclosureIndex":
                                last_disclosure_id = body.get("lastDisclosureIndex")
                        else:
                            rows = "?"
                    except Exception:
                        rows = "non-JSON"
                    working.append({"service": name, "rows": rows})
                else:
                    errors[name] = f"HTTP {r.status_code} — {r.text[:120]}"
            except Exception as e:
                errors[name] = str(e)

        # Dinamik ID ile parametreli servisleri test et
        if last_disclosure_id:
            dynamic = {
                "disclosures":      f"/api/vyk/disclosures?disclosureIndex={last_disclosure_id}",
                "disclosureDetail": f"/api/vyk/disclosureDetail/{last_disclosure_id}?fileType=data",
            }
            for name, path in dynamic.items():
                try:
                    r = client.get(BASE + path, headers=headers)
                    if r.status_code == 200:
                        try:
                            body = r.json()
                            rows = len(body) if isinstance(body, list) else "dict"
                        except Exception:
                            rows = "non-JSON"
                        working.append({"service": name, "rows": rows, "id_used": last_disclosure_id})
                    else:
                        errors[name] = f"HTTP {r.status_code} — {r.text[:120]}"
                except Exception as e:
                    errors[name] = str(e)
        else:
            errors["disclosures"] = "lastDisclosureIndex alınamadığı için atlandı"
            errors["disclosureDetail"] = "lastDisclosureIndex alınamadığı için atlandı"

    total = len(STATIC_SERVICES) + 2  # +2 = disclosures, disclosureDetail
    if working:
        note = f"{len(working)}/{total} servis OK: " + ", ".join(w["service"] for w in working)
        return {"status": "OK", "note": note, "detail": {"working": working, "errors": errors}}

    first_err = next(iter(errors.values()), "?")
    return {
        "status": "FAIL",
        "note": f"Hiç servis yanıt vermedi. İlk hata: {first_err}",
        "detail": {"working": [], "errors": errors},
    }


if __name__ == "__main__":
    import json
    print(json.dumps(probe(), indent=2, ensure_ascii=False))

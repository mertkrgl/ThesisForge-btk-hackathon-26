"""KAP bildirimleri — MKK API primary, pykap fallback.

Kullanım:
    from product.disclosures import (
        get_latest_disclosures,
        get_disclosure_detail,
        get_company_disclosures,
    )
    recent = get_latest_disclosures(count=20)
    detail = get_disclosure_detail(1231017)
    company = get_company_disclosures("THYAO", days=30)
"""
import base64
from datetime import date, timedelta
import httpx
from config import MKK_API_KEY, MKK_API_SECRET, MKK_BASE, DEFAULT_TIMEOUT


def _mkk_auth_header() -> dict:
    raw = f"{MKK_API_KEY}:{MKK_API_SECRET}".encode()
    return {"Authorization": "Basic " + base64.b64encode(raw).decode()}


def get_last_disclosure_id() -> int:
    """Sistemdeki en son yayınlanan bildirim ID'sini al."""
    r = httpx.get(
        f"{MKK_BASE}/api/vyk/lastDisclosureIndex",
        headers=_mkk_auth_header(),
        timeout=DEFAULT_TIMEOUT,
    )
    r.raise_for_status()
    return int(r.json()["lastDisclosureIndex"])


def get_disclosure_detail(disclosure_id: int) -> dict:
    """Bir bildirimin tam detayı.

    Returns:
        {
            'disclosureIndex': '1231017',
            'senderTitle': 'THYAO',
            'subject': {'tr': '...', 'en': '...'},
            'summary': {'tr': '...', 'en': '...'},
            'time': '12.05.2026 10:30',
            ...
        }
    """
    r = httpx.get(
        f"{MKK_BASE}/api/vyk/disclosureDetail/{disclosure_id}",
        params={"fileType": "data"},
        headers=_mkk_auth_header(),
        timeout=DEFAULT_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def get_disclosure_meta(disclosure_id: int) -> list[dict]:
    """Bir bildirimin meta bilgisi (disclosureType, disclosureClass, vb.)."""
    r = httpx.get(
        f"{MKK_BASE}/api/vyk/disclosures",
        params={"disclosureIndex": disclosure_id},
        headers=_mkk_auth_header(),
        timeout=DEFAULT_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def get_latest_disclosures(count: int = 20) -> list[dict]:
    """Son N KAP bildirimini detaylarıyla getir.

    Args:
        count: Kaç bildirim

    Returns:
        [{'disclosureIndex': ..., 'senderTitle': ..., 'subject': {...}, ...}, ...]
    """
    last_id = get_last_disclosure_id()
    results = []
    with httpx.Client(
        timeout=DEFAULT_TIMEOUT, headers=_mkk_auth_header()
    ) as c:
        for i in range(count):
            disc_id = last_id - i
            try:
                r = c.get(
                    f"{MKK_BASE}/api/vyk/disclosureDetail/{disc_id}",
                    params={"fileType": "data"},
                )
                if r.status_code == 200:
                    results.append(r.json())
            except Exception:
                continue
    return results


def get_company_disclosures(ticker: str, days: int = 30) -> list[dict]:
    """Bir şirketin son N gündeki KAP bildirimleri.

    pykap kullanır (KAP.org.tr public API) — MKK API'de ticker-bazlı
    tarihli sorgu için ek endpoint yok, pykap daha pratik.
    """
    import pykap

    comp = pykap.BISTCompany(ticker)
    return comp.get_historical_disclosure_list(
        fromdate=date.today() - timedelta(days=days),
        todate=date.today(),
    )


def get_company_financial_reports(ticker: str) -> dict:
    """Bir şirketin son finansal raporlarının parse edilmiş hali (pykap)."""
    import pykap
    return pykap.BISTCompany(ticker).get_financial_reports()


if __name__ == "__main__":
    import json
    print("=== Son bildirim ID ===")
    last_id = get_last_disclosure_id()
    print(f"ID: {last_id}")

    print("\n=== Son 5 bildirim ===")
    recent = get_latest_disclosures(count=5)
    for d in recent:
        sender = d.get("senderTitle", "?")[:40]
        subject = d.get("subject", {}).get("tr", "?")[:50] if isinstance(d.get("subject"), dict) else "?"
        time_ = d.get("time", "?")[:16]
        print(f"  {d.get('disclosureIndex')} | {time_} | {sender} | {subject}")

    print("\n=== THYAO son 30 gün ===")
    thyao = get_company_disclosures("THYAO", days=30)
    print(f"{len(thyao)} bildirim")

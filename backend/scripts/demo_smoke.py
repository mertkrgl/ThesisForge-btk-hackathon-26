"""Demo öncesi smoke testi (Rapor §5.6).

5 BIST ticker'ını sırayla pipeline'dan geçirir ve her birinin demo'da güvenle
gösterilebilir olduğunu doğrular:

  - had_kaynaksiz_flag is False
  - confidence ∈ [30, 90]  (conservative modda confidence ≤ 70 ve applied_cap=70)
  - len(bull_points) >= 3 and len(bear_points) >= 2
  - pipeline_duration < 180s

Kullanım: uvicorn 127.0.0.1:8000'de çalışırken
    python scripts/demo_smoke.py                # default mode, 5 ticker
    python scripts/demo_smoke.py conservative   # conservative mode, 2 ticker

JSON özet `demo_smoke_results[_<mode>].json` olarak yazılır. Tek bir ticker
bile assert geçemezse exit code 1.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx
import websockets


BASE = "http://127.0.0.1:8000"
WS_BASE = "ws://127.0.0.1:8000"
REPO_ROOT = Path(__file__).resolve().parents[2]

# Smoke runner kendi test user'ı ile auth eder — /chat artık JWT zorunlu.
# Env override edilebilir: SMOKE_EMAIL / SMOKE_PASSWORD.
SMOKE_EMAIL = os.getenv("SMOKE_EMAIL", "smoke-runner@example.com")
SMOKE_PASSWORD = os.getenv("SMOKE_PASSWORD", "smoke-runner-2026-pw!")
ACCESS_TOKEN: str | None = None

# Default modda 5 hisse; conservative modda Gemini quota'sını tüketmemek için 2 hisse.
# Tekil ticker test için: SMOKE_TICKERS="EREGL" veya "ASELS,GARAN" env'i set edilebilir.
TICKERS_DEFAULT = ["ASELS", "GARAN", "TUPRS", "MGROS", "EREGL"]
TICKERS_CONSERVATIVE = ["ASELS", "TUPRS"]
_TICKERS_OVERRIDE = os.getenv("SMOKE_TICKERS")
if _TICKERS_OVERRIDE:
    TICKERS_DEFAULT = [t.strip().upper() for t in _TICKERS_OVERRIDE.split(",") if t.strip()]
    TICKERS_CONSERVATIVE = TICKERS_DEFAULT
# Pipeline timeout 240s (orchestrator.run_thesis default). Pro 2.5 ortalama
# 110-135s; ASELS gibi yoğun KAP/Defense ticker'ları 180-200s bandında dönebiliyor.
# 200s smoke eşiği: Pro'nun gerçekçi üst bandı, 240s timeout'a 40s buffer korunur.
MAX_DURATION_SEC = 200.0
CONFIDENCE_MIN = 30.0
CONFIDENCE_MAX = 90.0
CONSERVATIVE_CAP = 70.0
MIN_BULL = 3
MIN_BEAR = 2

# Modül seviyesi MODE değişkeni `run_one()` tarafından okunur; main() set eder.
MODE: str = "default"


async def run_one(ticker: str) -> dict:
    """Tek ticker pipeline'ı koştur, sonuç ölçümlerini topla."""
    result: dict = {
        "ticker": ticker,
        "mode": MODE,
        "ok": False,
        "errors": [],
        "duration_sec": None,
        "confidence": None,
        "had_kaynaksiz_flag": None,
        "bull_count": None,
        "bear_count": None,
        # P0-B citation audit (sources_count WS event'inden yakalanır).
        "citation_audit": None,
        # P2-A provider observability — kategorize source_type sayaçları.
        "provider_stats": None,
    }

    print(f"\n=== {ticker} ===")
    t0 = time.time()

    # 1. POST /chat
    auth_headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"} if ACCESS_TOKEN else {}
    try:
        async with httpx.AsyncClient(timeout=30) as ac:
            r = await ac.post(
                f"{BASE}/chat",
                json={"message": f"{ticker} analiz et", "mode": MODE},
                headers=auth_headers,
            )
            r.raise_for_status()
            body = r.json()
            thesis_id = body["thesis_id"]
            ws_url = body["ws_url"]
    except Exception as e:
        result["errors"].append(f"POST /chat failed: {e}")
        return result

    # 2. WS event stream
    error_msg: str | None = None
    try:
        async with websockets.connect(f"{WS_BASE}{ws_url}") as ws:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=MAX_DURATION_SEC + 20)
                ev = json.loads(raw)
                etype = ev.get("type")
                if etype == "sources_count":
                    # P0-B audit metrikleri sources_count payload'ında yayılıyor.
                    result["citation_audit"] = {
                        "claim_count": ev.get("claim_count"),
                        "cited_claim_count": ev.get("cited_claim_count"),
                        "uncited_claim_count": ev.get("uncited_claim_count"),
                        "numeric_issue_count": ev.get("numeric_issue_count"),
                        "catalyst_count": ev.get("catalyst_count"),
                        "catalyst_cited_count": ev.get("catalyst_cited_count"),
                        "citation_retry_count": ev.get("citation_retry_count"),
                    }
                    # P2-A provider observability — aynı event'te yayılır.
                    result["provider_stats"] = ev.get("provider_stats")
                if etype == "done":
                    result["confidence"] = ev.get("confidence")
                    result["had_kaynaksiz_flag"] = ev.get("had_kaynaksiz_flag")
                    break
                if etype == "error":
                    error_msg = ev.get("msg", "?")
                    break
    except asyncio.TimeoutError:
        error_msg = "WS timeout"
    except Exception as e:
        error_msg = f"WS error: {e}"

    duration = time.time() - t0
    result["duration_sec"] = round(duration, 2)

    if error_msg:
        result["errors"].append(f"pipeline error: {error_msg}")
        return result

    # 3. GET /api/thesis/{id} — bull/bear sayısı + conservative cap doğrulaması
    try:
        async with httpx.AsyncClient(timeout=15) as ac:
            r = await ac.get(
                f"{BASE}/api/thesis/{thesis_id}", headers=auth_headers
            )
            r.raise_for_status()
            data = r.json()
            result["bull_count"] = len(data.get("bull_points") or [])
            result["bear_count"] = len(data.get("bear_points") or [])
            bd = data.get("confidence_breakdown") or {}
            result["applied_cap"] = bd.get("applied_cap")
            result["squad"] = data.get("squad")
    except Exception as e:
        result["errors"].append(f"GET /api/thesis failed: {e}")
        return result

    # ───── Assertions ─────
    if duration > MAX_DURATION_SEC:
        result["errors"].append(
            f"duration {duration:.1f}s > {MAX_DURATION_SEC}s"
        )
    conf = result["confidence"]
    if conf is None:
        result["errors"].append("confidence is None")
    elif MODE == "conservative":
        # Conservative modda confidence ≤ 70 ve applied_cap == 70 olmalı.
        if conf > CONSERVATIVE_CAP:
            result["errors"].append(
                f"conservative mode: confidence {conf} > {CONSERVATIVE_CAP}"
            )
        if result.get("applied_cap") != CONSERVATIVE_CAP:
            result["errors"].append(
                f"conservative mode: applied_cap={result.get('applied_cap')} expected {CONSERVATIVE_CAP}"
            )
    elif not (CONFIDENCE_MIN <= conf <= CONFIDENCE_MAX):
        result["errors"].append(
            f"confidence {conf} not in [{CONFIDENCE_MIN}, {CONFIDENCE_MAX}]"
        )
    if result["had_kaynaksiz_flag"] is True:
        result["errors"].append("had_kaynaksiz_flag=True (validator unhappy)")
    if (result["bull_count"] or 0) < MIN_BULL:
        result["errors"].append(
            f"bull_count {result['bull_count']} < {MIN_BULL}"
        )
    if (result["bear_count"] or 0) < MIN_BEAR:
        result["errors"].append(
            f"bear_count {result['bear_count']} < {MIN_BEAR}"
        )

    result["ok"] = not result["errors"]

    flag = "✅" if result["ok"] else "❌"
    print(
        f"{flag} {ticker}  "
        f"duration={duration:.1f}s  "
        f"confidence={conf}  "
        f"kaynaksız={result['had_kaynaksiz_flag']}  "
        f"bull={result['bull_count']}  bear={result['bear_count']}"
    )
    for err in result["errors"]:
        print(f"   ⚠ {err}")
    return result


async def _authenticate() -> str | None:
    """Smoke runner için access token edin: önce register, çakışırsa login."""
    async with httpx.AsyncClient(timeout=15) as ac:
        # Önce register dene (idempotent: 409 olursa zaten var → login).
        try:
            r = await ac.post(
                f"{BASE}/api/auth/register",
                json={
                    "email": SMOKE_EMAIL,
                    "password": SMOKE_PASSWORD,
                    "name": "Smoke Runner",
                },
            )
            if r.status_code == 201:
                return r.json()["access_token"]
        except Exception as e:
            print(f"⚠ register attempt failed (non-fatal): {e}")

        # Register başarısızsa (409 veya başka) login dene.
        try:
            r = await ac.post(
                f"{BASE}/api/auth/login",
                json={"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD},
            )
            r.raise_for_status()
            return r.json()["access_token"]
        except Exception as e:
            print(f"❌ login failed: {e}")
            return None


async def main() -> int:
    global MODE, ACCESS_TOKEN
    MODE = sys.argv[1] if len(sys.argv) > 1 else "default"
    if MODE not in ("default", "conservative"):
        print(f"❌ Geçersiz mode '{MODE}'. Kullan: default | conservative")
        return 2

    ACCESS_TOKEN = await _authenticate()
    if ACCESS_TOKEN is None:
        print("❌ Smoke için auth token alınamadı; /chat 401 ile fail edecek.")
        return 2
    print(f"✓ Auth OK ({SMOKE_EMAIL})")

    tickers = TICKERS_CONSERVATIVE if MODE == "conservative" else TICKERS_DEFAULT

    print(f"Demo smoke test — {len(tickers)} ticker, mode={MODE}")
    if MODE == "conservative":
        print(
            f"Asserts: duration<{MAX_DURATION_SEC}s | confidence ≤ {CONSERVATIVE_CAP} "
            f"| applied_cap={CONSERVATIVE_CAP} | kaynaksız=False | "
            f"bull≥{MIN_BULL}, bear≥{MIN_BEAR}"
        )
    else:
        print(
            f"Asserts: duration<{MAX_DURATION_SEC}s | "
            f"confidence∈[{CONFIDENCE_MIN},{CONFIDENCE_MAX}] | "
            f"kaynaksız=False | bull≥{MIN_BULL}, bear≥{MIN_BEAR}"
        )

    results = []
    for tic in tickers:
        results.append(await run_one(tic))

    suffix = "" if MODE == "default" else f"_{MODE}"
    out_path = REPO_ROOT / f"demo_smoke_results{suffix}.json"
    out_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\nResults → {out_path}")

    # ───── P0-B citation health aggregate özet ─────
    audits = [r["citation_audit"] for r in results if r.get("citation_audit")]
    if audits:
        def _avg_rate(num_key: str, denom_key: str) -> float | None:
            pairs = [
                (a.get(num_key) or 0, a.get(denom_key) or 0)
                for a in audits
                if a.get(denom_key)
            ]
            if not pairs:
                return None
            return round(sum(n / d for n, d in pairs) / len(pairs), 4)

        avg_numeric_issue_rate = _avg_rate("numeric_issue_count", "claim_count")
        avg_uncited_claim_rate = _avg_rate("uncited_claim_count", "claim_count")
        avg_catalyst_cited_rate = _avg_rate("catalyst_cited_count", "catalyst_count")
        avg_retry = round(
            sum(a.get("citation_retry_count") or 0 for a in audits) / len(audits), 2
        )
        print("\n=== Citation Health Aggregate ===")
        print(f"  ticker_count                = {len(audits)}")
        print(f"  avg_numeric_issue_rate      = {avg_numeric_issue_rate}")
        print(f"  avg_uncited_claim_rate      = {avg_uncited_claim_rate}")
        print(f"  avg_catalyst_cited_rate     = {avg_catalyst_cited_rate}")
        print(f"  avg_citation_retry_count    = {avg_retry}")

    # ───── P2-A provider observability aggregate ─────
    provider_stats_list = [
        r["provider_stats"] for r in results if r.get("provider_stats")
    ]
    if provider_stats_list:
        agg = {"live": 0, "fallback": 0, "fixture": 0, "stub": 0, "unknown": 0}
        for ps in provider_stats_list:
            for k in agg:
                agg[k] += ps.get(k, 0) or 0
        total_calls = sum(agg.values()) or 1
        print("\n=== Provider Observability Aggregate ===")
        print(f"  ticker_count                = {len(provider_stats_list)}")
        print(f"  total_provider_calls        = {total_calls}")
        for k in ("live", "fallback", "fixture", "stub", "unknown"):
            pct = round(agg[k] / total_calls * 100, 1)
            print(f"  {k:<27} = {agg[k]:>4}  ({pct}%)")

    passed = sum(1 for r in results if r["ok"])
    print(f"\n{passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

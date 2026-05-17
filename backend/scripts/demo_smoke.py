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
import sys
import time
from pathlib import Path

import httpx
import websockets


BASE = "http://127.0.0.1:8000"
WS_BASE = "ws://127.0.0.1:8000"
REPO_ROOT = Path(__file__).resolve().parents[2]

# Default modda 5 hisse; conservative modda Gemini quota'sını tüketmemek için 2 hisse.
TICKERS_DEFAULT = ["ASELS", "GARAN", "TUPRS", "MGROS", "EREGL"]
TICKERS_CONSERVATIVE = ["ASELS", "TUPRS"]
# Pipeline timeout 200s; ortalama 80-100s, ilk ticker cold start ~150s.
# 160s smoke eşiği: cold start'a tolerans ama 200s timeout'a hâlâ buffer var.
MAX_DURATION_SEC = 160.0
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
    }

    print(f"\n=== {ticker} ===")
    t0 = time.time()

    # 1. POST /chat
    try:
        async with httpx.AsyncClient(timeout=30) as ac:
            r = await ac.post(
                f"{BASE}/chat",
                json={"message": f"{ticker} analiz et", "mode": MODE},
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
            r = await ac.get(f"{BASE}/api/thesis/{thesis_id}")
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


async def main() -> int:
    global MODE
    MODE = sys.argv[1] if len(sys.argv) > 1 else "default"
    if MODE not in ("default", "conservative"):
        print(f"❌ Geçersiz mode '{MODE}'. Kullan: default | conservative")
        return 2
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

    passed = sum(1 for r in results if r["ok"])
    print(f"\n{passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

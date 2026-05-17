"""End-to-end smoke test: POST /chat → WS event stream → GET /api/thesis."""
import asyncio
import json
import sys
import time

import httpx
import websockets


BASE = "http://127.0.0.1:8000"
WS_BASE = "ws://127.0.0.1:8000"


async def main(ticker: str = "ASELS", mode: str = "default") -> None:
    print(f"\n━━━ 1. /health ━━━")
    async with httpx.AsyncClient(timeout=10) as ac:
        r = await ac.get(f"{BASE}/health")
        print(f"  {r.status_code} {r.json()}")

    print(f"\n━━━ 2. POST /chat (ticker={ticker}, mode={mode}) ━━━")
    async with httpx.AsyncClient(timeout=30) as ac:
        r = await ac.post(
            f"{BASE}/chat",
            json={"message": f"{ticker} analiz et", "mode": mode},
        )
        print(f"  HTTP {r.status_code}")
        body = r.json()
        print(f"  body: {json.dumps(body, ensure_ascii=False)}")
        thesis_id = body["thesis_id"]
        ws_url = body["ws_url"]

    print(f"\n━━━ 3. WS {WS_BASE}{ws_url} (event stream) ━━━")
    t0 = time.time()
    event_count = 0
    token_chars = 0
    final_done = False
    try:
        async with websockets.connect(f"{WS_BASE}{ws_url}") as ws:
            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=240.0)
                except asyncio.TimeoutError:
                    print("  (WS timeout 240s — orchestrator hala çalışıyor olabilir)")
                    break
                ev = json.loads(raw)
                event_count += 1
                t = time.time() - t0
                etype = ev.get("type")
                if etype == "token":
                    chunk = ev.get("content", "")
                    token_chars += len(chunk)
                    # Token akışını ilk 200 char'da bir kez bas, sonra sayaç
                    if token_chars - len(chunk) == 0:
                        print(f"  [{t:6.1f}s] TOKEN stream başladı...")
                    if event_count % 10 == 0:
                        print(f"  [{t:6.1f}s] tokens received: {token_chars} char")
                elif etype == "done":
                    print(f"  [{t:6.1f}s] DONE  confidence={ev.get('confidence')} kaynaksız={ev.get('had_kaynaksiz_flag')}")
                    final_done = True
                    break
                elif etype == "error":
                    print(f"  [{t:6.1f}s] ERROR {ev.get('msg')}")
                    break
                else:
                    # agent_start, stage, tool_start, tool_end
                    summary = {k: v for k, v in ev.items() if k != "type"}
                    print(f"  [{t:6.1f}s] {etype:14s} {json.dumps(summary, ensure_ascii=False)[:140]}")
    except Exception as e:
        print(f"  WS exception: {e}")

    print(f"\n━━━ 4. GET /api/thesis/{thesis_id} ━━━")
    async with httpx.AsyncClient(timeout=10) as ac:
        r = await ac.get(f"{BASE}/api/thesis/{thesis_id}")
        if r.status_code != 200:
            print(f"  HTTP {r.status_code}: {r.text}")
            return
        body = r.json()
        print(f"  ticker     : {body['ticker']}")
        print(f"  squad      : {body['squad']}")
        print(f"  confidence : {body['confidence']}")
        print(f"  kaynaksız  : {body['had_kaynaksiz_flag']}")
        bd = body.get("confidence_breakdown") or {}
        print(f"  breakdown  : data_q={bd.get('data_quality')} tech={bd.get('technical')} fund={bd.get('fundamental')} devil_inv={bd.get('devil_inverse')}")
        print(f"  bull pts   : {len(body.get('bull_points') or [])}")
        print(f"  bear pts   : {len(body.get('bear_points') or [])}")
        print(f"  catalysts  : {len(body.get('catalysts') or [])}")
        md = body.get("thesis_md") or ""
        print(f"\n  ── thesis_md ({len(md)} char) ──")
        print(md[:1500] + ("\n  ... [TRIMMED]" if len(md) > 1500 else ""))

    print(f"\n━━━ 5. GET /api/thesis/{thesis_id}/citations ━━━")
    async with httpx.AsyncClient(timeout=10) as ac:
        r = await ac.get(f"{BASE}/api/thesis/{thesis_id}/citations")
        cits = r.json() if r.status_code == 200 else []
        kn = sum(1 for c in cits if c.get("is_kaynaksiz"))
        ok = len(cits) - kn
        print(f"  toplam {len(cits)} citation  (kaynaklı={ok}, kaynaksız={kn})")

    print(f"\n━━━ ÖZET ━━━")
    print(f"  WS events    : {event_count}")
    print(f"  token chars  : {token_chars}")
    print(f"  total time   : {time.time() - t0:.1f}s")
    print(f"  status       : {'✓ DONE' if final_done else '✗ INCOMPLETE'}")


if __name__ == "__main__":
    ticker = sys.argv[1] if len(sys.argv) > 1 else "ASELS"
    mode = sys.argv[2] if len(sys.argv) > 2 else "default"
    asyncio.run(main(ticker, mode))

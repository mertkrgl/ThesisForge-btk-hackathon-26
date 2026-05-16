"""Confidence ↔ actual return kalibrasyon raporu.

Seed ve gerçek pipeline tezlerinden (outcome != pending) confidence bucket
dağılımını oku, her bucket için correct oranı ve ortalama getiri hesapla.
Stdout'a tablo, JSON çıktı docs/backtest_report.json'a kaydet.

Kullanım:
    python scripts/backtest.py
    python scripts/backtest.py --out ../docs/backtest_report.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402

from app.db.models import Thesis  # noqa: E402
from app.db.session import session_scope  # noqa: E402


# Confidence bucket sınırları (alt-üst inclusive-exclusive, son bucket'a 100 dahil).
BUCKETS: list[tuple[int, int]] = [(0, 40), (40, 60), (60, 70), (70, 80), (80, 101)]


async def _load_completed() -> list:
    """outcome != 'pending' satırları getir."""
    async with session_scope() as session:
        res = await session.execute(
            select(
                Thesis.id,
                Thesis.ticker,
                Thesis.squad,
                Thesis.confidence,
                Thesis.outcome,
                Thesis.ground_truth_return,
            ).where(Thesis.outcome != "pending")
        )
        return list(res.all())


def _bucket_for(conf: float) -> str:
    for lo, hi in BUCKETS:
        if lo <= conf < hi:
            return f"{lo}-{hi - 1 if hi <= 100 else 100}"
    return "0-39"


def _summarize_by_bucket(rows) -> list[dict]:
    by_bucket: dict[str, list] = {}
    for r in rows:
        key = _bucket_for(float(r.confidence or 0))
        by_bucket.setdefault(key, []).append(r)
    report: list[dict] = []
    for lo, hi in BUCKETS:
        key = f"{lo}-{hi - 1 if hi <= 100 else 100}"
        bucket = by_bucket.get(key, [])
        n = len(bucket)
        correct = sum(1 for r in bucket if r.outcome == "correct")
        partial = sum(1 for r in bucket if r.outcome == "partial")
        wrong = sum(1 for r in bucket if r.outcome == "wrong")
        rets = [
            float(r.ground_truth_return)
            for r in bucket
            if r.ground_truth_return is not None
        ]
        report.append(
            {
                "bucket": key,
                "n": n,
                "correct": correct,
                "partial": partial,
                "wrong": wrong,
                "correct_rate_pct": round(correct / n * 100, 1) if n else None,
                "mean_return_pct": (
                    round(statistics.mean(rets) * 100, 2) if rets else None
                ),
                "median_return_pct": (
                    round(statistics.median(rets) * 100, 2) if rets else None
                ),
            }
        )
    return report


def _summarize_by_squad(rows) -> list[dict]:
    by_squad: dict[str, list] = {}
    for r in rows:
        by_squad.setdefault(r.squad, []).append(r)
    out: list[dict] = []
    for squad, bucket in sorted(by_squad.items()):
        correct = sum(1 for r in bucket if r.outcome == "correct")
        partial = sum(1 for r in bucket if r.outcome == "partial")
        wrong = sum(1 for r in bucket if r.outcome == "wrong")
        rets = [
            float(r.ground_truth_return)
            for r in bucket
            if r.ground_truth_return is not None
        ]
        out.append(
            {
                "squad": squad,
                "n": len(bucket),
                "correct": correct,
                "partial": partial,
                "wrong": wrong,
                "correct_rate_pct": round(correct / len(bucket) * 100, 1),
                "mean_return_pct": (
                    round(statistics.mean(rets) * 100, 2) if rets else None
                ),
            }
        )
    return out


def _print_table(by_bucket: list[dict]) -> None:
    print(
        f"{'Bucket':<10}{'N':>4}{'Correct':>9}{'Partial':>9}{'Wrong':>7}"
        f"{'Correct%':>10}{'MeanRet%':>10}{'MedRet%':>10}"
    )
    print("-" * 69)
    for b in by_bucket:
        cr = b["correct_rate_pct"]
        mr = b["mean_return_pct"]
        md = b["median_return_pct"]
        print(
            f"{b['bucket']:<10}{b['n']:>4}{b['correct']:>9}{b['partial']:>9}{b['wrong']:>7}"
            f"{(cr if cr is not None else '-'):>10}"
            f"{(mr if mr is not None else '-'):>10}"
            f"{(md if md is not None else '-'):>10}"
        )


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        default=str(BACKEND_DIR.parent / "docs" / "backtest_report.json"),
        help="JSON çıktı path (default: docs/backtest_report.json)",
    )
    args = parser.parse_args()

    rows = await _load_completed()
    if not rows:
        print(
            "[error] Tamamlanmış (outcome != pending) tez yok. "
            "Önce `python scripts/seed_demo.py` çalıştır.",
            file=sys.stderr,
        )
        return 2

    by_bucket = _summarize_by_bucket(rows)
    by_squad = _summarize_by_squad(rows)

    # Global istatistikler
    all_rets = [
        float(r.ground_truth_return) for r in rows if r.ground_truth_return is not None
    ]
    global_correct = sum(1 for r in rows if r.outcome == "correct")
    high_conf = [r for r in rows if (r.confidence or 0) >= 70.0]
    high_conf_correct = sum(1 for r in high_conf if r.outcome == "correct")
    payload = {
        "total_completed": len(rows),
        "global_correct_rate_pct": round(global_correct / len(rows) * 100, 1),
        "global_mean_return_pct": (
            round(statistics.mean(all_rets) * 100, 2) if all_rets else None
        ),
        "high_confidence_summary": {
            "threshold": 70.0,
            "n": len(high_conf),
            "correct": high_conf_correct,
            "correct_rate_pct": (
                round(high_conf_correct / len(high_conf) * 100, 1) if high_conf else None
            ),
        },
        "by_confidence_bucket": by_bucket,
        "by_squad": by_squad,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print(f"=== Backtest report ({len(rows)} tez, outcome != pending) ===")
    print(f"Global correct rate: {payload['global_correct_rate_pct']}%")
    print(f"Global mean return: {payload['global_mean_return_pct']}%")
    hcs = payload["high_confidence_summary"]
    if hcs["n"]:
        print(
            f"Confidence ≥ 70: n={hcs['n']}, correct={hcs['correct']}, "
            f"correct_rate={hcs['correct_rate_pct']}%"
        )
    else:
        print("Confidence ≥ 70: hiç tez yok")
    print()
    print("Confidence bucket dağılımı:")
    _print_table(by_bucket)
    print()
    print("Squad dağılımı:")
    for s in by_squad:
        print(
            f"  {s['squad']:<12} n={s['n']:>2}  correct={s['correct']:>2}/{s['n']:<2}"
            f"  rate={s['correct_rate_pct']}%"
            f"  mean_ret={s['mean_return_pct']}%"
        )
    print(f"\n→ JSON çıktı: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

"""Gerçek BIST tarihsel getirilerinden seed_theses.json üret.

yfinance ile her ticker'ın thesis_date+~30g getirisini çekip outcome türetir.
Çıktıyı backend/fixtures/seed_theses.json'a yazar.

Kullanım:
    python scripts/build_seed_fixture.py
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

import yfinance as yf

# Her squad için BIST'ten 4-5 ticker (toplam 28).
SQUAD_TICKERS: dict[str, list[str]] = {
    "Banking":    ["GARAN", "AKBNK", "ISCTR", "YKBNK", "HALKB"],
    "Energy":     ["TUPRS", "AYGAZ", "AKSEN", "ENJSA", "IPEKE"],
    "Defense":    ["ASELS", "OTKAR", "FROTO", "TOASO"],
    "Retail":     ["BIMAS", "MGROS", "SOKM", "MAVI"],
    "RealEstate": ["EKGYO", "TRGYO", "ISGYO", "AGYO"],
    "Generic":    ["KCHOL", "SAHOL", "TCELL", "THYAO", "EREGL"],
}

# Tarih havuzu — 2024 Eylül .. 2026 Mart (18 ay), her ay'dan örnek.
DATE_POOL: list[date] = [
    date(2024, 9, 10), date(2024, 10, 22), date(2024, 11, 14),
    date(2024, 12, 5), date(2025, 1, 20), date(2025, 2, 18),
    date(2025, 3, 17), date(2025, 4, 22), date(2025, 5, 19),
    date(2025, 6, 11), date(2025, 7, 8), date(2025, 8, 26),
    date(2025, 9, 17), date(2025, 10, 14), date(2025, 11, 12),
    date(2025, 12, 9), date(2026, 1, 21), date(2026, 2, 19),
]

HORIZON_DAYS = 30


def _fetch_return(ticker: str, start: date, horizon_days: int = HORIZON_DAYS) -> float | None:
    """yfinance ile start ↔ start+horizon getirisini % olarak döndür.

    `start` trading day olmayabilir (weekend); yfinance otomatik en yakın
    trading day'den başlatır. End date'e weekend buffer ekleyerek tüm horizon
    içindeki trading day'lerin gelmesini garanti et.
    """
    end = start + timedelta(days=horizon_days + 7)
    try:
        df = yf.Ticker(f"{ticker}.IS").history(
            start=start.isoformat(), end=end.isoformat()
        )
        if df is None or df.empty or len(df) < 2:
            return None
        first_close = float(df["Close"].iloc[0])
        last_close = float(df["Close"].iloc[-1])
        if first_close <= 0:
            return None
        return round((last_close / first_close - 1.0) * 100.0, 2)
    except Exception:
        return None


def _outcome_from_return(ret_pct: float) -> str:
    if ret_pct > 5.0:
        return "correct"
    if ret_pct < -5.0:
        return "wrong"
    return "partial"


def _confidence_from_outcome(outcome: str) -> float:
    """Outcome'a hafif eğimli confidence (kurgu, demo amaçlı)."""
    if outcome == "correct":
        return round(random.uniform(60.0, 82.0), 1)
    if outcome == "wrong":
        return round(random.uniform(42.0, 68.0), 1)
    return round(random.uniform(50.0, 72.0), 1)


def _thesis_md_stub(ticker: str, squad: str, tdate: date, outcome: str, ret_pct: float) -> str:
    """Kısa kurgu thesis_md. base_rate_check bunu okumuyor; memory embedding için var."""
    return (
        f"{ticker} ({squad}) — {tdate.isoformat()} seed kaydı. "
        f"30 günlük gerçek getiri: %{ret_pct:+.2f}. Outcome={outcome}. "
        f"Bu satır base_rate ve memory altyapısının testi için demo seed verisidir; "
        f"tam pipeline çıktısı değildir."
    )


def main() -> int:
    random.seed(42)
    rows: list[dict] = []
    skipped: list[tuple[str, str]] = []

    for squad, tickers in SQUAD_TICKERS.items():
        # Her ticker için bir tarih çek (rastgele havuzdan).
        for ticker in tickers:
            tdate = random.choice(DATE_POOL)
            ret = _fetch_return(ticker, tdate)
            if ret is None:
                skipped.append((ticker, tdate.isoformat()))
                continue
            outcome = _outcome_from_return(ret)
            rows.append({
                "ticker": ticker,
                "squad": squad,
                "user_mode": "default",
                "thesis_date": tdate.isoformat(),
                "thesis_md": _thesis_md_stub(ticker, squad, tdate, outcome, ret),
                "confidence": _confidence_from_outcome(outcome),
                "outcome": outcome,
                # ground_truth_return: ratio (0.18 = %18). models.Thesis Float.
                "ground_truth_return": round(ret / 100.0, 4),
            })

    out_path = Path(__file__).resolve().parents[1] / "fixtures" / "seed_theses.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump({"theses": rows}, f, ensure_ascii=False, indent=2)

    # Özet
    print(f"wrote {len(rows)} rows → {out_path}")
    if skipped:
        print(f"skipped ({len(skipped)}): {skipped}")
    by_squad: dict[str, dict[str, int]] = {}
    for r in rows:
        by_squad.setdefault(r["squad"], {"correct": 0, "partial": 0, "wrong": 0})
        by_squad[r["squad"]][r["outcome"]] = by_squad[r["squad"]].get(r["outcome"], 0) + 1
    print("Squad dağılımı:")
    for sq, c in sorted(by_squad.items()):
        total = sum(c.values())
        rate = round(c.get("correct", 0) / total * 100, 1) if total else 0.0
        print(f"  {sq:<12} total={total:>2}  correct={c.get('correct',0):>2}  partial={c.get('partial',0):>2}  wrong={c.get('wrong',0):>2}  correct_rate={rate}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

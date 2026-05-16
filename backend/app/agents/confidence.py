"""Confidence formülü — spec §12 ağırlıklı toplam + conservative mode cap."""
from __future__ import annotations

from app.agents.schemas import ConfidenceBreakdown, UserMode

WEIGHTS: dict[str, float] = {
    "data_quality": 0.25,
    "technical": 0.20,
    "fundamental": 0.20,
    "news_macro": 0.15,
    "memory_base": 0.10,
    "devil_inverse": 0.10,
}

CONSERVATIVE_CAP: float = 70.0

# Beklenen toplam tool çağrısı sayısı (data_quality denominator).
# Pipeline boyunca her ajanın çağırması gereken tool sayısı:
#   technical_worker: 5 (ohlcv, indicators, patterns, support_resistance, relative_strength)
#   fundamental_worker: 6 (kap, financials, ratios, peers, peer_compare, dividends)
#   macro_context: 3 (tcmb, bist_index, global_signals) — recent_macro_news opsiyonel
#   devils_advocate: 3 (query_workers, disconfirming_evidence, base_rate_check)
#   memory_agent: 1 (similarity_search, deterministic)
#   sector_router: 0 (rule-based, LLM kaldırıldı — Rapor §1.4)
EXPECTED_TOOL_TOTAL: int = 18


def _clip(v: float) -> float:
    return max(0.0, min(100.0, float(v)))


def compute_confidence(
    *,
    data_quality: float,
    technical: float,
    fundamental: float,
    news_macro: float,
    memory_base: float,
    devil_inverse: float,
    user_mode: UserMode = "default",
) -> ConfidenceBreakdown:
    """Ağırlıklı bileşik güven skoru.

    `user_mode == "conservative"` → final ≤ 70 cap uygulanır.
    """
    dq = _clip(data_quality)
    te = _clip(technical)
    fu = _clip(fundamental)
    nm = _clip(news_macro)
    mb = _clip(memory_base)
    di = _clip(devil_inverse)

    raw = (
        WEIGHTS["data_quality"] * dq
        + WEIGHTS["technical"] * te
        + WEIGHTS["fundamental"] * fu
        + WEIGHTS["news_macro"] * nm
        + WEIGHTS["memory_base"] * mb
        + WEIGHTS["devil_inverse"] * di
    )

    cap = CONSERVATIVE_CAP if user_mode == "conservative" else None
    final = min(raw, cap) if cap is not None else raw

    return ConfidenceBreakdown(
        data_quality=round(dq, 2),
        technical=round(te, 2),
        fundamental=round(fu, 2),
        news_macro=round(nm, 2),
        memory_base=round(mb, 2),
        devil_inverse=round(di, 2),
        weights=dict(WEIGHTS),
        computed_raw=round(raw, 2),
        applied_cap=cap,
        final=round(final, 2),
    )


def memory_base_rate(memory_hits: list) -> float:
    """Resolved MemoryHit listesinden correct oranı; resolved hit yoksa nötr 50."""
    resolved = [
        h for h in memory_hits
        if getattr(h, "outcome", None) in {"correct", "partial", "wrong"}
    ]
    if not resolved:
        return 50.0
    correct = sum(1 for h in resolved if getattr(h, "outcome", None) == "correct")
    return (correct / len(resolved)) * 100.0

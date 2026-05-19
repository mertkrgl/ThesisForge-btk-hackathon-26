"""Confidence formülü — spec §12 ağırlıklı toplam + P1-A kalibrasyon katmanları.

P1-A katmanları (BACKEND_AGENT_KALITE_DOGRULAMA.md §4):
  1. data_quality blend: 0.8 * tool_success + 0.2 * citation_health
  2. Numeric soft cap: numeric_issue_rate > 0.2 ise final ≤ 70
  3. Memory shrink: resolved < 10 ise memory_base contribution * 0.5
"""
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
NUMERIC_CAP: float = 70.0
NUMERIC_RATE_THRESHOLD: float = 0.2
MEMORY_SHRINK_THRESHOLD: int = 10
MEMORY_SHRINK_FACTOR: float = 0.5
CITATION_BLEND_WEIGHT: float = 0.2

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
    citation_health: float | None = None,
    numeric_issue_rate: float | None = None,
    memory_resolved_count: int | None = None,
) -> ConfidenceBreakdown:
    """Ağırlıklı bileşik güven skoru.

    P1-A parametreleri opsiyonel (geriye dönük uyumlu):
      - `citation_health`: 0-100. Verildiğinde data_quality bileşeniyle blend edilir.
      - `numeric_issue_rate`: 0-1. > 0.2 ise final ≤ 70 cap uygulanır.
      - `memory_resolved_count`: <10 ise memory_base contribution yarıya iner.

    `user_mode == "conservative"` → final ≤ 70 cap uygulanır (numeric cap ile aynı eşik).
    """
    dq_raw = _clip(data_quality)
    te = _clip(technical)
    fu = _clip(fundamental)
    nm = _clip(news_macro)
    mb = _clip(memory_base)
    di = _clip(devil_inverse)

    # ── P1-A.1: data_quality blend with citation_health ──
    if citation_health is not None:
        ch = _clip(citation_health)
        dq = (1.0 - CITATION_BLEND_WEIGHT) * dq_raw + CITATION_BLEND_WEIGHT * ch
    else:
        dq = dq_raw

    # ── P1-A.3: memory shrink ──
    memory_shrink_applied = (
        memory_resolved_count is not None
        and memory_resolved_count < MEMORY_SHRINK_THRESHOLD
    )
    mb_contribution_factor = MEMORY_SHRINK_FACTOR if memory_shrink_applied else 1.0

    raw = (
        WEIGHTS["data_quality"] * dq
        + WEIGHTS["technical"] * te
        + WEIGHTS["fundamental"] * fu
        + WEIGHTS["news_macro"] * nm
        + WEIGHTS["memory_base"] * mb * mb_contribution_factor
        + WEIGHTS["devil_inverse"] * di
    )

    # ── Cap aşamaları ──
    caps: list[float] = []
    numeric_cap_applied = False
    if numeric_issue_rate is not None and numeric_issue_rate > NUMERIC_RATE_THRESHOLD:
        caps.append(NUMERIC_CAP)
        numeric_cap_applied = True
    if user_mode == "conservative":
        caps.append(CONSERVATIVE_CAP)

    cap = min(caps) if caps else None
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
        citation_health=round(_clip(citation_health), 2) if citation_health is not None else None,
        numeric_issue_rate=(
            round(float(numeric_issue_rate), 4)
            if numeric_issue_rate is not None
            else None
        ),
        numeric_cap_applied=numeric_cap_applied,
        memory_shrink_applied=memory_shrink_applied,
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


def count_resolved_memory_hits(memory_hits: list) -> int:
    """Confidence kalibrasyonu için memory_base shrink kararı: resolved hit sayısı."""
    return sum(
        1
        for h in memory_hits
        if getattr(h, "outcome", None) in {"correct", "partial", "wrong"}
    )

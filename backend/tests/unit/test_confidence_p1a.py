"""P1-A confidence kalibrasyon testleri.

BACKEND_AGENT_KALITE_DOGRULAMA.md §P1-A:
  1. data_quality blend with citation_health (0.8/0.2)
  2. Numeric soft cap @ rate > 0.2 → final ≤ 70
  3. Memory shrink: resolved < 10 → memory_base contribution * 0.5
"""
from __future__ import annotations

import pytest
from types import SimpleNamespace

from app.agents.confidence import (
    CITATION_BLEND_WEIGHT,
    MEMORY_SHRINK_FACTOR,
    NUMERIC_CAP,
    NUMERIC_RATE_THRESHOLD,
    compute_confidence,
    count_resolved_memory_hits,
)
from app.citations.validator import ValidationReport


# ─── Citation health composite formülü ───────────────────────────────


def _report(**kwargs) -> ValidationReport:
    base = dict(
        md="",
        citations=[],
        missing_uuids=[],
        invalid_uuids=[],
        numeric_issues=[],
        had_kaynaksiz=False,
        claim_count=0,
        cited_claim_count=0,
        uncited_claim_count=0,
        numeric_issue_count=0,
        catalyst_count=0,
        catalyst_cited_count=0,
        citation_retry_count=0,
    )
    base.update(kwargs)
    return ValidationReport(**base)


def test_citation_health_perfect():
    """Hepsi kaynaklı, hiç numeric issue, hiç retry → 100."""
    r = _report(
        claim_count=10,
        cited_claim_count=10,
        catalyst_count=3,
        catalyst_cited_count=3,
    )
    # 0.40*1.0 + 0.25*1.0 + 0.20*1.0 + 0.15*1.0 = 1.0
    assert r.citation_health_score == pytest.approx(100.0, abs=0.1)


def test_citation_health_no_claims():
    """Claim yoksa rate'ler 1.0 fallback (yapı sağlam say)."""
    r = _report()
    assert r.citation_health_score == pytest.approx(100.0, abs=0.1)


def test_citation_health_half_cited_half_numeric():
    r = _report(
        claim_count=10,
        cited_claim_count=5,
        numeric_issue_count=5,
        catalyst_count=2,
        catalyst_cited_count=1,
        citation_retry_count=1,
    )
    # cited_rate=0.5, numeric_rate=0.5, catalyst_rate=0.5, retry_rate=1.0
    # 0.40*0.5 + 0.25*0.5 + 0.20*0.5 + 0.15*0.0 = 0.2 + 0.125 + 0.1 + 0 = 0.425
    assert r.citation_health_score == pytest.approx(42.5, abs=0.5)


# ─── data_quality blend ──────────────────────────────────────────────


def test_data_quality_blends_with_citation_health_when_provided():
    b = compute_confidence(
        data_quality=100.0,
        technical=50,
        fundamental=50,
        news_macro=50,
        memory_base=50,
        devil_inverse=50,
        citation_health=0.0,  # En düşük citation health
        memory_resolved_count=20,
    )
    # data_quality (effective) = 0.8 * 100 + 0.2 * 0 = 80
    assert b.data_quality == pytest.approx(80.0, abs=0.1)
    assert b.citation_health == 0.0


def test_data_quality_unchanged_when_citation_health_none():
    """Geriye dönük uyum: citation_health=None → mevcut formül."""
    b = compute_confidence(
        data_quality=100.0,
        technical=50,
        fundamental=50,
        news_macro=50,
        memory_base=50,
        devil_inverse=50,
    )
    assert b.data_quality == 100.0
    assert b.citation_health is None
    assert b.numeric_cap_applied is False
    assert b.memory_shrink_applied is False


# ─── Numeric soft cap ────────────────────────────────────────────────


def test_numeric_cap_triggers_when_rate_above_threshold():
    b = compute_confidence(
        data_quality=95,
        technical=95,
        fundamental=95,
        news_macro=95,
        memory_base=95,
        devil_inverse=95,
        numeric_issue_rate=NUMERIC_RATE_THRESHOLD + 0.01,
        memory_resolved_count=20,
    )
    # Raw ~95, cap = 70
    assert b.applied_cap == NUMERIC_CAP
    assert b.final == NUMERIC_CAP
    assert b.numeric_cap_applied is True


def test_numeric_cap_not_triggered_at_threshold():
    b = compute_confidence(
        data_quality=95,
        technical=95,
        fundamental=95,
        news_macro=95,
        memory_base=95,
        devil_inverse=95,
        numeric_issue_rate=NUMERIC_RATE_THRESHOLD,  # exactly = → tetiklemez
        memory_resolved_count=20,
    )
    assert b.numeric_cap_applied is False
    assert b.applied_cap is None


# ─── Memory shrink ───────────────────────────────────────────────────


def test_memory_shrink_when_resolved_below_threshold():
    b_with_shrink = compute_confidence(
        data_quality=50,
        technical=50,
        fundamental=50,
        news_macro=50,
        memory_base=100,  # max mem score
        devil_inverse=50,
        memory_resolved_count=5,
    )
    b_no_shrink = compute_confidence(
        data_quality=50,
        technical=50,
        fundamental=50,
        news_macro=50,
        memory_base=100,
        devil_inverse=50,
        memory_resolved_count=20,
    )
    # Shrink: memory_base contribution 0.10 * 100 * 0.5 = 5 yerine 10
    # Fark = 5 puan
    assert b_with_shrink.memory_shrink_applied is True
    assert b_no_shrink.memory_shrink_applied is False
    assert b_no_shrink.computed_raw - b_with_shrink.computed_raw == pytest.approx(
        5.0, abs=0.1
    )


def test_memory_shrink_disabled_when_resolved_none():
    """resolved=None ise shrink uygulanmaz (eski path)."""
    b = compute_confidence(
        data_quality=50,
        technical=50,
        fundamental=50,
        news_macro=50,
        memory_base=100,
        devil_inverse=50,
    )
    assert b.memory_shrink_applied is False


# ─── count_resolved_memory_hits ──────────────────────────────────────


def test_count_resolved_only_counts_resolved():
    hits = [
        SimpleNamespace(outcome="correct"),
        SimpleNamespace(outcome="partial"),
        SimpleNamespace(outcome="wrong"),
        SimpleNamespace(outcome="pending"),  # resolved değil
        SimpleNamespace(outcome=None),
    ]
    assert count_resolved_memory_hits(hits) == 3
    assert count_resolved_memory_hits([]) == 0

"""Pydantic v2 modeller — spec §17.

Bu modeller agent çıktılarını ve pipeline ara temsillerini tanımlar.
LLM yapılandırılmış cevap döndürürken bu şemalara uyacak (sonraki tur).
"""
from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


SquadType = Literal[
    "Banking", "Energy", "Defense", "Retail", "RealEstate", "Generic"
]

UserMode = Literal["default", "conservative"]

OutcomeType = Literal["correct", "partial", "wrong", "pending"]


# ───────────────────────── Genel ─────────────────────────


class Observation(BaseModel):
    """Bir agent'ın bir tool çıktısına bağlı tek bir gözlem."""

    text: str
    citation_call_id: uuid.UUID
    confidence: float = Field(ge=0.0, le=100.0)


class CitationRecord(BaseModel):
    """Validator çıktısında her claim için bir kayıt."""

    claim_text: str
    call_id: uuid.UUID | None = None
    is_kaynaksiz: bool = False


# ───────────────────────── Sector Router ─────────────────────────


class SectorAssignment(BaseModel):
    ticker: str
    squad: SquadType
    confidence: float = Field(ge=0.0, le=100.0)


# ───────────────────────── Macro Context ─────────────────────────


class MacroContextOutput(BaseModel):
    paragraph: str
    usd_try: float | None = None
    eur_try: float | None = None
    tufe_yoy: float | None = None
    policy_rate: float | None = None
    bist100_change_pct: float | None = None
    observations: list[Observation] = Field(default_factory=list)


# ───────────────────────── Technical Worker ─────────────────────────


class KeyLevels(BaseModel):
    support: list[float] = Field(default_factory=list)
    resistance: list[float] = Field(default_factory=list)


class TechnicalAnalysis(BaseModel):
    ticker: str
    trend_short: Literal["bullish", "bearish", "neutral"]
    trend_long: Literal["bullish", "bearish", "neutral"]
    key_levels: KeyLevels
    momentum_score: int = Field(ge=0, le=100)
    patterns_detected: list[str] = Field(default_factory=list)
    notable_observations: list[Observation] = Field(default_factory=list)


# ───────────────────────── Fundamental Worker ─────────────────────────


class FundamentalAnalysis(BaseModel):
    model_config = ConfigDict(extra="allow")

    ticker: str
    squad: SquadType
    summary: str
    key_metrics: dict[str, float | int | str] = Field(default_factory=dict)
    peer_compare: dict[str, float] = Field(default_factory=dict)
    notable_observations: list[Observation] = Field(default_factory=list)
    fundamental_score: int = Field(ge=0, le=100)


# ───────────────────────── Devil's Advocate ─────────────────────────


class Critique(BaseModel):
    technical_pushback: list[str] = Field(default_factory=list)
    fundamental_pushback: list[str] = Field(default_factory=list)
    cross_cutting_risks: list[str] = Field(default_factory=list)
    base_rate_warnings: list[str] = Field(default_factory=list)
    overall_critique_strength: int = Field(ge=0, le=100)


# ───────────────────────── Memory ─────────────────────────


class MemoryHit(BaseModel):
    thesis_id: uuid.UUID
    ticker: str
    thesis_date: str
    distance: float
    outcome: Literal["correct", "partial", "wrong"]
    ground_truth_return: float | None = None
    summary: str


# ───────────────────────── Synthesizer Output ─────────────────────────


class ConfidenceBreakdown(BaseModel):
    data_quality: float
    technical: float
    fundamental: float
    news_macro: float
    memory_base: float
    devil_inverse: float
    weights: dict[str, float]
    computed_raw: float
    applied_cap: float | None = None
    final: float


class BullBearPoint(BaseModel):
    point: str
    call_id: uuid.UUID | None = None
    score: int = Field(ge=0, le=10)


class Catalyst(BaseModel):
    date: str  # YYYY-MM-DD
    event: str
    impact: Literal["high", "medium", "low"]
    call_id: uuid.UUID | None = None


class ThesisOutput(BaseModel):
    ticker: str
    user_mode: UserMode
    thesis_md: str
    bull_points: list[BullBearPoint] = Field(default_factory=list)
    bear_points: list[BullBearPoint] = Field(default_factory=list)
    catalysts: list[Catalyst] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=100.0)
    confidence_breakdown: ConfidenceBreakdown
    citations: list[CitationRecord] = Field(default_factory=list)
    had_kaynaksiz_flag: bool = False


# ───────────────────────── Sabit agent_id sözlüğü ─────────────────────────

AGENT_IDS = {
    "ORCHESTRATOR": "orchestrator",
    "MACRO_CONTEXT": "macro_context",
    "SECTOR_ROUTER": "sector_router",
    "TECHNICAL_WORKER": "technical_worker",
    "FUNDAMENTAL_WORKER": "fundamental_worker",
    "DEVILS_ADVOCATE": "devils_advocate",
    "SYNTHESIZER": "synthesizer",
    "MEMORY_AGENT": "memory_agent",
}

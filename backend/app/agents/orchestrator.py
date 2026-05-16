"""Orchestrator — uçtan uca tez üretimi.

Akış:
  1. create_thesis_skeleton → thesis_id
  2. PARALLEL: sector_router | macro_context | memory_search
  3. PARALLEL: technical_worker | fundamental_worker
  4. devils_advocate
  5. data_quality = (başarılı tool çağrısı / toplam) * 100
  6. compute_confidence(...) → ConfidenceBreakdown
  7. synthesizer → markdown
  8. validate_citations(retry_fn=...) → onaylı md
  9. extract_structured → bull/bear/catalysts
 10. update_thesis_synthesis (persist)
 11. asyncio.create_task(write_thesis_embedding_async)
 12. websocket_emit ile final markdown chunked stream
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any, Awaitable, Callable

from app.agents import (
    devils_advocate as devil_mod,
    fundamental_worker as fund_mod,
    macro_context as macro_mod,
    memory_agent as mem_mod,
    sector_router as sec_mod,
    synthesizer as synth_mod,
    technical_worker as tech_mod,
)
from app.agents.confidence import compute_confidence, memory_base_rate
from app.agents.schemas import (
    ConfidenceBreakdown,
    Critique,
    FundamentalAnalysis,
    MacroContextOutput,
    MemoryHit,
    SectorAssignment,
    TechnicalAnalysis,
)
from app.agents.tools import AgentContext
from app.citations.validator import validate_citations
from app.core.logging import log
from app.db.repo import (
    count_tool_calls_for_thesis,
    create_thesis_skeleton,
    update_thesis_synthesis,
)
from app.db.session import session_scope


# Optional WS emit callback signature
EmitFn = Callable[[dict[str, Any]], Awaitable[None]]


# ───────────────────────── Helpers ─────────────────────────


async def _safe_emit(emit: EmitFn | None, event: dict[str, Any]) -> None:
    if emit is None:
        return
    try:
        await emit(event)
    except Exception as e:
        log.warning("ws_emit_fail", error=str(e)[:200])


async def _chunked_emit(
    md: str, emit: EmitFn | None, chunk_size: int = 60
) -> None:
    """Onaylı markdown'ı küçük token event'leri olarak parça parça yolla."""
    if emit is None or not md:
        return
    for i in range(0, len(md), chunk_size):
        chunk = md[i : i + chunk_size]
        await _safe_emit(emit, {"type": "token", "content": chunk})
        # küçük bir yapay aralık — UI'de "yazılıyor" hissi
        await asyncio.sleep(0.04)


async def _run_isolated(
    thesis_id: uuid.UUID, agent_id: str, factory
):
    """Yeni session aç, AgentContext oluştur, factory(ctx)'i çağır, commit et.

    Paralel `asyncio.gather` ile çalıştırılan branch'lerin aynı SQLAlchemy
    AsyncSession'ı paylaşması mümkün değil (concurrent execute → çakışma).
    Bu yardımcı, her branch'a izole bir session verir.
    """
    async with session_scope() as session:
        ctx = AgentContext(
            thesis_id=thesis_id, agent_id=agent_id, session=session
        )
        try:
            result = await factory(ctx)
            await session.commit()
            return result
        except Exception:
            await session.rollback()
            raise


def _news_macro_score(macro: MacroContextOutput) -> float:
    """Aşama 7 baseline: makro paragraf üretildiyse 60, üretilmediyse 40.

    Aşama 13+ news sentiment provider eklendiğinde burası incelenir.
    """
    if macro.paragraph and "alınamadı" not in macro.paragraph:
        return 60.0
    return 40.0


# ───────────────────────── Public entry ─────────────────────────


async def run_thesis(
    ticker: str,
    *,
    user_id: uuid.UUID | None = None,
    user_mode: str = "default",
    thesis_id: uuid.UUID | None = None,
    websocket_emit: EmitFn | None = None,
    timeout_sec: float = 120.0,
) -> uuid.UUID:
    """Tek bir tezi uçtan uca üret. thesis_id döndürür.

    `thesis_id` verilirse skeleton INSERT atlanır (API caller önce skeleton
    oluşturup id'yi WS subscriber'a vermek isteyebilir).

    Hata yönetimi: her ajan kendi try/except'iyle graceful fallback yapıyor.
    Orchestrator seviyesinde sadece üst watchdog timeout var.
    """

    async def _pipeline() -> uuid.UUID:
        return await _run_thesis_inner(
            ticker=ticker,
            user_id=user_id,
            user_mode=user_mode,
            thesis_id=thesis_id,
            emit=websocket_emit,
        )

    try:
        return await asyncio.wait_for(_pipeline(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        log.error("thesis_pipeline_timeout", ticker=ticker, timeout=timeout_sec)
        await _safe_emit(
            websocket_emit,
            {"type": "error", "msg": f"Pipeline timeout ({timeout_sec}s)"},
        )
        raise


async def _run_thesis_inner(
    *,
    ticker: str,
    user_id: uuid.UUID | None,
    user_mode: str,
    thesis_id: uuid.UUID | None,
    emit: EmitFn | None,
) -> uuid.UUID:
    upper = ticker.upper()
    if thesis_id is None:
        async with session_scope() as session:
            # ───── 1. skeleton INSERT ─────
            thesis_id = await create_thesis_skeleton(
                session,
                ticker=upper,
                user_id=user_id,
                user_mode=user_mode,
                squad="Generic",  # sector_router sonra override eder
            )
            await session.commit()  # downstream session'lar bu satırı görebilsin

    # ───── ctx hazırla ─────
    # Her ajan kendi `with_agent(...)` çağrısıyla agent_id'yi günceller.
    async with session_scope() as session:
        ctx = AgentContext(
            thesis_id=thesis_id, agent_id="orchestrator", session=session
        )

        await _safe_emit(
            emit,
            {
                "type": "agent_start",
                "agent": "orchestrator",
                "thesis_id": str(thesis_id),
                "ticker": upper,
                "user_mode": user_mode,
            },
        )

        # ───── 2. PARALLEL 3-bacak (her birine fresh session) ─────
        await _safe_emit(emit, {"type": "stage", "stage": "parallel_3_bacak"})
        sector, macro, memory_hits = await asyncio.gather(
            _run_isolated(
                thesis_id, "sector_router",
                lambda c: sec_mod.run_sector_router(c, upper),
            ),
            _run_isolated(
                thesis_id, "macro_context",
                lambda c: macro_mod.run_macro_context(c),
            ),
            _run_isolated(
                thesis_id, "memory_agent",
                lambda c: mem_mod.search_memory(c, upper, top_k=3),
            ),
            return_exceptions=False,
        )
        sector: SectorAssignment
        macro: MacroContextOutput
        memory_hits: list[MemoryHit]
        squad = sector.squad

        # ───── 3. PARALLEL 2-worker (fresh session per worker) ─────
        await _safe_emit(
            emit, {"type": "stage", "stage": "parallel_workers", "squad": squad}
        )
        tech, fund = await asyncio.gather(
            _run_isolated(
                thesis_id, "technical_worker",
                lambda c: tech_mod.run_technical_worker(c, upper),
            ),
            _run_isolated(
                thesis_id, "fundamental_worker",
                lambda c: fund_mod.run_fundamental_worker(c, upper, squad=squad),
            ),
            return_exceptions=False,
        )
        tech: TechnicalAnalysis
        fund: FundamentalAnalysis

        # ───── 4. Devil's Advocate (orchestrator session OK — sıralı) ─────
        await _safe_emit(emit, {"type": "stage", "stage": "devils_advocate"})
        critique: Critique = await devil_mod.run_devils_advocate(
            ctx, upper, tech, fund, memory_hits=memory_hits
        )
        # Critique persist edilmiyor; tüketicilerin (run_thesis.py vs UI)
        # ham counter-argümanları görebilmesi için WS üzerinden yayınla.
        await _safe_emit(
            emit, {"type": "critique", "critique": critique.model_dump(mode="json")}
        )

        # ───── 5. data_quality + 6. confidence ─────
        total, success = await count_tool_calls_for_thesis(session, thesis_id)
        data_quality = (success / total * 100.0) if total else 0.0
        breakdown: ConfidenceBreakdown = compute_confidence(
            data_quality=data_quality,
            technical=float(tech.momentum_score),
            fundamental=float(fund.fundamental_score),
            news_macro=_news_macro_score(macro),
            memory_base=memory_base_rate(memory_hits),
            devil_inverse=100.0 - float(critique.overall_critique_strength),
            user_mode=user_mode,  # type: ignore[arg-type]
        )

        # ───── 7. Synthesizer + 8. Validator (retry) ─────
        await _safe_emit(emit, {"type": "stage", "stage": "synthesizer"})

        async def _retry_fn(feedback: str) -> str:
            log.info("synth_retry", thesis_id=str(thesis_id))
            return await synth_mod.run_synthesizer(
                ctx,
                ticker=upper,
                macro=macro,
                tech=tech,
                fund=fund,
                critique=critique,
                memory_hits=memory_hits,
                confidence_breakdown=breakdown,
                user_mode=user_mode,
                feedback=feedback,
            )

        thesis_md = await synth_mod.run_synthesizer(
            ctx,
            ticker=upper,
            macro=macro,
            tech=tech,
            fund=fund,
            critique=critique,
            memory_hits=memory_hits,
            confidence_breakdown=breakdown,
            user_mode=user_mode,
        )

        await _safe_emit(emit, {"type": "stage", "stage": "validator"})
        report = await validate_citations(
            thesis_md, thesis_id, session, synthesizer_retry_fn=_retry_fn
        )

        # ───── 9. Structured extract (bull/bear/catalysts) ─────
        structured = await synth_mod.extract_structured(
            ctx, ticker=upper, thesis_md=report.md
        )

        # ───── 10. Persist ─────
        await update_thesis_synthesis(
            session,
            thesis_id,
            thesis_md=report.md,
            bull_points=[p.model_dump(mode="json") for p in structured.bull_points],
            bear_points=[p.model_dump(mode="json") for p in structured.bear_points],
            catalysts=[c.model_dump(mode="json") for c in structured.catalysts],
            confidence=breakdown.final,
            confidence_breakdown=breakdown.model_dump(mode="json"),
            squad=squad,
        )
        await session.commit()

        # ───── 11. Embed fire-and-forget ─────
        asyncio.create_task(
            mem_mod.write_thesis_embedding_async(thesis_id, report.md)
        )

        # ───── 12. WS final stream + done ─────
        await _chunked_emit(report.md, emit)
        await _safe_emit(
            emit,
            {
                "type": "done",
                "thesis_id": str(thesis_id),
                "confidence": breakdown.final,
                "had_kaynaksiz_flag": report.had_kaynaksiz,
            },
        )
        return thesis_id

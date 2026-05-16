"""Orchestrator — uçtan uca tez üretimi.

Akış (DAG — sıralı bariyer yerine fine-grained dependency):
  1. create_thesis_skeleton → thesis_id
  2. dispatch: sector_router | macro_context | memory_agent | technical_worker (paralel)
     sector_router biter bitmez → fundamental_worker da kuyruğa girer
  3. devils_advocate (tech + fund + memory hazır olur olmaz; macro'yu beklemez)
  4. macro'yu burada bekle (synthesizer'a gerekli)
  5. data_quality + compute_confidence
  6. synthesizer → markdown
  7. validate_citations(retry_fn=...) → onaylı md
  8. extract_structured ‖ chunked WS stream (paralel)
  9. update_thesis_synthesis (persist)
 10. asyncio.create_task(write_thesis_embedding_async)
 11. done event
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
from app.agents.confidence import (
    EXPECTED_TOOL_TOTAL,
    compute_confidence,
    memory_base_rate,
)
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
    md: str, emit: EmitFn | None, chunk_size: int = 250
) -> None:
    """Onaylı markdown'ı küçük token event'leri olarak parça parça yolla.

    Rapor §2.4: önceki konfig (chunk=60, sleep=0.04) 5400 char md için 3.6s
    yapay bekleme yaratıyordu. Yeni: chunk=250 + sleep=0.015 → ~0.3s.
    """
    if emit is None or not md:
        return
    for i in range(0, len(md), chunk_size):
        chunk = md[i : i + chunk_size]
        await _safe_emit(emit, {"type": "token", "content": chunk})
        await asyncio.sleep(0.015)


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
    """Macro paragrafının `sentiment_score`'unu 0-100 bandına eşle.

    macro.sentiment_score ∈ [-100, +100]; lineer dönüşüm: 50 + sentiment*0.5.
    Paragraf üretilemediyse (degrade path) sabit 40.
    """
    if not macro.paragraph or "alınamadı" in macro.paragraph:
        return 40.0
    score = 50.0 + macro.sentiment_score * 0.5
    return max(0.0, min(100.0, score))


# ───────────────────────── Public entry ─────────────────────────


async def run_thesis(
    ticker: str,
    *,
    user_id: uuid.UUID | None = None,
    user_mode: str = "default",
    thesis_id: uuid.UUID | None = None,
    websocket_emit: EmitFn | None = None,
    timeout_sec: float = 200.0,
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

        # ───── 2. Geniş DAG: bağımsız ajanları aynı anda başlat ─────
        # technical_worker hiçbir önceki çıktıya bağımlı değil; sector/macro/memory
        # ile aynı anda başlatılabilir. fundamental_worker sadece sector.squad'a
        # bağımlı — sector_router (genelde rule-based ~0ms) biter bitmez kuyruğa
        # girer. Devil's Advocate macro'yu kullanmıyor; macro yalnızca
        # synthesizer'dan hemen önce bekleniyor.
        await _safe_emit(emit, {"type": "stage", "stage": "agents_dispatched"})

        sector_task = asyncio.create_task(_run_isolated(
            thesis_id, "sector_router",
            lambda c: sec_mod.run_sector_router(c, upper),
        ))
        macro_task = asyncio.create_task(_run_isolated(
            thesis_id, "macro_context",
            lambda c: macro_mod.run_macro_context(c),
        ))
        memory_task = asyncio.create_task(_run_isolated(
            thesis_id, "memory_agent",
            lambda c: mem_mod.search_memory(c, upper, top_k=3),
        ))
        tech_task = asyncio.create_task(_run_isolated(
            thesis_id, "technical_worker",
            lambda c: tech_mod.run_technical_worker(c, upper),
        ))

        sector: SectorAssignment = await sector_task
        squad = sector.squad
        await _safe_emit(
            emit, {"type": "stage", "stage": "workers_started", "squad": squad}
        )

        fund_task = asyncio.create_task(_run_isolated(
            thesis_id, "fundamental_worker",
            lambda c: fund_mod.run_fundamental_worker(c, upper, squad=squad),
        ))

        # Devil's Advocate için gerekli üçlü: tech + fund + memory
        tech, fund, memory_hits = await asyncio.gather(
            tech_task, fund_task, memory_task, return_exceptions=False,
        )
        tech: TechnicalAnalysis
        fund: FundamentalAnalysis
        memory_hits: list[MemoryHit]

        # ───── 3. Devil's Advocate (macro'yu beklemiyor) ─────
        await _safe_emit(emit, {"type": "stage", "stage": "devils_advocate"})
        critique: Critique = await devil_mod.run_devils_advocate(
            ctx, upper, tech, fund, memory_hits=memory_hits
        )

        # Macro yalnızca synthesizer'a girmeden hemen önce beklenir.
        macro: MacroContextOutput = await macro_task
        # Critique persist edilmiyor; tüketicilerin (run_thesis.py vs UI)
        # ham counter-argümanları görebilmesi için WS üzerinden yayınla.
        await _safe_emit(
            emit, {"type": "critique", "critique": critique.model_dump(mode="json")}
        )

        # ───── 5. data_quality + 6. confidence ─────
        # Rapor §1.1: total == success her zaman (hata path'inde INSERT atılmıyor).
        # Bu yüzden beklenen toplam (EXPECTED_TOOL_TOTAL) denominator olarak kullanıyoruz.
        # Tool fail olursa success<beklenen → data_quality düşer.
        _, success = await count_tool_calls_for_thesis(session, thesis_id)
        data_quality = min(success / EXPECTED_TOOL_TOTAL * 100.0, 100.0)
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

        try:
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
        except synth_mod.SynthesizerError as e:
            # Rapor §4.2: önceki davranış `_FALLBACK_MD`'yi stream ediyordu
            # ("Sentez ajanı çalışamadı..."). Artık kullanıcıya placeholder yazmak yerine
            # explicit error event yayınla ve pipeline'ı sonlandır.
            log.error(
                "synthesizer_unrecoverable",
                ticker=upper,
                thesis_id=str(thesis_id),
                error=str(e)[:200],
            )
            await _safe_emit(
                emit,
                {
                    "type": "error",
                    "msg": (
                        "Sentez ajanı geçici olarak çalışmıyor "
                        "(Gemini Pro 503/429). Lütfen 1 dakika sonra tekrar deneyin."
                    ),
                },
            )
            raise

        await _safe_emit(emit, {"type": "stage", "stage": "validator"})
        report = await validate_citations(
            thesis_md, thesis_id, session, synthesizer_retry_fn=_retry_fn
        )

        # ───── 9. Structured extract + WS stream PARALEL ─────
        # extract_structured ayrı bir LLM çağrısı (~5-15s). Kullanıcının
        # markdown'ı görmek için bunu beklemesine gerek yok — chunked emit'i
        # paralel başlat. Her iki coroutine de bağımsız (extract sadece
        # report.md okur, emit yalnızca WS'e yazar).
        structured, _ = await asyncio.gather(
            synth_mod.extract_structured(ctx, ticker=upper, thesis_md=report.md),
            _chunked_emit(report.md, emit),
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
            memory_hits=[h.model_dump(mode="json") for h in memory_hits],
            squad=squad,
        )
        await session.commit()

        # ───── 11. Embed fire-and-forget ─────
        asyncio.create_task(
            mem_mod.write_thesis_embedding_async(thesis_id, report.md)
        )

        # ───── 12. done event ─────
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

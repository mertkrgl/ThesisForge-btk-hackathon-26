"""Technical Worker — RSI/MACD/SR/RS bazlı teknik analiz, Flash model.

momentum_score LLM'den değil, Python post-processor'dan gelir (Rapor §1.2).
LLM aritmetik yapmıyor; tool sonuçlarındaki ham RSI/MACD/RS değerleri
`tool_call_logs.result` JSON'undan çekilip clip'li formülle hesaplanır.
"""
from __future__ import annotations

import asyncio
import json

from sqlalchemy import select

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import KeyLevels, Observation, TechnicalAnalysis
from app.agents import tool_registry as tr
from app.agents.tools import AgentContext
from app.core.logging import log
from app.db.models import ToolCallLog
from app.db.session import session_scope


def _agent():
    return build_agent(
        name="technical_worker",
        system_prompt=read_prompt("technical_worker.md"),
        tools=[],
        use_pro=False,
        structured_output_model=TechnicalAnalysis,
    )


def _empty(ticker: str) -> TechnicalAnalysis:
    return TechnicalAnalysis(
        ticker=ticker.upper(),
        trend_short="neutral",
        trend_long="neutral",
        key_levels=KeyLevels(),
        momentum_score=50,
        patterns_detected=[],
        notable_observations=[],
    )


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


async def _run_tool_isolated(
    parent_ctx: AgentContext, tool_name: str, **kwargs
) -> dict:
    """Run one logged tool with its own DB session.

    Worker-level parallelism must not share SQLAlchemy AsyncSession instances.
    Each tool call commits its own tool_call_logs row, then the analysis LLM
    receives the returned call_id/result bundle.
    """
    fn = tr.TOOLS[tool_name]
    async with session_scope() as tool_session:
        child_ctx = parent_ctx.with_agent("technical_worker")
        child_ctx.session = tool_session
        try:
            result = await fn(child_ctx, **kwargs)
            await tool_session.commit()
            return result
        except Exception:
            await tool_session.rollback()
            raise


async def _collect_technical_tools(ctx: AgentContext, ticker: str) -> dict[str, dict]:
    """Collect all required technical tool results concurrently."""
    if ctx.session is None:
        return {}
    specs = {
        "get_ohlcv": {"ticker": ticker, "days": 90},
        "calculate_indicators": {"ticker": ticker, "days": 90},
        "detect_patterns": {"ticker": ticker, "days": 90},
        "find_support_resistance": {"ticker": ticker, "days": 90},
        "relative_strength": {"ticker": ticker, "days": 90, "index_code": "XU100"},
    }
    tasks = {
        name: asyncio.create_task(_run_tool_isolated(ctx, name, **kwargs))
        for name, kwargs in specs.items()
    }
    results: dict[str, dict] = {}
    gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
    for name, item in zip(tasks.keys(), gathered, strict=True):
        if isinstance(item, Exception):
            log.warning(
                "technical_tool_prefetch_fail",
                ticker=ticker,
                tool=name,
                error=str(item)[:200],
            )
            continue
        results[name] = item
    return results


def _compact_tool_results(results: dict[str, dict]) -> str:
    """Bound prompt size while preserving call_id and numeric payloads."""
    compact: dict[str, dict] = {}
    for name, bundle in results.items():
        result = bundle.get("result")
        if name == "get_ohlcv" and isinstance(result, dict):
            payload = result.get("payload") or {}
            ohlcv = payload.get("ohlcv") or []
            payload = dict(payload)
            if isinstance(ohlcv, list):
                payload["ohlcv"] = ohlcv[-8:]
            result = {**result, "payload": payload}
        compact[name] = {
            "call_id": bundle.get("call_id"),
            "result": result,
        }
    text = json.dumps(compact, ensure_ascii=False, default=str, indent=2)
    return text[:14000]


def _call_id(results: dict[str, dict], tool_name: str) -> str:
    value = results.get(tool_name, {}).get("call_id")
    return value if isinstance(value, str) else ""


def _citation_for_observation(text: str, results: dict[str, dict]) -> str:
    lower = text.lower()
    if any(k in lower for k in ("rsi", "macd", "bollinger", "atr", "sma", "ema")):
        return _call_id(results, "calculate_indicators")
    if any(k in lower for k in ("destek", "direnç", "support", "resistance")):
        return _call_id(results, "find_support_resistance")
    if any(k in lower for k in ("göreli", "relative", "xu100", "endeks")):
        return _call_id(results, "relative_strength")
    if any(k in lower for k in ("golden", "death", "formasyon", "pattern", "kesişim")):
        return _call_id(results, "detect_patterns")
    if any(k in lower for k in ("fiyat", "hacim", "kapanış")):
        return _call_id(results, "get_ohlcv") or _call_id(results, "calculate_indicators")
    return _call_id(results, "calculate_indicators")


def _normalize_observation_citations(
    analysis: TechnicalAnalysis, tool_results: dict[str, dict]
) -> TechnicalAnalysis:
    """Replace LLM-hallucinated observation UUIDs with logged tool call IDs."""
    normalized: list[Observation] = []
    for obs in analysis.notable_observations:
        call_id = _citation_for_observation(obs.text, tool_results)
        normalized.append(
            obs.model_copy(update={"citation_call_id": call_id or obs.citation_call_id})
        )
    return analysis.model_copy(update={"notable_observations": normalized})


_PATTERN_KEYWORDS = (
    "golden", "death", "kesişim", "formasyon", "pattern", "breakout",
    "breakdown", "bayrak", "flag",
)


def _ensure_pattern_observation(
    analysis: TechnicalAnalysis, tool_results: dict[str, dict]
) -> TechnicalAnalysis:
    """LLM pattern observation üretmediyse, detect_patterns tool sonucundan
    deterministic bir observation ekle.

    Synthesizer Bull/Bear Case'inde "Golden Cross yaklaşıyor" gibi pattern
    cümleleri kaynaklayabilmek için tool UUID'sinin observation pool'unda
    bulunması gerek. LLM bazen patterns_detected listesini doldursa bile
    notable_observations'a pattern observation'ı koymuyor → cümle kaynaksız.
    """
    has_pattern_obs = any(
        any(kw in (obs.text or "").lower() for kw in _PATTERN_KEYWORDS)
        for obs in analysis.notable_observations
    )
    if has_pattern_obs:
        return analysis

    bundle = tool_results.get("detect_patterns") or {}
    call_id = bundle.get("call_id")
    if not isinstance(call_id, str) or not call_id:
        return analysis

    result = bundle.get("result") or {}
    if isinstance(result, dict):
        payload = result.get("payload") or result
        detected = (
            payload.get("patterns")
            or payload.get("detected")
            or payload.get("signals")
            or analysis.patterns_detected
            or []
        )
    else:
        detected = analysis.patterns_detected or []

    if detected:
        # Pattern adlarını basit Türkçeleştirme + ilk 3'ünü göster
        names = ", ".join(str(d) for d in detected[:3])
        text = f"Tespit edilen teknik formasyon(lar): {names}."
    else:
        text = (
            "Belirgin teknik formasyon yok; trend ve momentum göstergeleri "
            "açık bir tetikleyici sinyal vermiyor."
        )

    pattern_obs = Observation(
        text=text,
        citation_call_id=call_id,
        confidence=75.0,
    )
    new_observations = list(analysis.notable_observations) + [pattern_obs]
    return analysis.model_copy(update={"notable_observations": new_observations})


def _compute_momentum_from_tools(
    indicators_payload: dict | None,
    rs_payload: dict | None,
) -> int:
    """RSI / MACD histogram / RS değerlerinden 0-100 momentum skoru.

    Bileşen sınırları (Rapor §1.2):
      - RSI delta = clip(RSI - 50, -25, +25)   → tek bileşen [-25, +25]
      - MACD = ±10  (histogram sign'a göre)
      - RS = ±15    (RS % yön ve büyüklüğe göre: |RS|≥5 → ±15, |RS|<5 → orantılı)
    Toplam delta aralığı [-50, +50], baseline 50 → final aralık [0, 100].
    """
    rsi: float | None = None
    macd_hist: float | None = None
    rs_pct: float | None = None

    if indicators_payload:
        ind = indicators_payload.get("indicators") or {}
        rsi_raw = ind.get("rsi_14")
        macd_raw = ind.get("macd_hist")
        if isinstance(rsi_raw, (int, float)):
            rsi = float(rsi_raw)
        if isinstance(macd_raw, (int, float)):
            macd_hist = float(macd_raw)

    if rs_payload:
        rs_raw = rs_payload.get("relative_strength_pct")
        if isinstance(rs_raw, (int, float)):
            rs_pct = float(rs_raw)

    # Veri yoksa nötr
    if rsi is None and macd_hist is None and rs_pct is None:
        return 50

    delta = 0.0

    if rsi is not None:
        delta += _clip(rsi - 50.0, -25.0, 25.0)

    if macd_hist is not None:
        if macd_hist > 0:
            delta += 10.0
        elif macd_hist < 0:
            delta -= 10.0
        # macd_hist == 0 → 0

    if rs_pct is not None:
        # |RS|≥5 → ±15; daha küçükse linear scaling
        if rs_pct >= 5.0:
            delta += 15.0
        elif rs_pct <= -5.0:
            delta -= 15.0
        else:
            delta += rs_pct * 3.0  # rs 1% → ±3, 5% → ±15 (sınırda match)

    score = _clip(50.0 + delta, 0.0, 100.0)
    return int(round(score))


async def _fetch_indicator_payloads(
    ctx: AgentContext, ticker: str
) -> tuple[dict | None, dict | None]:
    """tool_call_logs'tan calculate_indicators ve relative_strength sonuçlarını oku.

    Aynı tez içinde aynı tool birden çok kez çağrıldıysa SONUNCUSU alınır
    (en güncel ölçüm; teknik tarafta zaten 1 kez çağrılması beklenir).
    """
    indicators: dict | None = None
    rs: dict | None = None
    try:
        q = (
            select(ToolCallLog.tool_name, ToolCallLog.result)
            .where(ToolCallLog.thesis_id == ctx.thesis_id)
            .where(ToolCallLog.agent_id == "technical_worker")
            .where(
                ToolCallLog.tool_name.in_(
                    ["calculate_indicators", "relative_strength"]
                )
            )
            .order_by(ToolCallLog.ts.asc())
        )
        res = await ctx.session.execute(q)
        for tool_name, result in res.all():
            if not isinstance(result, dict):
                continue
            if tool_name == "calculate_indicators":
                # _fetch döner: {"source": ..., "payload": {"indicators": {...}}}
                payload = result.get("payload")
                if isinstance(payload, dict):
                    indicators = payload
            elif tool_name == "relative_strength":
                # relative_strength direkt dict döner (relative_strength_pct top-level)
                rs = result
    except Exception as e:
        log.warning(
            "momentum_fetch_fail", ticker=ticker, error=str(e)[:200]
        )
    return indicators, rs


async def run_technical_worker(ctx: AgentContext, ticker: str) -> TechnicalAnalysis:
    """Teknik analiz üret. momentum_score Python'da hesaplanıp override edilir."""
    ctx = ctx.with_agent("technical_worker")
    upper = ticker.upper()
    try:
        agent = _agent()
        tool_results = await _collect_technical_tools(ctx, upper)
        out = await run_agent_with_context(
            agent,
            (
                f"{upper} için teknik analiz üret. Tool sonuçları sistem tarafından "
                "önceden paralel toplandı; tool çağırma. Aşağıdaki JSON'daki "
                "`call_id` değerlerini observation.citation_call_id alanlarında kullan.\n\n"
                f"## Pre-collected tool results\n{_compact_tool_results(tool_results)}"
            ),
            ctx,
            output_model=TechnicalAnalysis,
        )
        if isinstance(out, TechnicalAnalysis):
            tech = out
        else:
            tech = TechnicalAnalysis.model_validate(out)
        if tech.ticker.upper() != upper:
            tech = tech.model_copy(update={"ticker": upper})
        tech = _normalize_observation_citations(tech, tool_results)
        tech = _ensure_pattern_observation(tech, tool_results)

        # ───── Python post-processor: momentum_score ─────
        ind_payload, rs_payload = await _fetch_indicator_payloads(ctx, upper)
        new_score = _compute_momentum_from_tools(ind_payload, rs_payload)
        if new_score != tech.momentum_score:
            log.info(
                "momentum_override",
                ticker=upper,
                llm_value=tech.momentum_score,
                computed=new_score,
            )
        return tech.model_copy(update={"momentum_score": new_score})
    except Exception as e:
        log.warning("technical_worker_fail", ticker=upper, error=str(e)[:200])
        return _empty(upper)

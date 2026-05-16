"""Fundamental Worker — squad'a özgü prompt seçimiyle, Flash model."""
from __future__ import annotations

import asyncio
import json
from typing import cast

from app.agents import tool_registry as tr
from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import FundamentalAnalysis, Observation, SquadType
from app.agents.sector_map import prompt_file_for_squad
from app.agents.tools import AgentContext
from app.core.logging import log
from app.db.session import session_scope


def _agent(squad: str):
    """Squad'a göre system_prompt değişen fresh Agent."""
    prompt_filename = prompt_file_for_squad(squad)
    return build_agent(
        name=f"fundamental_worker_{squad.lower()}",
        system_prompt=read_prompt(prompt_filename),
        tools=[],
        use_pro=False,
        structured_output_model=FundamentalAnalysis,
    )


def _empty(ticker: str, squad: str) -> FundamentalAnalysis:
    return FundamentalAnalysis(
        ticker=ticker.upper(),
        squad=cast(SquadType, squad if squad in {"Banking", "Energy", "Defense", "Retail", "RealEstate", "Generic"} else "Generic"),
        summary="Fundamental veriler şu anda alınamadı.",
        key_metrics_json="{}",
        peer_compare_json="{}",
        notable_observations=[],
        fundamental_score=50,
    )


async def _run_tool_isolated(
    parent_ctx: AgentContext, tool_name: str, **kwargs
) -> dict:
    """Run one logged fundamental tool with its own DB session."""
    fn = tr.TOOLS[tool_name]
    async with session_scope() as tool_session:
        child_ctx = parent_ctx.with_agent("fundamental_worker")
        child_ctx.session = tool_session
        try:
            result = await fn(child_ctx, **kwargs)
            await tool_session.commit()
            return result
        except Exception:
            await tool_session.rollback()
            raise


async def _collect_fundamental_tools(ctx: AgentContext, ticker: str) -> dict[str, dict]:
    """Collect all required fundamental tool results concurrently."""
    if ctx.session is None:
        return {}
    specs = {
        "fetch_kap_filings": {"ticker": ticker, "days": 30},
        "get_financial_statements": {"ticker": ticker, "years": 2},
        "compute_ratios": {"ticker": ticker},
        "get_sector_peers": {"ticker": ticker},
        "compare_to_peers": {"ticker": ticker},
        "get_dividend_history": {"ticker": ticker},
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
                "fundamental_tool_prefetch_fail",
                ticker=ticker,
                tool=name,
                error=str(item)[:200],
            )
            continue
        results[name] = item
    return results


def _compact_tool_results(results: dict[str, dict]) -> str:
    """Bound prompt size while preserving call_id and useful payloads."""
    compact: dict[str, dict] = {}
    for name, bundle in results.items():
        result = bundle.get("result")
        if name in {"get_financial_statements", "fetch_kap_filings"} and isinstance(result, dict):
            payload = result.get("payload")
            if isinstance(payload, dict):
                payload = dict(payload)
                for key in ("rows", "statements", "filings", "items"):
                    value = payload.get(key)
                    if isinstance(value, list):
                        payload[key] = value[:8]
                result = {**result, "payload": payload}
        compact[name] = {
            "call_id": bundle.get("call_id"),
            "result": result,
        }
    text = json.dumps(compact, ensure_ascii=False, default=str, indent=2)
    return text[:16000]


def _call_id(results: dict[str, dict], tool_name: str) -> str:
    value = results.get(tool_name, {}).get("call_id")
    return value if isinstance(value, str) else ""


def _citation_for_observation(text: str, results: dict[str, dict]) -> str:
    lower = text.lower()
    if any(k in lower for k in ("kap", "açıklama", "duyuru", "bedelsiz", "geri alım")):
        return _call_id(results, "fetch_kap_filings")
    if "temettü" in lower or "payout" in lower:
        return _call_id(results, "get_dividend_history")
    if any(k in lower for k in ("peer", "emsal", "sektör medyan", "sektör ortalama")):
        return _call_id(results, "compare_to_peers") or _call_id(results, "compute_ratios")
    if any(k in lower for k in ("gelir", "ebitda", "ltm", "operasyonel ölçek")):
        return _call_id(results, "get_financial_statements") or _call_id(results, "compute_ratios")
    if any(
        k in lower
        for k in (
            "p/e", "fiyat/kazanç", "piyasa değeri", "roe", "roic", "cari oran",
            "borç", "özkaynak", "marj", "kaldıraç", "likidite", "nim", "car",
            "npl", "casa",
        )
    ):
        return _call_id(results, "compute_ratios")
    return _call_id(results, "compute_ratios") or _call_id(results, "get_financial_statements")


def _normalize_observation_citations(
    analysis: FundamentalAnalysis, tool_results: dict[str, dict]
) -> FundamentalAnalysis:
    """Replace LLM-hallucinated observation UUIDs with logged tool call IDs."""
    normalized: list[Observation] = []
    for obs in analysis.notable_observations:
        call_id = _citation_for_observation(obs.text, tool_results)
        normalized.append(
            obs.model_copy(update={"citation_call_id": call_id or obs.citation_call_id})
        )
    return analysis.model_copy(update={"notable_observations": normalized})


async def run_fundamental_worker(
    ctx: AgentContext, ticker: str, squad: str = "Generic"
) -> FundamentalAnalysis:
    """Squad'a özgü prompt ile fundamental analiz; hata olursa nötr fallback."""
    ctx = ctx.with_agent("fundamental_worker")
    upper = ticker.upper()
    try:
        agent = _agent(squad)
        tool_results = await _collect_fundamental_tools(ctx, upper)
        out = await run_agent_with_context(
            agent,
            (
                f"{upper} (squad={squad}) için fundamental analiz üret. Tool sonuçları "
                "sistem tarafından önceden paralel toplandı; tool çağırma. Aşağıdaki "
                "JSON'daki `call_id` değerlerini observation.citation_call_id alanlarında kullan.\n\n"
                f"## Pre-collected tool results\n{_compact_tool_results(tool_results)}"
            ),
            ctx,
            output_model=FundamentalAnalysis,
        )
        if isinstance(out, FundamentalAnalysis):
            if out.ticker.upper() != upper:
                out = out.model_copy(update={"ticker": upper})
            return _normalize_observation_citations(out, tool_results)
        return _normalize_observation_citations(
            FundamentalAnalysis.model_validate(out), tool_results
        )
    except Exception as e:
        log.warning(
            "fundamental_worker_fail",
            ticker=upper,
            squad=squad,
            error=str(e)[:200],
        )
        return _empty(upper, squad)

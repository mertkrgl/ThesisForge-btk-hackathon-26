"""Spec §7.2 sabit tool isimleri için @tool dekoratörlü deterministik wrapper'lar.

LLM henüz devrede değil — bu wrapper'lar ChainedDataProvider'ı çağırır
ve UUID damgasını üretir. Aşama 6'da Strands `Agent(tools=[...])` listesine
geçecek olan callable'lar bunlar.

Memory agent araçları (embed_text, similarity_search, write_thesis_embedding)
OpenAI key gelene kadar STUB.
"""
from __future__ import annotations

import random
from typing import Any

from app.agents.sector_map import (
    load_sector_map,
    metrics_for_squad,
    squad_for_ticker,
)
from app.agents.tools import AgentContext, tool
from app.data.providers.base import ProviderResult


def _registry(ctx: AgentContext) -> dict:
    """Tool runtime'ında DataProvider chain'ine erişim.

    Agent test kodu özel registry inject ederse ctx.registry kullanılır,
    aksi halde global build_registry() lazy-load edilir.
    """
    if ctx.registry:
        return ctx.registry
    from app.data.registry import get_registry

    return get_registry()


async def _fetch(ctx: AgentContext, domain: str, **kwargs) -> dict[str, Any]:
    """Provider çağrısının ortak yardımcısı."""
    reg = _registry(ctx)
    chain = reg.get(domain)
    if chain is None:
        raise KeyError(f"unknown registry domain: {domain}")
    result: ProviderResult = await chain.fetch(**kwargs)
    return result.model_dump()


# ───────────────────────── Macro Context ─────────────────────────


@tool("get_tcmb_indicators")
async def get_tcmb_indicators(ctx: AgentContext, **_) -> dict[str, Any]:
    return await _fetch(ctx, "macro")


@tool("get_bist_index_state")
async def get_bist_index_state(
    ctx: AgentContext, *, index_code: str = "XU100", days: int = 90
) -> dict[str, Any]:
    return await _fetch(ctx, "index", index_code=index_code, days=days)


@tool("get_global_signals")
async def get_global_signals(ctx: AgentContext, *, days: int = 30) -> dict[str, Any]:
    """Brent + USD/TRY kombinasyonu. Tek payload."""
    brent = await _fetch(ctx, "brent", days=days)
    fx = await _fetch(ctx, "fx", currency="USD")
    return {"brent": brent, "usd": fx}


@tool("get_recent_macro_news")
async def get_recent_macro_news(ctx: AgentContext, *, count: int = 10) -> dict[str, Any]:
    return await _fetch(ctx, "news_market", count=count)


# ───────────────────────── Orchestrator ─────────────────────────


@tool("validate_ticker")
async def validate_ticker(ctx: AgentContext, *, ticker: str) -> dict[str, Any]:
    """Ticker MKK'da var mı?"""
    return await _fetch(ctx, "company_lookup", ticker=ticker)


@tool("get_macro_context")
async def get_macro_context_tool(ctx: AgentContext, **_) -> dict[str, Any]:
    return await _fetch(ctx, "macro")


# ───────────────────────── Sector Router ─────────────────────────


@tool("lookup_sector")
async def lookup_sector(ctx: AgentContext, *, ticker: str) -> dict[str, Any]:
    sm = load_sector_map()
    upper = ticker.upper()
    for squad, cfg in sm.items():
        tickers = cfg.get("tickers") if isinstance(cfg, dict) else None
        if tickers and upper in tickers:
            return {"ticker": upper, "squad": squad, "metrics": cfg.get("metrics", [])}
    return {"ticker": upper, "squad": "Generic", "metrics": sm.get("Generic", {}).get("metrics", [])}


@tool("select_squad")
async def select_squad(ctx: AgentContext, *, ticker: str) -> dict[str, Any]:
    squad = squad_for_ticker(ticker)
    return {
        "ticker": ticker.upper(),
        "squad": squad,
        "metrics": metrics_for_squad(squad),
    }


# ───────────────────────── Technical Worker ─────────────────────────


@tool("get_ohlcv")
async def get_ohlcv(
    ctx: AgentContext, *, ticker: str, days: int = 90
) -> dict[str, Any]:
    return await _fetch(ctx, "price", ticker=ticker, days=days)


@tool("calculate_indicators")
async def calculate_indicators(
    ctx: AgentContext, *, ticker: str, days: int = 90
) -> dict[str, Any]:
    return await _fetch(ctx, "technicals", ticker=ticker, days=days)


@tool("detect_patterns")
async def detect_patterns(
    ctx: AgentContext, *, ticker: str, days: int = 90
) -> dict[str, Any]:
    """Mevcut basit pattern dedektörü — daha gelişmiş hali sonraki turda."""
    tech = await _fetch(ctx, "technicals", ticker=ticker, days=days)
    ind = tech.get("payload", {}).get("indicators", {})
    patterns: list[str] = []
    sma20 = ind.get("sma_20")
    sma50 = ind.get("sma_50")
    rsi = ind.get("rsi_14")
    if sma20 and sma50:
        if sma20 > sma50:
            patterns.append("golden_cross_proximity")
        elif sma20 < sma50:
            patterns.append("death_cross_proximity")
    if rsi:
        if rsi > 70:
            patterns.append("rsi_overbought")
        if rsi < 30:
            patterns.append("rsi_oversold")
    return {"ticker": ticker.upper(), "patterns": patterns, "based_on": ind}


@tool("find_support_resistance")
async def find_support_resistance(
    ctx: AgentContext, *, ticker: str, days: int = 90
) -> dict[str, Any]:
    """Bollinger üst/alt + son N bar local min/max'tan basit S/R."""
    price = await _fetch(ctx, "price", ticker=ticker, days=days)
    tech = await _fetch(ctx, "technicals", ticker=ticker, days=days)
    ind = tech.get("payload", {}).get("indicators", {})
    bb_upper = ind.get("bb_upper")
    bb_lower = ind.get("bb_lower")
    ohlcv = price.get("payload", {}).get("ohlcv", [])
    closes = [r.get("Close") for r in ohlcv if r.get("Close") is not None]
    support: list[float] = []
    resistance: list[float] = []
    if closes:
        sorted_closes = sorted(closes)
        n = len(sorted_closes)
        support.append(round(float(sorted_closes[max(0, n // 10)]), 2))
        resistance.append(round(float(sorted_closes[min(n - 1, n - n // 10 - 1)]), 2))
    if bb_lower:
        support.append(round(float(bb_lower), 2))
    if bb_upper:
        resistance.append(round(float(bb_upper), 2))
    return {
        "ticker": ticker.upper(),
        "support": sorted(set(support)),
        "resistance": sorted(set(resistance)),
    }


@tool("relative_strength")
async def relative_strength(
    ctx: AgentContext, *, ticker: str, days: int = 90, index_code: str = "XU100"
) -> dict[str, Any]:
    """Hissenin endekse karşı performansı (%)."""
    p = await _fetch(ctx, "price", ticker=ticker, days=days)
    idx = await _fetch(ctx, "index", index_code=index_code, days=days)

    def _change(payload):
        last = payload.get("last_close")
        first = payload.get("first_close")
        if last is None or first is None or first == 0:
            return None
        return round((last - first) / first * 100, 2)

    stock_pct = _change(p.get("payload", {}))
    index_pct = _change(idx.get("payload", {}))
    rs = (stock_pct - index_pct) if (stock_pct is not None and index_pct is not None) else None
    return {
        "ticker": ticker.upper(),
        "index_code": index_code,
        "stock_change_pct": stock_pct,
        "index_change_pct": index_pct,
        "relative_strength_pct": rs,
    }


# ───────────────────────── Fundamental Worker ─────────────────────────


@tool("fetch_kap_filings")
async def fetch_kap_filings(
    ctx: AgentContext, *, ticker: str, days: int = 30
) -> dict[str, Any]:
    return await _fetch(ctx, "kap_company", ticker=ticker, days=days)


@tool("get_financial_statements")
async def get_financial_statements(
    ctx: AgentContext, *, ticker: str, years: int = 2
) -> dict[str, Any]:
    return await _fetch(ctx, "financials", ticker=ticker, years=years)


@tool("compute_ratios")
async def compute_ratios(ctx: AgentContext, *, ticker: str) -> dict[str, Any]:
    return await _fetch(ctx, "ratios", ticker=ticker)


@tool("get_sector_peers")
async def get_sector_peers(ctx: AgentContext, *, ticker: str) -> dict[str, Any]:
    squad = squad_for_ticker(ticker)
    sm = load_sector_map()
    cfg = sm.get(squad, {}) or {}
    peers = [t for t in (cfg.get("tickers") or []) if t.upper() != ticker.upper()]
    return {"ticker": ticker.upper(), "squad": squad, "peers": peers}


@tool("compare_to_peers")
async def compare_to_peers(
    ctx: AgentContext, *, ticker: str
) -> dict[str, Any]:
    """Her peer için ratios çek, basit dict döndür. Hata olan peer atlanır."""
    squad = squad_for_ticker(ticker)
    sm = load_sector_map()
    cfg = sm.get(squad, {}) or {}
    peer_tickers = [t for t in (cfg.get("tickers") or []) if t.upper() != ticker.upper()][:3]

    out: dict[str, Any] = {"ticker": ticker.upper(), "squad": squad, "peers": {}}
    for p in peer_tickers:
        try:
            r = await _fetch(ctx, "ratios", ticker=p)
            out["peers"][p] = r.get("payload", {})
        except Exception:
            out["peers"][p] = None
    return out


@tool("get_dividend_history")
async def get_dividend_history(
    ctx: AgentContext, *, ticker: str
) -> dict[str, Any]:
    return await _fetch(ctx, "dividend", ticker=ticker)


# ───────────────────────── Devil's Advocate ─────────────────────────


@tool("query_workers")
async def query_workers(
    ctx: AgentContext, *, ticker: str
) -> dict[str, Any]:
    """Bu deterministik form sadece teknik + temel özet döner.
    Asıl LLM tabanlı sorgulama Aşama 7'de eklenecek.
    """
    tech = await _fetch(ctx, "technicals", ticker=ticker)
    ratios = await _fetch(ctx, "ratios", ticker=ticker)
    return {
        "technical": tech.get("payload", {}),
        "fundamental": ratios.get("payload", {}),
    }


@tool("find_disconfirming_evidence")
async def find_disconfirming_evidence(
    ctx: AgentContext, *, ticker: str
) -> dict[str, Any]:
    """Şirketle ilgili son haberlerdeki olumsuz sinyaller — placeholder."""
    news = await _fetch(ctx, "news_company", ticker=ticker, count=10)
    return {"ticker": ticker.upper(), "news_snapshot": news.get("payload", {})}


@tool("base_rate_check")
async def base_rate_check(
    ctx: AgentContext, *, squad: str
) -> dict[str, Any]:
    """Squad'ın geçmiş başarı oranı — DB'den outcome aggregate."""
    from sqlalchemy import func, select

    from app.db.models import Thesis

    res = await ctx.session.execute(
        select(Thesis.outcome, func.count())
        .where(Thesis.squad == squad)
        .where(Thesis.outcome != "pending")
        .group_by(Thesis.outcome)
    )
    rows = res.all()
    counts = {r[0]: int(r[1]) for r in rows}
    total = sum(counts.values())
    success_rate = (
        round((counts.get("correct", 0) / total) * 100, 2) if total else None
    )
    return {
        "squad": squad,
        "total_completed": total,
        "outcomes": counts,
        "success_rate_pct": success_rate,
    }


# ───────────────────────── Memory Agent — Gemini embedding + pgvector ─────────────────────────


@tool("embed_text")
async def embed_text(
    ctx: AgentContext, *, text: str, dimensions: int | None = None
) -> dict[str, Any]:
    """Gemini text-embedding-004 ile 768-dim vektör."""
    from app.agents.embedding import embed_text as _embed

    return await _embed(text, dimensions=dimensions)


@tool("similarity_search")
async def similarity_search(
    ctx: AgentContext, *, query_text: str, ticker: str | None = None, top_k: int = 3
) -> dict[str, Any]:
    """pgvector cosine ile benzer geçmiş tezler.

    Filtreler:
      - aynı ticker VEYA aynı squad
      - outcome != 'pending'
      - thesis_date son 2 yıl
    """
    from app.agents.embedding import embed_text as _embed
    from app.agents.sector_map import squad_for_ticker
    from app.db.repo import similarity_search as _repo_search

    emb = await _embed(query_text)
    squad = squad_for_ticker(ticker) if ticker else None
    rows = await _repo_search(
        ctx.session,
        embedding=emb["vector"],
        ticker=ticker,
        squad=squad,
        exclude_thesis_id=ctx.thesis_id,
        include_pending=True,
        top_k=top_k,
    )
    hits = [
        {
            "thesis_id": str(r["id"]),
            "ticker": r["ticker"],
            "thesis_date": r["thesis_date"].isoformat() if r["thesis_date"] else None,
            "distance": float(r["distance"]) if r["distance"] is not None else None,
            "outcome": r["outcome"],
            "ground_truth_return": (
                float(r["ground_truth_return"]) if r["ground_truth_return"] is not None else None
            ),
            "confidence": float(r["confidence"]) if r.get("confidence") is not None else None,
            "squad": r.get("squad"),
            "summary": (r["thesis_md"] or "")[:600],
        }
        for r in rows
    ]
    return {
        "query": query_text[:120],
        "filter": {"ticker": ticker, "squad": squad, "top_k": top_k},
        "hits": hits,
        "embed_stub": emb.get("stub", False),
    }


@tool("write_thesis_embedding")
async def write_thesis_embedding(
    ctx: AgentContext, *, thesis_id: str, text: str
) -> dict[str, Any]:
    """Tez markdown'ını embed et ve `theses.embedding`'e yaz."""
    import uuid as _uuid

    from sqlalchemy import update

    from app.agents.embedding import embed_text as _embed
    from app.db.models import Thesis

    emb = await _embed(text)
    tid = _uuid.UUID(thesis_id) if isinstance(thesis_id, str) else thesis_id
    await ctx.session.execute(
        update(Thesis).where(Thesis.id == tid).values(embedding=emb["vector"])
    )
    return {
        "thesis_id": str(tid),
        "wrote_dimensions": emb["dimensions"],
        "model": emb["model"],
        "stub": emb.get("stub", False),
    }


# ───────────────────────── Tool name registry ─────────────────────────

TOOLS: dict[str, Any] = {
    "get_tcmb_indicators": get_tcmb_indicators,
    "get_bist_index_state": get_bist_index_state,
    "get_global_signals": get_global_signals,
    "get_recent_macro_news": get_recent_macro_news,
    "validate_ticker": validate_ticker,
    "get_macro_context": get_macro_context_tool,
    "lookup_sector": lookup_sector,
    "select_squad": select_squad,
    "get_ohlcv": get_ohlcv,
    "calculate_indicators": calculate_indicators,
    "detect_patterns": detect_patterns,
    "find_support_resistance": find_support_resistance,
    "relative_strength": relative_strength,
    "fetch_kap_filings": fetch_kap_filings,
    "get_financial_statements": get_financial_statements,
    "compute_ratios": compute_ratios,
    "get_sector_peers": get_sector_peers,
    "compare_to_peers": compare_to_peers,
    "get_dividend_history": get_dividend_history,
    "query_workers": query_workers,
    "find_disconfirming_evidence": find_disconfirming_evidence,
    "base_rate_check": base_rate_check,
    "embed_text": embed_text,
    "similarity_search": similarity_search,
    "write_thesis_embedding": write_thesis_embedding,
}

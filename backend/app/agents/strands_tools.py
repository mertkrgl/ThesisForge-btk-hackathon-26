"""Strands-uyumlu tool wrapper'ları.

Mimari:
  - `app/agents/tool_registry.py` içindeki fonksiyonlar `AgentContext`'i
    explicit param olarak alır ve `@tool(name)` ile UUID damgalar.
  - Strands `Agent(tools=[...])` ise tool çağrısında sadece LLM
    argümanlarını verir; AgentContext'i bilmez. Bu yüzden burada her
    tool için Strands @tool decorator'lü ince bir wrapper var: contextvar'dan
    AgentContext'i okur, underlying fonksiyonu çağırır, sonucu LLM'e döner.

Tool çağrısı sonrası `current_agent_context` üzerinden `last_call_id`
güncellenir. Sentez sırasında bu UUID'ler Synthesizer prompt'una enjekte
edilir ve `[kaynak: <uuid>]` etiketi olarak basılır.
"""
from __future__ import annotations

from typing import Any

from strands import tool as strands_tool

from app.agents import tool_registry as tr
from app.agents.tools import get_current_context


async def _invoke(name: str, **kwargs) -> dict[str, Any]:
    """Tüm Strands wrapper'larının ortak entry'si."""
    ctx = get_current_context()
    fn = tr.TOOLS[name]
    return await fn(ctx, **kwargs)


# ───────────────────────── Macro Context tools ─────────────────────────


@strands_tool
async def get_tcmb_indicators() -> dict[str, Any]:
    """USD/TRY, EUR/TRY, TÜFE ve TCMB politika faizinin son değerlerini döner.

    Returns:
        ProviderResult-shape dict with payload.usd_try, payload.eur_try, payload.tufe_last, payload.policy_rate.
    """
    return await _invoke("get_tcmb_indicators")


@strands_tool
async def get_bist_index_state(index_code: str = "XU100", days: int = 90) -> dict[str, Any]:
    """BIST endeksinin son N günlük OHLCV verisini döner.

    Args:
        index_code: 'XU100', 'XBANK', 'XU030' vb.
        days: Geçmiş gün sayısı.
    """
    return await _invoke("get_bist_index_state", index_code=index_code, days=days)


@strands_tool
async def get_global_signals(days: int = 30) -> dict[str, Any]:
    """Brent ve USD kuru kompozit makro sinyalleri."""
    return await _invoke("get_global_signals", days=days)


@strands_tool
async def get_recent_macro_news(count: int = 10) -> dict[str, Any]:
    """Genel piyasa/makro haber akışı (Google News RSS)."""
    return await _invoke("get_recent_macro_news", count=count)


# ───────────────────────── Orchestrator tools ─────────────────────────


@strands_tool
async def validate_ticker(ticker: str) -> dict[str, Any]:
    """Verilen BIST ticker MKK kayıtlarında geçerli mi? Şirket meta'sını döner."""
    return await _invoke("validate_ticker", ticker=ticker)


@strands_tool
async def get_macro_context() -> dict[str, Any]:
    """Macro Context cache'inden TCMB makro paragraf verisi."""
    return await _invoke("get_macro_context")


# ───────────────────────── Sector Router tools ─────────────────────────


@strands_tool
async def lookup_sector(ticker: str) -> dict[str, Any]:
    """sector_map.yaml'dan ticker'ın squad'ını ve metriklerini döner."""
    return await _invoke("lookup_sector", ticker=ticker)


@strands_tool
async def select_squad(ticker: str) -> dict[str, Any]:
    """Bir ticker için squad ataması: Banking/Energy/Defense/Retail/RealEstate/Generic."""
    return await _invoke("select_squad", ticker=ticker)


# ───────────────────────── Technical Worker tools ─────────────────────────


@strands_tool
async def get_ohlcv(ticker: str, days: int = 90) -> dict[str, Any]:
    """Hisse OHLCV — yfinance primary, isyatirim fallback."""
    return await _invoke("get_ohlcv", ticker=ticker, days=days)


@strands_tool
async def calculate_indicators(ticker: str, days: int = 90) -> dict[str, Any]:
    """pandas-ta tabanlı teknik indikatör paketi (RSI, MACD, Bollinger, ATR, SMA, EMA)."""
    return await _invoke("calculate_indicators", ticker=ticker, days=days)


@strands_tool
async def detect_patterns(ticker: str, days: int = 90) -> dict[str, Any]:
    """Basit pattern dedektörü: golden/death cross proximity, RSI rejimleri."""
    return await _invoke("detect_patterns", ticker=ticker, days=days)


@strands_tool
async def find_support_resistance(ticker: str, days: int = 90) -> dict[str, Any]:
    """Bollinger bantları + percentile kapanışlarından basit S/R seviyeleri."""
    return await _invoke("find_support_resistance", ticker=ticker, days=days)


@strands_tool
async def relative_strength(
    ticker: str, days: int = 90, index_code: str = "XU100"
) -> dict[str, Any]:
    """Hissenin endekse karşı performansı (yüzdesel fark)."""
    return await _invoke(
        "relative_strength", ticker=ticker, days=days, index_code=index_code
    )


# ───────────────────────── Fundamental Worker tools ─────────────────────────


@strands_tool
async def fetch_kap_filings(ticker: str, days: int = 30) -> dict[str, Any]:
    """KAP bildirimleri — son N gün."""
    return await _invoke("fetch_kap_filings", ticker=ticker, days=days)


@strands_tool
async def get_financial_statements(ticker: str, years: int = 2) -> dict[str, Any]:
    """isyatirimhisse'ten son N yıl çeyreklik finansal tablo."""
    return await _invoke("get_financial_statements", ticker=ticker, years=years)


@strands_tool
async def compute_ratios(ticker: str) -> dict[str, Any]:
    """Cari oran, borç/özkaynak, aktif toplam — son çeyrek bazlı."""
    return await _invoke("compute_ratios", ticker=ticker)


@strands_tool
async def get_sector_peers(ticker: str) -> dict[str, Any]:
    """Aynı squad'daki rakipler (sector_map.yaml)."""
    return await _invoke("get_sector_peers", ticker=ticker)


@strands_tool
async def compare_to_peers(ticker: str) -> dict[str, Any]:
    """Squad peer'ları için temel oran karşılaştırması."""
    return await _invoke("compare_to_peers", ticker=ticker)


@strands_tool
async def get_dividend_history(ticker: str) -> dict[str, Any]:
    """Temettü geçmişi — yfinance."""
    return await _invoke("get_dividend_history", ticker=ticker)


# ───────────────────────── Devil's Advocate tools ─────────────────────────


@strands_tool
async def query_workers(ticker: str) -> dict[str, Any]:
    """Teknik + fundamental özetlerin birleşimi (deterministik snapshot)."""
    return await _invoke("query_workers", ticker=ticker)


@strands_tool
async def find_disconfirming_evidence(ticker: str) -> dict[str, Any]:
    """Şirket için olumsuz/disconfirming sinyal taraması (son haberler)."""
    return await _invoke("find_disconfirming_evidence", ticker=ticker)


@strands_tool
async def base_rate_check(squad: str) -> dict[str, Any]:
    """Squad'ın geçmiş tezlerinde correct oranı."""
    return await _invoke("base_rate_check", squad=squad)


# ───────────────────────── Memory tools ─────────────────────────


@strands_tool
async def similarity_search(
    query_text: str, ticker: str | None = None, top_k: int = 3
) -> dict[str, Any]:
    """Geçmiş tezler arasında semantic benzerlik araması (pgvector cosine)."""
    return await _invoke(
        "similarity_search", query_text=query_text, ticker=ticker, top_k=top_k
    )


# ───────────────────────── Tool grupları (Agent constructor için) ─────────────────────────

MACRO_TOOLS = [
    get_tcmb_indicators,
    get_bist_index_state,
    get_global_signals,
    get_recent_macro_news,
]

SECTOR_ROUTER_TOOLS = [lookup_sector, select_squad]

TECHNICAL_TOOLS = [
    get_ohlcv,
    calculate_indicators,
    detect_patterns,
    find_support_resistance,
    relative_strength,
]

FUNDAMENTAL_TOOLS = [
    fetch_kap_filings,
    get_financial_statements,
    compute_ratios,
    get_sector_peers,
    compare_to_peers,
    get_dividend_history,
]

DEVILS_ADVOCATE_TOOLS = [
    query_workers,
    find_disconfirming_evidence,
    base_rate_check,
]

ORCHESTRATOR_TOOLS = [validate_ticker, get_macro_context]

MEMORY_TOOLS = [similarity_search]

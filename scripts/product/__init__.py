"""ThesisForge — Veri Sağlayıcı Modülleri.

Her modül data.md'deki bir kaynak/gereksinime karşılık gelir.
"""
from macro import get_macro_context, get_series
from companies import get_bist_companies, get_company_by_ticker, get_funds
from prices import get_ohlcv, get_index, get_dividends, get_brent_oil
from financials import get_financials, get_latest_quarter, compute_basic_ratios
from disclosures import (
    get_last_disclosure_id,
    get_disclosure_detail,
    get_latest_disclosures,
    get_company_disclosures,
)
from analyst import get_recommendation, get_quick_info, search_sector, get_fx_rate
from technicals import compute_indicators, technical_signal
from news import get_market_news, get_company_news, get_news_detail

__all__ = [
    # Macro
    "get_macro_context", "get_series",
    # Companies
    "get_bist_companies", "get_company_by_ticker", "get_funds",
    # Prices
    "get_ohlcv", "get_index", "get_dividends", "get_brent_oil",
    # Financials
    "get_financials", "get_latest_quarter", "compute_basic_ratios",
    # Disclosures
    "get_last_disclosure_id", "get_disclosure_detail",
    "get_latest_disclosures", "get_company_disclosures",
    # Analyst
    "get_recommendation", "get_quick_info", "search_sector", "get_fx_rate",
    # Technicals
    "compute_indicators", "technical_signal",
    # News
    "get_market_news", "get_company_news", "get_news_detail",
]

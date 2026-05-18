"""Market data endpoints — watchlist enrichment + dashboard charts.

Frontend watchlist kartı ticker başına fiyat + sparkline ister. Backend'de mevcut
yfinance providerlarını çağırarak hafif bir quote endpoint'i sunar; TTLCache ile
1dk içinde tekrar isteklerde external API'ye yük binmez.

Anlık fiyat için yfinance fast_info kullanılır (Google Finance ile tutarlı).
Sparkline chart verisi historical OHLCV'den gelir.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.logging import log
from app.data.cache import get_cache_backend
from app.data.providers.disclosures import CompanyDisclosuresProvider
from app.data.providers.news import GoogleCompanyNewsProvider


router = APIRouter(prefix="/api/market", tags=["market"])


_QUOTE_TTL_SEC = 60  # 1 dk — piyasa açıkken daha güncel veri
_SPARK_POINTS = 24

# period → (yfinance.period, yfinance.interval, cache_ttl)
_HISTORY_PARAMS: dict[str, tuple[str, str, int]] = {
    "1d": ("1d", "5m", 60),
    "1w": ("5d", "30m", 300),
    "1mo": ("1mo", "1d", 900),
    "1y": ("1y", "1d", 900),   # ~252 günlük mum; 15dk cache
}


def _normalize_ticker(t: str) -> str:
    """BIST için '.IS' suffix'i ekle (XU100 gibi index'ler ayrı tutulur)."""
    up = t.strip().upper()
    if up.startswith("^") or "." in up:
        return up
    if up in {"XU100", "BIST100"}:
        return "XU100.IS"
    return f"{up}.IS"


def _fetch_realtime_quote_sync(yf_ticker: str) -> dict[str, Any]:
    """yfinance fast_info ile anlık fiyat, önceki kapanış ve sparkline çek (blocking).

    fast_info → last_price, previous_close (Google Finance ile tutarlı gerçek zamanlı)
    history → sparkline chart verisi
    """
    import yfinance as yf

    tk = yf.Ticker(yf_ticker)

    # --- Anlık fiyat bilgisi ---
    last_price: float | None = None
    prev_close: float | None = None

    try:
        fi = tk.fast_info
        last_price = float(fi.last_price) if fi.last_price is not None else None
        prev_close = float(fi.previous_close) if fi.previous_close is not None else None
    except Exception:
        pass

    # fast_info başarısız olursa info dict'ten dene
    if last_price is None:
        try:
            info = tk.info
            last_price = info.get("regularMarketPrice") or info.get("currentPrice")
            prev_close = prev_close or info.get("regularMarketPreviousClose") or info.get("previousClose")
            if last_price is not None:
                last_price = float(last_price)
            if prev_close is not None:
                prev_close = float(prev_close)
        except Exception:
            pass

    # --- Sparkline verileri (grafik için) ---
    spark_closes: list[float] = []
    try:
        df = tk.history(period="5d", interval="1h", auto_adjust=False)
        if df is None or df.empty:
            df = tk.history(period="1mo", interval="1d", auto_adjust=False)
        if df is not None and not df.empty:
            df = df.tail(_SPARK_POINTS * 2)
            for _ts, r in df.iterrows():
                try:
                    c = r.get("Close")
                    if c is not None:
                        spark_closes.append(float(c))
                except Exception:
                    continue
    except Exception:
        pass

    # Eğer fast_info'dan fiyat gelemediyse sparkline'dan son değeri al (fallback)
    if last_price is None and spark_closes:
        last_price = spark_closes[-1]
    if prev_close is None and len(spark_closes) >= 2:
        prev_close = spark_closes[0]

    return {
        "last_price": last_price,
        "previous_close": prev_close,
        "spark_closes": spark_closes,
    }


async def _build_quote(ticker: str) -> dict[str, Any]:
    yf_ticker = _normalize_ticker(ticker)
    data = await asyncio.to_thread(_fetch_realtime_quote_sync, yf_ticker)

    last_price = data["last_price"]
    prev_close = data["previous_close"]
    spark_closes: list[float] = data["spark_closes"]

    if last_price is None:
        raise HTTPException(status_code=404, detail=f"Ticker için fiyat bulunamadı: {ticker}")

    # Sparkline: chart verisi + son anlık fiyatı sona ekle
    spark = spark_closes[-_SPARK_POINTS:] if len(spark_closes) >= 2 else spark_closes
    # Sparkline'ın son değeri anlık fiyatla tutarlı olsun
    if spark:
        spark = list(spark)  # kopyala
        spark[-1] = last_price
    else:
        spark = [last_price]

    # Günlük değişim yüzdesi
    if prev_close and prev_close > 0:
        delta_pct = ((last_price - prev_close) / prev_close) * 100.0
    else:
        delta_pct = 0.0

    return {
        "ticker": ticker.upper(),
        "last": round(last_price, 4),
        "previous_close": round(prev_close, 4) if prev_close else round(last_price, 4),
        "delta_pct": round(delta_pct, 4),
        "spark": [round(float(c), 4) for c in spark],
    }


def _fetch_history_sync(yf_ticker: str, period: str, interval: str) -> list[dict[str, Any]]:
    """yfinance.history ile periyot bazlı OHLCV serisi çek (blocking).

    `1d` intraday için 5dk, `1w` için 30dk, `1mo` için günlük bar üretir.
    auto_adjust=False — fiyatlar Google Finance ile tutarlı kalır.
    """
    import yfinance as yf

    tk = yf.Ticker(yf_ticker)
    points: list[dict[str, Any]] = []
    try:
        df = tk.history(period=period, interval=interval, auto_adjust=False)
    except Exception:
        return points
    if df is None or df.empty:
        return points

    for ts, r in df.iterrows():
        try:
            close = r.get("Close")
            if close is None:
                continue
            point: dict[str, Any] = {
                "t": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                "c": round(float(close), 4),
                "o": round(float(r.get("Open", close)), 4),
                "h": round(float(r.get("High", close)), 4),
                "l": round(float(r.get("Low", close)), 4),
                "v": int(float(r.get("Volume", 0) or 0)),
            }
            points.append(point)
        except Exception:
            continue
    return points


@router.get("/history/{ticker}")
async def get_history(ticker: str, period: str = "1w") -> dict[str, Any]:
    if period not in _HISTORY_PARAMS:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz period: {period}. Geçerli: {list(_HISTORY_PARAMS)}",
        )
    yf_period, interval, ttl = _HISTORY_PARAMS[period]
    upper = ticker.upper()
    cache = get_cache_backend()
    key = f"market:history:{upper}:{period}"
    cached = await cache.get(key)
    if cached is not None:
        return cached

    yf_ticker = _normalize_ticker(ticker)
    try:
        points = await asyncio.to_thread(
            _fetch_history_sync, yf_ticker, yf_period, interval
        )
    except Exception as e:
        log.warning("history_fetch_fail", ticker=ticker, period=period, error=str(e)[:200])
        raise HTTPException(status_code=502, detail=f"History fetch fail: {e}")

    if not points:
        raise HTTPException(
            status_code=404, detail=f"{ticker} için {period} verisi bulunamadı"
        )

    closes = [p["c"] for p in points]
    highs = [p["h"] for p in points]
    lows = [p["l"] for p in points]
    volumes = [p["v"] for p in points]
    first = closes[0]
    last = closes[-1]
    delta_pct = ((last - first) / first) * 100.0 if first > 0 else 0.0

    payload = {
        "ticker": upper,
        "period": period,
        "interval": interval,
        "points": points,
        "first": round(first, 4),
        "last": round(last, 4),
        "high": round(max(highs), 4),
        "low": round(min(lows), 4),
        "volume": int(sum(volumes)),
        "delta_pct": round(delta_pct, 4),
    }
    await cache.set(key, payload, ttl)
    return payload


# ─── Feed: KAP bildirimleri + Google News birleşik ────────────────────────────

_FEED_TTL_SEC = 300  # 5 dk — bildirim/haber sık değişmez


def _parse_kap_datetime(raw: str | None) -> str | None:
    """'29.04.2026 18:20:52' → ISO8601. Hatalı format → None."""
    if not raw:
        return None
    try:
        dt = datetime.strptime(raw.strip(), "%d.%m.%Y %H:%M:%S")
        return dt.isoformat()
    except Exception:
        try:
            dt = datetime.strptime(raw.strip()[:10], "%d.%m.%Y")
            return dt.isoformat()
        except Exception:
            return None


def _parse_news_datetime(raw: str | None) -> str | None:
    """'Tue, 12 May 2026 15:56:00 GMT' → ISO8601. Hatalı format → None."""
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        return dt.isoformat() if dt else None
    except Exception:
        return None


def _normalize_kap(items: list[dict[str, Any]], ticker: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    upper = ticker.upper()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        published = _parse_kap_datetime(item.get("publishDate"))
        if not published:
            continue
        disclosure_id = item.get("disclosureIndex")
        url = (
            f"https://www.kap.org.tr/tr/Bildirim/{disclosure_id}"
            if disclosure_id
            else "https://www.kap.org.tr/"
        )
        subject = (item.get("subject") or "").strip() or "KAP Bildirimi"
        summary = (item.get("summary") or "").strip() or None
        out.append(
            {
                "kind": "kap",
                "id": f"kap:{disclosure_id or published}",
                "title": subject,
                "snippet": summary,
                "source": "KAP",
                "url": url,
                "published_at": published,
                "meta": {
                    "ticker": upper,
                    "category": item.get("disclosureCategory") or item.get("disclosureType"),
                    "is_late": item.get("isLate"),
                    "attachment_count": item.get("attachmentCount"),
                    "kap_title": item.get("kapTitle"),
                },
            }
        )
    return out


def _normalize_news(items: list[dict[str, Any]], ticker: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    upper = ticker.upper()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        published = _parse_news_datetime(item.get("date"))
        if not published:
            continue
        title = (item.get("title") or "").strip()
        if not title:
            continue
        snippet = (item.get("snippet") or "").strip() or None
        out.append(
            {
                "kind": "news",
                "id": f"news:{item.get('url') or title}",
                "title": title,
                "snippet": snippet,
                "source": (item.get("source") or "Haber").strip(),
                "url": item.get("url") or "",
                "published_at": published,
                "meta": {"ticker": upper},
            }
        )
    return out


@router.get("/feed/{ticker}")
async def get_company_feed(
    ticker: str, days: int = 30, limit: int = 30
) -> dict[str, Any]:
    """Şirket akışı: KAP bildirimleri + Google News, tarih sırasına göre birleşik."""
    if days < 1 or days > 180:
        raise HTTPException(status_code=400, detail="days 1-180 aralığında olmalı")
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit 1-100 aralığında olmalı")

    upper = ticker.upper()
    cache = get_cache_backend()
    cache_key = f"market:feed:{upper}:{days}:{limit}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    kap_provider = CompanyDisclosuresProvider()
    news_provider = GoogleCompanyNewsProvider()

    kap_task = asyncio.create_task(kap_provider.fetch(ticker=upper, days=days))
    news_task = asyncio.create_task(
        news_provider.fetch(ticker=upper, count=max(limit, 10), with_summary=False)
    )
    kap_res, news_res = await asyncio.gather(
        kap_task, news_task, return_exceptions=True
    )

    sources_ok: list[str] = []
    sources_err: dict[str, str] = {}

    kap_items: list[dict[str, Any]] = []
    if isinstance(kap_res, Exception):
        sources_err["kap"] = str(kap_res)[:200]
        log.warning("feed_kap_fail", ticker=upper, error=str(kap_res)[:200])
    else:
        raw = (kap_res.payload or {}).get("disclosures") or []
        kap_items = _normalize_kap(raw, upper)
        sources_ok.append("kap")

    news_items: list[dict[str, Any]] = []
    if isinstance(news_res, Exception):
        sources_err["news"] = str(news_res)[:200]
        log.warning("feed_news_fail", ticker=upper, error=str(news_res)[:200])
    else:
        raw = (news_res.payload or {}).get("news") or []
        news_items = _normalize_news(raw, upper)
        sources_ok.append("news")

    merged = kap_items + news_items
    merged.sort(key=lambda x: x["published_at"], reverse=True)
    merged = merged[:limit]

    payload = {
        "ticker": upper,
        "days": days,
        "count": len(merged),
        "items": merged,
        "sources_ok": sources_ok,
        "sources_err": sources_err,
    }
    await cache.set(cache_key, payload, _FEED_TTL_SEC)
    return payload


@router.get("/quote/{ticker}")
async def get_quote(ticker: str) -> dict[str, Any]:
    cache = get_cache_backend()
    key = f"market:quote:{ticker.upper()}"
    cached = await cache.get(key)
    if cached is not None:
        return cached

    try:
        quote = await _build_quote(ticker)
    except HTTPException:
        raise
    except Exception as e:
        log.warning("quote_fetch_fail", ticker=ticker, error=str(e)[:200])
        raise HTTPException(status_code=502, detail=f"Quote fetch fail: {e}")

    await cache.set(key, quote, _QUOTE_TTL_SEC)
    return quote

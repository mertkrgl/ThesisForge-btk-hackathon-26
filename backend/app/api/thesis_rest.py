"""GET /api/thesis/{id} ve /api/thesis/{id}/citations."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import log
from app.db.models import User
from app.db.repo import (
    count_theses,
    delete_thesis_for_user,
    get_thesis,
    list_citations_with_tool_results,
    list_theses,
)
from app.db.session import get_session


router = APIRouter(prefix="/api", tags=["thesis"])


# tool_name → kullanıcı dostu Türkçe etiket. Frontend toolLabels.ts ile senkron
# kalmalı (P0-5 sonrası tek kaynak haline getirilebilir).
_TOOL_LABEL_TR: dict[str, str] = {
    "get_ohlcv": "Fiyat Geçmişi",
    "calculate_indicators": "Teknik İndikatörler",
    "detect_patterns": "Formasyon Tespiti",
    "find_support_resistance": "Destek/Direnç Seviyeleri",
    "relative_strength": "Göreceli Güç",
    "fetch_kap_filings": "KAP Bildirimleri",
    "get_financial_statements": "Mali Tablolar",
    "compute_ratios": "Finansal Rasyolar",
    "compare_to_peers": "Sektör Karşılaştırma",
    "get_dividend_history": "Temettü Geçmişi",
    "get_sector_peers": "Sektör Emsalleri",
    "get_tcmb_indicators": "TCMB Göstergeleri (EVDS)",
    "get_bist_index_state": "BIST 100 Endeksi",
    "get_global_signals": "Global Piyasa Sinyalleri",
    "get_mkk_data": "MKK Verisi",
    "recent_macro_news": "Güncel Makro Haberler",
    "query_workers": "Worker Sorgulama",
    "disconfirming_evidence": "Karşı Kanıt Toplama",
    "base_rate_check": "Sektör Başarı Oranı",
    "similarity_search": "Benzer Tez Araması",
}


def _extract_url(tool_result: Any) -> str | None:
    """tool_call_logs.result içinden makul bir kaynak URL'i çıkarmaya çalış.

    KAP/news tool sonuçları liste/dict olarak url alanı içeriyor; ilk
    bulduğumuzu döndürürüz. Bulunmazsa None.
    """
    if not tool_result:
        return None
    if isinstance(tool_result, dict):
        for key in ("url", "link", "href", "source_url"):
            v = tool_result.get(key)
            if isinstance(v, str) and v.startswith("http"):
                return v
        # Listelerde dolaş (örn. items: [{url: ...}, ...])
        for v in tool_result.values():
            url = _extract_url(v)
            if url:
                return url
    elif isinstance(tool_result, list):
        for item in tool_result[:5]:  # ilk 5 ile sınırla
            url = _extract_url(item)
            if url:
                return url
    return None


def _thesis_to_dict(t) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "ticker": t.ticker,
        "squad": t.squad,
        "user_mode": t.user_mode,
        "user_id": str(t.user_id) if t.user_id else None,
        "thesis_date": t.thesis_date.isoformat() if t.thesis_date else None,
        "thesis_md": t.thesis_md,
        "bull_points": t.bull_points,
        "bear_points": t.bear_points,
        "catalysts": t.catalysts,
        "sentiment_label": t.sentiment_label,
        "confidence": float(t.confidence) if t.confidence is not None else None,
        "confidence_breakdown": t.confidence_breakdown,
        "memory_hits": t.memory_hits or [],
        "price_at_thesis": float(t.price_at_thesis) if t.price_at_thesis is not None else None,
        "price_7d": float(t.price_7d) if t.price_7d is not None else None,
        "price_30d": float(t.price_30d) if t.price_30d is not None else None,
        "price_90d": float(t.price_90d) if t.price_90d is not None else None,
        "ground_truth_return": t.ground_truth_return,
        "outcome": t.outcome,
        "had_kaynaksiz_flag": t.had_kaynaksiz_flag,
    }


def _thesis_summary(t) -> dict[str, Any]:
    """Liste için thesis_md hariç hafif DTO; kart UI'ında gerekli tüm alanlar var."""
    bull = t.bull_points or []
    bear = t.bear_points or []
    bull_count = len(bull) if isinstance(bull, list) else 0
    bear_count = len(bear) if isinstance(bear, list) else 0
    return {
        "id": str(t.id),
        "ticker": t.ticker,
        "squad": t.squad,
        "user_mode": t.user_mode,
        "user_id": str(t.user_id) if t.user_id else None,
        "thesis_date": t.thesis_date.isoformat() if t.thesis_date else None,
        "bull_points": bull,
        "bear_points": bear,
        "catalysts": t.catalysts or [],
        "bull_count": bull_count,
        "bear_count": bear_count,
        "sentiment_label": t.sentiment_label,
        "confidence": float(t.confidence) if t.confidence is not None else None,
        "outcome": t.outcome,
        "had_kaynaksiz_flag": t.had_kaynaksiz_flag,
    }


@router.get("/theses")
async def read_theses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ticker: str | None = Query(default=None),
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    rows = await list_theses(
        session,
        limit=limit,
        offset=offset,
        user_id=current.id,
        ticker=ticker,
    )
    total = await count_theses(session, user_id=current.id, ticker=ticker)
    return {
        "items": [_thesis_summary(t) for t in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/thesis/{thesis_id}")
async def read_thesis(
    thesis_id: uuid.UUID,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    t = await get_thesis(session, thesis_id)
    if t is None or t.user_id != current.id:
        raise HTTPException(status_code=404, detail="Thesis bulunamadı.")
    return _thesis_to_dict(t)


@router.delete("/thesis/{thesis_id}", status_code=204)
async def delete_thesis(
    thesis_id: uuid.UUID,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    removed = await delete_thesis_for_user(
        session, thesis_id=thesis_id, user_id=current.id
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Thesis bulunamadı.")
    await session.commit()
    return Response(status_code=204)


@router.get("/thesis/{thesis_id}/citations")
async def read_citations(
    thesis_id: uuid.UUID,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    t = await get_thesis(session, thesis_id)
    if t is None or t.user_id != current.id:
        raise HTTPException(status_code=404, detail="Thesis bulunamadı.")
    rows = await list_citations_with_tool_results(session, thesis_id)
    # source_label + url alanlarını cevaba ekle (frontend "açılamayan kaynak"
    # jargonu yerine Türkçe veri sağlayıcı + tıklanabilir link gösterebilsin).
    for row in rows:
        tool_name = row.get("tool_name")
        row["source_label"] = (
            _TOOL_LABEL_TR.get(tool_name, tool_name) if tool_name else None
        )
        row["url"] = _extract_url(row.get("tool_result"))
    return rows


@router.get("/thesis/{thesis_id}/pdf")
async def export_thesis_pdf(
    thesis_id: uuid.UUID,
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Server-side PDF render — weasyprint.

    Tarayıcı `window.print()` davranışı pop-up engelleyici / stil senkronu
    nedeniyle güvenilmezdi. Burada deterministik bytes döner.
    """
    t = await get_thesis(session, thesis_id)
    if t is None or t.user_id != current.id:
        raise HTTPException(status_code=404, detail="Thesis bulunamadı.")
    if not t.thesis_md:
        raise HTTPException(
            status_code=409,
            detail="Tez henüz markdown sentezi tamamlanmadı.",
        )

    # Citations map (uuid → {label, url}) — PDF içinde [kaynak: uuid] etiketlerinin
    # numaralandırılması + arka kaynaklar listesi için.
    rows = await list_citations_with_tool_results(session, thesis_id)
    citations: dict[str, dict[str, Any]] = {}
    for row in rows:
        cid = row.get("call_id")
        if not cid:
            continue
        tool_name = row.get("tool_name")
        citations[cid.lower()] = {
            "label": _TOOL_LABEL_TR.get(tool_name, tool_name) if tool_name else "Kaynak",
            "url": _extract_url(row.get("tool_result")),
        }

    try:
        # Lazy import — PDF endpoint kullanılmadığında weasyprint'in native
        # bağımlılıklarının import edilmesi gerekmesin.
        from app.pdf import render_thesis_pdf

        pdf_bytes = render_thesis_pdf(
            ticker=t.ticker,
            squad=str(t.squad) if t.squad else None,
            user_mode=t.user_mode,
            thesis_md=t.thesis_md,
            confidence=float(t.confidence) if t.confidence is not None else None,
            thesis_date=t.thesis_date.isoformat() if t.thesis_date else None,
            had_kaynaksiz_flag=bool(t.had_kaynaksiz_flag),
            citations=citations,
        )
    except ImportError as e:
        log.error("pdf_dep_missing", error=str(e)[:200])
        raise HTTPException(
            status_code=503,
            detail="PDF üretimi için weasyprint kurulu değil. `pip install weasyprint markdown` çalıştırın.",
        ) from e
    except Exception as e:
        log.exception("pdf_render_fail", error=str(e)[:300])
        raise HTTPException(
            status_code=500,
            detail=f"PDF üretilemedi: {e}",
        ) from e

    filename = f"{t.ticker.lower()}-tez.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )

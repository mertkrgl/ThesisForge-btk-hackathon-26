"""BIST şirket listeleme endpoint'i.

mkk_companies.csv'yi modül import'unda belleğe alır; arama + pagination ile
döndürür. Auth gerekmez (anonim de tarayabilir). Listede `stockCode` boş olan
satırlar (aracı kurumlar, denetim firmaları vb.) filtrelenir — yalnız BIST'te
işlem gören semboller döner.
"""
from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/companies", tags=["companies"])


def _csv_path() -> Path:
    # Repo root: backend/../mkk_companies.csv
    here = Path(__file__).resolve()
    return here.parents[3] / "mkk_companies.csv"


@lru_cache(maxsize=1)
def _load_companies() -> list[dict[str, Any]]:
    path = _csv_path()
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("stockCode") or "").strip().strip('"')
            if not code:
                continue
            # Bazı satırlarda stockCode hücresi quoted virgülle ayrılmış birden
            # fazla ticker içerebiliyor ("A1CAP, ..."); ilkini al.
            code = code.split(",")[0].strip()
            if not code or not re.fullmatch(r"[A-Z0-9]{3,7}", code):
                continue
            if code in seen:
                continue
            seen.add(code)
            title = (row.get("title") or "").strip()
            member_type = (row.get("memberType") or "").strip()
            out.append(
                {
                    "ticker": code,
                    "title": title,
                    "member_type": member_type,
                }
            )
    out.sort(key=lambda r: r["ticker"])
    return out


@router.get("")
async def list_companies(
    search: str = Query("", description="Ticker veya unvan içinde geçen metin"),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    rows = _load_companies()
    q = search.strip().upper()
    if q:
        filtered = [
            r for r in rows
            if q in r["ticker"] or q in r["title"].upper()
        ]
    else:
        filtered = rows
    total = len(filtered)
    page = filtered[offset : offset + limit]
    return {"items": page, "total": total, "limit": limit, "offset": offset}

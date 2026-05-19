"""Async CRUD wrapper'ları — pipeline DB yüzeyi.

Memory similarity_search + nightly outcome cron query'leri burada.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, or_, select, text as sql_text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Citation, Thesis, ToolCallLog, User, Watchlist


# ───────────────────────── Users ─────────────────────────


async def ensure_user(session: AsyncSession, *, email: str) -> User:
    """Email yoksa oluştur, var olanı döndür."""
    res = await session.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user is not None:
        return user
    user = User(email=email)
    session.add(user)
    await session.flush()
    return user


async def ensure_user_by_id(
    session: AsyncSession, user_id: uuid.UUID
) -> User:
    """Verilen UUID'li user yoksa sentetik email ile oluştur.

    Frontend tarayıcıda tarafından üretilen demo user_id (auth henüz yok) için
    watchlist/thesis FK constraint'ini sağlamak amacıyla kullanılır.
    """
    res = await session.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if user is not None:
        return user
    user = User(id=user_id, email=f"demo-{user_id}@thesisforge.local")
    session.add(user)
    await session.flush()
    return user


async def get_user_by_email(
    session: AsyncSession, email: str
) -> User | None:
    """Auth login flow için case-insensitive email lookup."""
    res = await session.execute(
        select(User).where(User.email == email.lower().strip())
    )
    return res.scalar_one_or_none()


async def get_user_by_id(
    session: AsyncSession, user_id: uuid.UUID
) -> User | None:
    """get_current_user dependency için — JWT 'sub' claim'inden user fetch."""
    res = await session.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


async def create_user_with_password(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str,
    name: str | None = None,
) -> User:
    """Register flow — email normalize, bcrypt hash önceden hesaplanmış olarak gelir."""
    user = User(
        email=email.lower().strip(),
        password_hash=password_hash,
        name=name.strip() if name else None,
    )
    session.add(user)
    await session.flush()
    return user


async def update_last_login(
    session: AsyncSession, user_id: uuid.UUID
) -> None:
    """Login başarılı olduğunda last_login_at = now()."""
    from datetime import datetime, timezone

    await session.execute(
        update(User)
        .where(User.id == user_id)
        .values(last_login_at=datetime.now(tz=timezone.utc))
    )


# ───────────────────────── Theses ─────────────────────────


async def create_thesis_skeleton(
    session: AsyncSession,
    *,
    ticker: str,
    user_id: uuid.UUID | None = None,
    user_mode: str = "default",
    squad: str = "Generic",
    price_at_thesis: float | None = None,
) -> uuid.UUID:
    """Pipeline başında tek satır INSERT; outcome='pending' default."""
    t = Thesis(
        ticker=ticker.upper(),
        user_id=user_id,
        user_mode=user_mode,
        squad=squad,
        price_at_thesis=price_at_thesis,
    )
    session.add(t)
    await session.flush()
    return t.id


async def get_thesis(
    session: AsyncSession, thesis_id: uuid.UUID
) -> Thesis | None:
    res = await session.execute(select(Thesis).where(Thesis.id == thesis_id))
    return res.scalar_one_or_none()


async def delete_thesis_for_user(
    session: AsyncSession,
    *,
    thesis_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """Belirli user'a ait tezi sil; silindiyse True döndür."""
    row = await get_thesis(session, thesis_id)
    if row is None:
        return False
    if row.user_id != user_id:
        return False
    await session.delete(row)
    return True


async def list_theses(
    session: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    user_id: uuid.UUID | None = None,
    ticker: str | None = None,
) -> list[Thesis]:
    """Tezleri en yeniden eskiye doğru listele; opsiyonel user_id/ticker filter."""
    q = select(Thesis)
    if user_id is not None:
        q = q.where(Thesis.user_id == user_id)
    if ticker:
        q = q.where(Thesis.ticker == ticker.upper())
    q = q.order_by(Thesis.thesis_date.desc()).offset(offset).limit(limit)
    res = await session.execute(q)
    return list(res.scalars().all())


async def count_theses(
    session: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    ticker: str | None = None,
) -> int:
    """list_theses ile aynı filtrelerle toplam tez sayısı — pagination için."""
    from sqlalchemy import func

    q = select(func.count()).select_from(Thesis)
    if user_id is not None:
        q = q.where(Thesis.user_id == user_id)
    if ticker:
        q = q.where(Thesis.ticker == ticker.upper())
    res = await session.execute(q)
    return int(res.scalar_one())


async def update_thesis_kaynaksiz_flag(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    value: bool,
) -> None:
    await session.execute(
        update(Thesis)
        .where(Thesis.id == thesis_id)
        .values(had_kaynaksiz_flag=value)
    )


async def update_thesis_squad(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    squad: str,
) -> None:
    """Skeleton sonrası sector_router'ın döndürdüğü squad'ı early-write et.

    Synthesizer fail ederse update_thesis_synthesis çağrılmaz; skeleton'daki
    'Generic' default'u DB'de kalırdı. Bu helper, pipeline yarıda kesilse bile
    teze doğru squad'ın yazılmasını garanti eder.
    """
    await session.execute(
        update(Thesis).where(Thesis.id == thesis_id).values(squad=squad)
    )


# ───────────────────────── Tool Call Logs ─────────────────────────


async def insert_tool_call_log(
    session: AsyncSession,
    *,
    thesis_id: uuid.UUID | None,
    agent_id: str,
    tool_name: str,
    args: dict[str, Any] | None,
    result: dict[str, Any] | None,
    latency_ms: int | None,
) -> uuid.UUID:
    """Her tool çağrısı için satır INSERT, call_id RETURNING."""
    row = ToolCallLog(
        thesis_id=thesis_id,
        agent_id=agent_id,
        tool_name=tool_name,
        args=args,
        result=result,
        latency_ms=latency_ms,
    )
    session.add(row)
    await session.flush()
    return row.call_id


async def count_tool_calls_for_thesis(
    session: AsyncSession, thesis_id: uuid.UUID
) -> tuple[int, int]:
    """Bir tez için (toplam_tool_çağrısı, başarılı_çağrı) — data_quality için.

    Başarılı = `result IS NOT NULL`. Hata path'ında DB satırı yazılmaz, dolayısıyla
    `total == success`. Hackathon scope'unda: total < beklenen ise düşük puan.
    """
    from sqlalchemy import func, case

    res = await session.execute(
        select(
            func.count(ToolCallLog.call_id),
            func.count(case((ToolCallLog.result.is_not(None), 1))),
        ).where(ToolCallLog.thesis_id == thesis_id)
    )
    row = res.one()
    return int(row[0] or 0), int(row[1] or 0)


async def aggregate_source_types_for_thesis(
    session: AsyncSession, thesis_id: uuid.UUID
) -> dict[str, int]:
    """P2-A: ProviderResult.source_type kategorilerini bir tez için sayar.

    Tool çağrıları `result.payload`'a ChainedDataProvider üzerinden gelir;
    `_fetch` her çağrıda `result.model_dump()` döndürdüğü için `source_type`
    alanı JSONB içinde görünür. Bu helper kategorilerin sayımını döndürür:
        { "live": int, "fallback": int, "fixture": int, "stub": int, "unknown": int }
    """
    res = await session.execute(
        select(ToolCallLog.result).where(
            ToolCallLog.thesis_id == thesis_id,
            ToolCallLog.result.is_not(None),
        )
    )
    stats = {"live": 0, "fallback": 0, "fixture": 0, "stub": 0, "unknown": 0}
    for (result_json,) in res.all():
        if not isinstance(result_json, dict):
            stats["unknown"] += 1
            continue
        st = result_json.get("source_type")
        if st in stats:
            stats[st] += 1
        else:
            stats["unknown"] += 1
    return stats


async def get_tool_call_log(
    session: AsyncSession,
    call_id: uuid.UUID | str,
    thesis_id: uuid.UUID | None = None,
) -> ToolCallLog | None:
    """Citation validator için PK lookup. thesis_id verilirse o teze ait olmasını şart koşar."""
    if isinstance(call_id, str):
        try:
            call_id = uuid.UUID(call_id)
        except (ValueError, TypeError):
            return None

    q = select(ToolCallLog).where(ToolCallLog.call_id == call_id)
    if thesis_id is not None:
        q = q.where(ToolCallLog.thesis_id == thesis_id)
    res = await session.execute(q)
    return res.scalar_one_or_none()


# ───────────────────────── Citations ─────────────────────────


# ───────────────────────── Memory: similarity + persist ─────────────────────────


def _vec_to_pg(v: list[float]) -> str:
    """Python listesini pgvector string formatına çevir: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{float(x):.6f}" for x in v) + "]"


async def similarity_search(
    session: AsyncSession,
    *,
    embedding: list[float],
    ticker: str | None = None,
    squad: str | None = None,
    exclude_thesis_id: uuid.UUID | None = None,
    include_pending: bool = False,
    top_k: int = 3,
    horizon_days: int = 730,
) -> list[dict[str, Any]]:
    """pgvector cosine search — aynı ticker VEYA aynı squad.

    Tez henüz embedding'i yazılmamışsa skip. `include_pending=False` iken
    yalnızca outcome'u kapanmış tezler döner; memory kıyaslaması için pending
    önceki tezler de istenebilir.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=horizon_days)
    filters = ["embedding IS NOT NULL", "thesis_date >= :cutoff"]
    params: dict[str, Any] = {"cutoff": cutoff, "top_k": top_k, "emb": _vec_to_pg(embedding)}
    if not include_pending:
        filters.append("outcome != 'pending'")
    if exclude_thesis_id is not None:
        filters.append("id != :exclude_thesis_id")
        params["exclude_thesis_id"] = exclude_thesis_id
    or_clause = []
    if ticker:
        or_clause.append("ticker = :ticker")
        params["ticker"] = ticker.upper()
    if squad:
        or_clause.append("squad = :squad")
        params["squad"] = squad
    if or_clause:
        filters.append("(" + " OR ".join(or_clause) + ")")

    sql = sql_text(
        f"""
        SELECT id, ticker, squad, thesis_date, thesis_md, outcome,
               ground_truth_return, confidence,
               (embedding <=> CAST(:emb AS vector)) AS distance
        FROM theses
        WHERE {' AND '.join(filters)}
        ORDER BY distance ASC
        LIMIT :top_k
        """
    )
    res = await session.execute(sql, params)
    rows = res.mappings().all()
    return [dict(r) for r in rows]


async def get_pending_theses(
    session: AsyncSession,
    *,
    older_than_days: int = 7,
    limit: int = 500,
) -> list[Thesis]:
    """Nightly cron için: thesis_date eski + outcome pending."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    res = await session.execute(
        select(Thesis)
        .where(Thesis.outcome == "pending")
        .where(Thesis.thesis_date < cutoff)
        .order_by(Thesis.thesis_date)
        .limit(limit)
    )
    return list(res.scalars().all())


async def update_thesis_outcome(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    *,
    price_7d: float | None,
    price_30d: float | None,
    price_90d: float | None,
    ground_truth_return: float | None,
    outcome: str,
) -> None:
    await session.execute(
        update(Thesis)
        .where(Thesis.id == thesis_id)
        .values(
            price_7d=price_7d,
            price_30d=price_30d,
            price_90d=price_90d,
            ground_truth_return=ground_truth_return,
            outcome=outcome,
        )
    )


async def update_thesis_synthesis(
    session: AsyncSession,
    thesis_id: uuid.UUID,
    *,
    thesis_md: str,
    bull_points: list[dict] | None,
    bear_points: list[dict] | None,
    catalysts: list[dict] | None,
    confidence: float | None,
    confidence_breakdown: dict | None,
    memory_hits: list[dict] | None = None,
    squad: str | None = None,
    sentiment_label: str | None = None,
    citation_audit: dict | None = None,
) -> None:
    values: dict[str, Any] = {
        "thesis_md": thesis_md,
        "bull_points": bull_points,
        "bear_points": bear_points,
        "catalysts": catalysts,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "memory_hits": memory_hits,
        "sentiment_label": sentiment_label,
        "citation_audit": citation_audit,
    }
    if squad:
        values["squad"] = squad
    await session.execute(update(Thesis).where(Thesis.id == thesis_id).values(**values))


async def list_citations_with_tool_results(
    session: AsyncSession, thesis_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Citations + tool_call_logs JOIN — tooltip için tool_result alanını çöz."""
    res = await session.execute(
        select(
            Citation.claim_text,
            Citation.call_id,
            Citation.is_kaynaksiz,
            ToolCallLog.tool_name,
            ToolCallLog.args,
            ToolCallLog.result,
            ToolCallLog.ts,
        )
        .outerjoin(ToolCallLog, Citation.call_id == ToolCallLog.call_id)
        .where(Citation.thesis_id == thesis_id)
    )
    rows = res.all()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "claim_text": r.claim_text,
                "call_id": str(r.call_id) if r.call_id else None,
                "tool_name": r.tool_name,
                "tool_args": r.args,
                "tool_result": r.result,
                "tool_ts": r.ts.isoformat() if r.ts else None,
                "is_kaynaksiz": bool(r.is_kaynaksiz),
            }
        )
    return out


# ───────────────────────── Watchlist ─────────────────────────


async def list_watchlist(
    session: AsyncSession, user_id: uuid.UUID
) -> list[dict[str, Any]]:
    res = await session.execute(
        select(Watchlist).where(Watchlist.user_id == user_id).order_by(Watchlist.added_at)
    )
    rows = res.scalars().all()
    return [
        {"ticker": r.ticker, "added_at": r.added_at.isoformat()}
        for r in rows
    ]


async def add_watchlist(
    session: AsyncSession, user_id: uuid.UUID, ticker: str
) -> bool:
    """Idempotent INSERT — zaten varsa False, yeniyse True."""
    upper = ticker.upper()
    existing = await session.execute(
        select(Watchlist).where(
            and_(Watchlist.user_id == user_id, Watchlist.ticker == upper)
        )
    )
    if existing.scalar_one_or_none() is not None:
        return False
    row = Watchlist(user_id=user_id, ticker=upper)
    session.add(row)
    await session.flush()
    return True


async def remove_watchlist(
    session: AsyncSession, user_id: uuid.UUID, ticker: str
) -> bool:
    """True döner remove olursa, False satır yoksa."""
    upper = ticker.upper()
    res = await session.execute(
        select(Watchlist).where(
            and_(Watchlist.user_id == user_id, Watchlist.ticker == upper)
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True


async def insert_citation(
    session: AsyncSession,
    *,
    thesis_id: uuid.UUID,
    claim_text: str,
    call_id: uuid.UUID | str | None,
    is_kaynaksiz: bool,
) -> uuid.UUID:
    """Citation satırı. CHECK constraint: is_kaynaksiz↔call_id tutarlı olmalı."""
    if isinstance(call_id, str):
        try:
            call_id = uuid.UUID(call_id)
        except (ValueError, TypeError):
            call_id = None
            is_kaynaksiz = True

    row = Citation(
        thesis_id=thesis_id,
        claim_text=claim_text,
        call_id=call_id,
        is_kaynaksiz=is_kaynaksiz,
    )
    session.add(row)
    await session.flush()
    return row.id

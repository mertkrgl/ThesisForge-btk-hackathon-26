"""Aşama 5 — 3-katman citation validator senaryoları."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.citations.validator import (
    UUID_RE,
    _split_into_claims,
    validate_citations,
)
from app.citations.numbers import find_unsupported_numbers, number_appears_in
from app.db.models import Citation, Thesis
from app.db.repo import create_thesis_skeleton, insert_tool_call_log


# ─── numbers.py ───────────────────────────────────────────────────────


def test_number_appears_in_handles_variants():
    assert number_appears_in("67", "RSI değeri 67 oldu")
    assert number_appears_in("23,5", "yüzde 23.5 artış")
    assert number_appears_in("23.5", "%23,5 büyüme")
    assert not number_appears_in("99,9", "RSI 67, MACD 1.2")


def test_find_unsupported_numbers_ignores_present():
    sentence = "RSI 67 ve MACD 1.43 olarak ölçüldü."
    result_str = str({"rsi_14": 67, "macd": 1.43})
    assert find_unsupported_numbers(sentence, result_str) == []


def test_find_unsupported_numbers_flags_missing():
    sentence = "RSI 67 ve MACD 99.99 olarak görüldü."
    result_str = str({"rsi_14": 67})
    assert "99.99" in find_unsupported_numbers(sentence, result_str)


# ─── claim splitting ──────────────────────────────────────────────────


def test_split_into_claims_extracts_uuid_per_line():
    md = (
        "## Bull\n"
        "- RSI 67, aşırı alım sınırı [kaynak: 11111111-1111-1111-1111-111111111111]\n"
        "- Q3 net kâr +%23 [kaynak: 22222222-2222-2222-2222-222222222222]\n"
        "Genel olarak görünüm pozitif.\n"
    )
    claims = _split_into_claims(md)
    # Başlık atılır; 2 UUID'li claim + 1 kaynaksız cümle
    texts = [c[0] for c in claims]
    cids = [c[1] for c in claims]
    assert "RSI 67, aşırı alım sınırı" in texts
    assert "11111111-1111-1111-1111-111111111111" in cids
    assert None in cids  # Genel olarak ...


# ─── End-to-end (DB) senaryolar ───────────────────────────────────────


async def _seed_tool_call(pg_session, thesis_id, result: dict, agent="tw", tool="t"):
    return await insert_tool_call_log(
        pg_session,
        thesis_id=thesis_id,
        agent_id=agent,
        tool_name=tool,
        args={},
        result=result,
        latency_ms=10,
    )


async def test_validator_pass_all_valid(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="ASELS", squad="Defense")
    cid_a = await _seed_tool_call(pg_session, thesis_id, {"rsi_14": 67})
    cid_b = await _seed_tool_call(pg_session, thesis_id, {"q3_change_pct": 23})

    md = (
        f"- RSI 67 ölçüldü [kaynak: {cid_a}]\n"
        f"- Q3 +23 büyüme [kaynak: {cid_b}]\n"
    )
    report = await validate_citations(md, thesis_id, pg_session)

    assert report.missing_uuids == []
    assert report.invalid_uuids == []
    assert report.numeric_issues == []
    assert report.had_kaynaksiz is False
    assert len(report.citations) == 2
    assert all(not c.is_kaynaksiz for c in report.citations)

    # DB citations satırı?
    rows = (
        await pg_session.execute(select(Citation).where(Citation.thesis_id == thesis_id))
    ).scalars().all()
    assert len(rows) == 2
    assert all(r.is_kaynaksiz is False for r in rows)

    # had_kaynaksiz_flag güncellenmemiş olmalı
    t = (await pg_session.execute(select(Thesis).where(Thesis.id == thesis_id))).scalar_one()
    assert t.had_kaynaksiz_flag is False


async def test_validator_regex_fail_no_uuids(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="TUPRS", squad="Energy")
    md = "Bu tez tamamen kaynaksız.\nRafineri marjı düştü.\n"

    report = await validate_citations(md, thesis_id, pg_session)
    assert report.had_kaynaksiz is True
    assert all(c.is_kaynaksiz for c in report.citations)
    t = (await pg_session.execute(select(Thesis).where(Thesis.id == thesis_id))).scalar_one()
    assert t.had_kaynaksiz_flag is True


async def test_validator_id_fail_uuid_not_in_db(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="BIMAS", squad="Retail")
    fake = uuid.uuid4()
    md = f"- LFL büyüme %12 [kaynak: {fake}]\n"

    report = await validate_citations(md, thesis_id, pg_session)
    assert str(fake) in report.missing_uuids
    assert report.had_kaynaksiz is True
    # citation kaydı kaynaksız olarak insert edilmiş olmalı
    rows = (
        await pg_session.execute(select(Citation).where(Citation.thesis_id == thesis_id))
    ).scalars().all()
    assert any(r.is_kaynaksiz for r in rows)


async def test_validator_numeric_fail_unsupported_number(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="GARAN", squad="Banking")
    # Tool result sadece RSI 67 içeriyor ama claim 99 diyor
    cid = await _seed_tool_call(pg_session, thesis_id, {"rsi_14": 67})

    md = f"- RSI 99 olarak ölçüldü [kaynak: {cid}]\n"
    report = await validate_citations(md, thesis_id, pg_session)

    assert len(report.numeric_issues) >= 1
    # retry fn yok → soft flag
    assert report.had_kaynaksiz is True


async def test_validator_retry_fn_called_on_failure(pg_session):
    thesis_id = await create_thesis_skeleton(pg_session, ticker="X", squad="Generic")
    fake = uuid.uuid4()
    cid_good = await _seed_tool_call(pg_session, thesis_id, {"v": 5})

    md_bad = f"- bad [kaynak: {fake}]\n"
    md_good = f"- good [kaynak: {cid_good}]\n"

    call_count = {"n": 0}

    async def retry(feedback: str) -> str:
        call_count["n"] += 1
        return md_good

    report = await validate_citations(
        md_bad, thesis_id, pg_session, synthesizer_retry_fn=retry
    )
    assert call_count["n"] == 1
    assert report.missing_uuids == []
    assert report.had_kaynaksiz is False


def test_uuid_regex_extracts_uuid_only():
    s = "RSI 67 [kaynak: 7b3e1f24-9c2a-4f8b-bc91-aaabbbcccddd] yorum"
    matches = UUID_RE.findall(s)
    assert matches == ["7b3e1f24-9c2a-4f8b-bc91-aaabbbcccddd"]

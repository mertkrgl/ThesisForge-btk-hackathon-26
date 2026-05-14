"""3-katman citation validator — spec §11.

Katmanlar:
  1. Regex parse:  `[kaynak: <uuid>]` yakalama
  2. PK lookup:    UUID `tool_call_logs` içinde mi?
  3. Numeric sanity: Cümledeki sayılar ilgili tool_call_logs.result içinde mi?

Bulgular Citation satırlarına yazılır; herhangi bir cümle eşleşmezse
`theses.had_kaynaksiz_flag` true yapılır.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.schemas import CitationRecord
from app.citations.numbers import find_unsupported_numbers
from app.core.logging import log
from app.db.repo import (
    get_tool_call_log,
    insert_citation,
    update_thesis_kaynaksiz_flag,
)


UUID_RE = re.compile(r"\[kaynak:\s*([a-f0-9-]{36})\]", re.IGNORECASE)
# Her bağımsız claim → bir satır VEYA bir bullet point.
# Markdown bullet ('- ' ya da '* ') veya satır sonu nokta/ünlemiyle bitiş.
_SENTENCE_LINE_RE = re.compile(r"^(?:[-*]\s+)?(.+)$")


@dataclass
class ValidationReport:
    md: str
    citations: list[CitationRecord]
    missing_uuids: list[str]
    invalid_uuids: list[str]
    numeric_issues: list[str]
    had_kaynaksiz: bool


SynthesizerRetryFn = Callable[[str], Awaitable[str]]


async def validate_citations(
    thesis_md: str,
    thesis_id: uuid.UUID,
    session: AsyncSession,
    *,
    synthesizer_retry_fn: SynthesizerRetryFn | None = None,
) -> ValidationReport:
    """Markdown tezi 3 katmanda doğrula, citations'a yaz.

    `synthesizer_retry_fn` verilirse 1 kez retry uygulanır (LLM yokken None).
    """
    md = thesis_md
    final_missing: list[str] = []
    final_invalid: list[str] = []
    final_numeric: list[str] = []
    final_numeric_uuids: set[str] = set()

    for attempt in range(2):
        # ───── Katman 1: regex parse ─────
        uuids_found = UUID_RE.findall(md)

        # ───── Katman 2: PK lookup ─────
        missing: list[str] = []
        invalid: list[str] = []
        for u in uuids_found:
            try:
                parsed = uuid.UUID(u)
            except (ValueError, TypeError):
                invalid.append(u)
                continue
            row = await get_tool_call_log(session, parsed, thesis_id)
            if row is None:
                missing.append(u)

        # ───── Katman 3: numeric sanity ─────
        numeric_issues, numeric_bad_uuids = await _check_numbers(
            md, thesis_id, session
        )

        final_missing = missing
        final_invalid = invalid
        final_numeric = numeric_issues
        final_numeric_uuids = numeric_bad_uuids

        if not missing and not invalid and not numeric_issues:
            break

        if attempt == 0 and synthesizer_retry_fn is not None:
            feedback = _build_feedback(missing, invalid, numeric_issues)
            log.warning(
                "citation_retry",
                missing=len(missing),
                invalid=len(invalid),
                numeric_issues=len(numeric_issues),
            )
            md = await synthesizer_retry_fn(feedback)
        else:
            break

    # ───── Citations INSERT ─────
    citations = _split_into_claims(md)
    invalid_set = set(final_invalid) | set(final_missing) | final_numeric_uuids
    citation_records: list[CitationRecord] = []
    had_kaynaksiz = False

    for claim_text, call_id_str in citations:
        if call_id_str is None or call_id_str in invalid_set:
            await insert_citation(
                session,
                thesis_id=thesis_id,
                claim_text=claim_text,
                call_id=None,
                is_kaynaksiz=True,
            )
            citation_records.append(
                CitationRecord(claim_text=claim_text, call_id=None, is_kaynaksiz=True)
            )
            had_kaynaksiz = True
        else:
            await insert_citation(
                session,
                thesis_id=thesis_id,
                claim_text=claim_text,
                call_id=call_id_str,
                is_kaynaksiz=False,
            )
            citation_records.append(
                CitationRecord(
                    claim_text=claim_text,
                    call_id=uuid.UUID(call_id_str),
                    is_kaynaksiz=False,
                )
            )

    if had_kaynaksiz:
        await update_thesis_kaynaksiz_flag(session, thesis_id, True)

    return ValidationReport(
        md=md,
        citations=citation_records,
        missing_uuids=final_missing,
        invalid_uuids=final_invalid,
        numeric_issues=final_numeric,
        had_kaynaksiz=had_kaynaksiz,
    )


# ───────────────────────── Helpers ─────────────────────────


def _split_into_claims(md: str) -> list[tuple[str, str | None]]:
    """Markdown'u claim'lere böl, her claim için (text, call_id_or_None) çek."""
    claims: list[tuple[str, str | None]] = []
    for raw in md.split("\n"):
        line = raw.strip()
        if not line:
            continue
        # Başlıkları (# ##) atla
        if line.startswith("#"):
            continue

        m = UUID_RE.search(line)
        if m:
            claim = UUID_RE.sub("", line).strip()
            claim = _strip_bullet_prefix(claim)
            if claim:
                claims.append((claim, m.group(1)))
        else:
            # Kaynaklanmamış cümle — sadece "anlamlı" görünenleri al
            stripped = _strip_bullet_prefix(line)
            if not stripped:
                continue
            if stripped.endswith((".", "!", "?")) or stripped.startswith(("-", "*")):
                claims.append((stripped, None))
    return claims


def _strip_bullet_prefix(line: str) -> str:
    if line.startswith(("- ", "* ", "• ")):
        return line[2:].strip()
    return line


async def _check_numbers(
    md: str, thesis_id: uuid.UUID, session: AsyncSession
) -> tuple[list[str], set[str]]:
    """Her `[kaynak:]` etiketinden ÖNCE gelen cümledeki sayıların
    `tool_call_logs.result`'unda olup olmadığını kontrol et.

    Cümle sınırı: newline, önceki `[kaynak: ...]` etiketinin sonu veya
    metnin başlangıcı — hangisi en yakındaysa.

    Returns:
        (issues_list, set_of_uuids_with_numeric_problems)
    """
    issues: list[str] = []
    bad_uuids: set[str] = set()
    for match in UUID_RE.finditer(md):
        u = match.group(1)
        try:
            parsed = uuid.UUID(u)
        except (ValueError, TypeError):
            continue
        row = await get_tool_call_log(session, parsed, thesis_id)
        if row is None or row.result is None:
            continue

        # Sentence boundary: en son newline VEYA en son [kaynak: ...] etiketinin sonu
        prefix = md[: match.start()]
        newline_pos = prefix.rfind("\n")
        prev_tag_end = -1
        for prev in UUID_RE.finditer(prefix):
            prev_tag_end = prev.end()
        sentence_start = max(newline_pos + 1, prev_tag_end)
        sentence = md[sentence_start : match.start()]

        result_str = str(row.result)
        unsupported = find_unsupported_numbers(sentence, result_str)
        for n in unsupported:
            issues.append(f"Number {n} not in tool_call_logs.result of {u}")
            bad_uuids.add(u)
    return issues, bad_uuids


def _build_feedback(
    missing: list[str], invalid: list[str], numeric_issues: list[str]
) -> str:
    parts = ["Citation validation failed:"]
    if invalid:
        parts.append(f"  Invalid UUID format: {invalid}")
    if missing:
        parts.append(f"  UUIDs not found in tool_call_logs: {missing}")
    if numeric_issues:
        parts.append("  Numeric mismatches:")
        parts.extend(f"    - {n}" for n in numeric_issues[:10])
    parts.append(
        "Please regenerate the markdown using ONLY call_ids from the provided context."
    )
    return "\n".join(parts)

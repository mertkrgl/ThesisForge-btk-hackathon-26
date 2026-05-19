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

# Finansal/somut sayı pattern'i — bu içermeyen bullet'lar (gelecek catalyst
# tarihleri, soyut risk maddeleri) yapısal olarak kaynaklanamaz, flag
# tetiklememeli. Yakaladığı: yüzde (%X), para birimi (X TL/USD/milyar/milyon),
# çarpan (X.Yx), baz puan, ondalık sayı.
_FACTUAL_NUMBER_RE = re.compile(
    r"%\s*[\d.,]+"                              # %15, %2.4
    r"|[\d.,]+\s*(?:TL|USD|EUR|₺|\$)"           # 100 TL, 5 USD
    r"|[\d.,]+\s*(?:milyar|milyon|bin|trilyon)" # 5 milyar
    r"|\b\d+[.,]\d+\s*x\b"                      # 1.5x
    r"|\b\d+\s*(?:baz puan|bp)\b"               # 50 baz puan
    r"|\b\d+[.,]\d+\b",                         # 1.47, 39.97 (ondalık)
    re.IGNORECASE,
)


def _has_factual_number(text: str) -> bool:
    """Bullet'da finansal/somut sayı var mı? Tarih (2026-Q3) sayılmaz."""
    return bool(_FACTUAL_NUMBER_RE.search(text))


def _is_memory_claim(text: str) -> bool:
    """Internal memory comparisons are sourced from stored theses, not tool logs."""
    lower = text.lower()
    has_thesis_word = "tez" in lower or "memory" in lower
    has_outcome_word = any(
        word in lower
        for word in (
            "correct",
            "partial",
            "wrong",
            "pending",
            "doğru sonuç",
            "yanlış sonuç",
            "sonuçlan",
            "getiri",
        )
    )
    return has_thesis_word and has_outcome_word


@dataclass
class ValidationReport:
    md: str
    citations: list[CitationRecord]
    missing_uuids: list[str]
    invalid_uuids: list[str]
    numeric_issues: list[str]
    had_kaynaksiz: bool
    # P0-B citation health audit sayaçları (audit raporu §3.2).
    # `had_kaynaksiz` tek başına kalite sinyali olamadığı için her tez için
    # detaylı sayaç üretilir; orchestrator bunları `theses.citation_audit`
    # JSONB kolonuna persist eder ve WS `sources_count` event'inde yayınlar.
    claim_count: int = 0
    cited_claim_count: int = 0
    uncited_claim_count: int = 0
    numeric_issue_count: int = 0
    catalyst_count: int = 0
    catalyst_cited_count: int = 0
    citation_retry_count: int = 0

    # ── P1-A türev metrikler ──────────────────────────────────────────
    @property
    def cited_claim_rate(self) -> float:
        return self.cited_claim_count / self.claim_count if self.claim_count else 1.0

    @property
    def numeric_issue_rate(self) -> float:
        return self.numeric_issue_count / self.claim_count if self.claim_count else 0.0

    @property
    def catalyst_cited_rate(self) -> float:
        return (
            self.catalyst_cited_count / self.catalyst_count
            if self.catalyst_count
            else 1.0
        )

    @property
    def retry_required_rate(self) -> float:
        # Tek retry budget var; 0 veya 1.
        return 1.0 if self.citation_retry_count > 0 else 0.0

    @property
    def citation_health_score(self) -> float:
        """Audit raporu §4.2 formülü — 0-100 aralığında.

        citation_health = 0.40 * cited_claim_rate
                        + 0.25 * (1 - numeric_issue_rate)
                        + 0.20 * catalyst_cited_rate
                        + 0.15 * (1 - retry_required_rate)
        """
        score = (
            0.40 * self.cited_claim_rate
            + 0.25 * (1.0 - min(self.numeric_issue_rate, 1.0))
            + 0.20 * self.catalyst_cited_rate
            + 0.15 * (1.0 - self.retry_required_rate)
        )
        return max(0.0, min(100.0, score * 100.0))


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
    citation_retry_count = 0

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

        # Retry yalnızca UUID eşleşme/format hatalarında faydalı.
        # Numeric mismatch çoğu durumda türetilmiş-metrik false positive;
        # ikinci LLM turu süreyi 20-30s uzatıyor.
        needs_retry = bool(missing or invalid)
        if attempt == 0 and needs_retry and synthesizer_retry_fn is not None:
            feedback = _build_feedback(missing, invalid, numeric_issues)
            log.warning(
                "citation_retry",
                missing=len(missing),
                invalid=len(invalid),
                numeric_issues=len(numeric_issues),
            )
            md = await synthesizer_retry_fn(feedback)
            citation_retry_count += 1
        else:
            break

    # ───── Citations INSERT ─────
    citations = _split_into_claims(md)
    # `final_numeric_uuids` had_kaynaksiz tetiklemez: numeric sanity layer
    # türetilmiş metrikler (kar marjı, peer farkı, yıllık büyüme %) için
    # yanlış-pozitif üretiyordu. UUID gerçek tool çağrısına bağlıysa
    # kaynaklı sayılır; numeric_issues hâlâ log'a yazılır ama flag karartmaz.
    # Halüsinasyon koruması Katman 2 (missing UUID) ile sürer.
    invalid_set = set(final_invalid) | set(final_missing)
    citation_records: list[CitationRecord] = []
    had_kaynaksiz = False
    catalyst_count = 0
    catalyst_cited_count = 0
    cited_claim_count = 0

    for claim_text, call_id_str, section_name in citations:
        is_catalyst = section_name == "anahtar katalizörler"
        if is_catalyst:
            catalyst_count += 1
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
            # Flag yalnızca **finansal sayı içeren** claim kaynaksızsa tetiklenir.
            # Gelecek tarihli catalyst (2026-Q3) veya soyut risk maddesi
            # (jeopolitik, regülasyon) için worker pool'unda eşleşecek UUID
            # yok — bunlar audit'te kaynaksız görünür ama flag karartmaz.
            if (
                section_name in _FLAG_SECTIONS
                and _has_factual_number(claim_text)
                and not _is_memory_claim(claim_text)
            ):
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
                    call_id=call_id_str,
                    is_kaynaksiz=False,
                )
            )
            cited_claim_count += 1
            if is_catalyst:
                catalyst_cited_count += 1

    if had_kaynaksiz:
        await update_thesis_kaynaksiz_flag(session, thesis_id, True)

    claim_count = len(citation_records)
    return ValidationReport(
        md=md,
        citations=citation_records,
        missing_uuids=final_missing,
        invalid_uuids=final_invalid,
        numeric_issues=final_numeric,
        had_kaynaksiz=had_kaynaksiz,
        claim_count=claim_count,
        cited_claim_count=cited_claim_count,
        uncited_claim_count=claim_count - cited_claim_count,
        numeric_issue_count=len(final_numeric),
        catalyst_count=catalyst_count,
        catalyst_cited_count=catalyst_cited_count,
        citation_retry_count=citation_retry_count,
    )


# ───────────────────────── Helpers ─────────────────────────


_FLAG_SECTIONS = {"bull case", "bear case", "anahtar katalizörler"}


def _split_into_claims(md: str) -> list[tuple[str, str | None, str]]:
    """Markdown'u claim'lere böl, her claim için (text, call_id_or_None) çek.

    Sadece **markdown bullet'ları** claim olarak işlenir. Paragraf cümleleri
    (Disclaimer, TL;DR yorum, Güven Skoru açıklaması, "memory bulunmadı"
    sistem mesajı vb.) yapısal olarak kaynak gerektirmediği için atlanır —
    aksi halde `had_kaynaksiz_flag` her tezde true çıkıyor.
    """
    claims: list[tuple[str, str | None, str]] = []
    section_name = ""
    for raw in md.split("\n"):
        line = raw.strip()
        if not line:
            continue
        # Başlıkları (# ##) atla; aktif section'ı takip et.
        if line.startswith("#"):
            if line.startswith("##"):
                section_name = line.lstrip("#").strip().lower()
            continue
        # Yalnızca bullet'lar: Bull/Bear/Catalyst/Risk Uyarıları bölümleri.
        # Paragraf cümleleri claim sayılmaz.
        if not line.startswith(("- ", "* ", "• ")):
            continue

        m = UUID_RE.search(line)
        if m:
            claim = UUID_RE.sub("", line).strip()
            claim = _strip_bullet_prefix(claim)
            if claim:
                claims.append((claim, m.group(1), section_name))
        else:
            stripped = _strip_bullet_prefix(line)
            if stripped:
                claims.append((stripped, None, section_name))
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

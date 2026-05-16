"""Synthesizer — Pro model, NO tools.

Üç adım:
  1. `run_synthesizer(...)` → tam markdown tezi
  2. (Orchestrator validate eder, retry callback'i bu modülden gelir)
  3. `extract_structured(...)` → bull/bear/catalysts schema'lı çıkar
     (Rapor §2.2: LLM çağrısı YOK — deterministic regex parser).
"""
from __future__ import annotations

import json
import re
from datetime import date

from app.agents.runtime import build_agent, read_prompt, run_agent_with_context
from app.agents.schemas import (
    BullBearPoint,
    Catalyst,
    ConfidenceBreakdown,
    Critique,
    FundamentalAnalysis,
    MacroContextOutput,
    MemoryHit,
    TechnicalAnalysis,
    ThesisStructured,
)
from app.agents.tools import AgentContext
from app.core.logging import log


# ───────────────────────── Agent factories ─────────────────────────


def _synth_agent(user_mode: str):
    prompt_file = (
        "synthesizer_conservative.md" if user_mode == "conservative" else "synthesizer.md"
    )
    return build_agent(
        name=f"synthesizer_{user_mode}",
        system_prompt=read_prompt(prompt_file),
        tools=[],  # NO tools
        use_pro=True,
        structured_output_model=None,  # text output
    )


# ───────────────────────── Prompt builders ─────────────────────────


def _serialize_for_context(obj) -> str:
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(mode="json"), ensure_ascii=False, indent=2)
    return json.dumps(obj, ensure_ascii=False, indent=2, default=str)


def _build_user_prompt(
    *,
    ticker: str,
    macro: MacroContextOutput,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    critique: Critique,
    memory_hits: list[MemoryHit],
    confidence_breakdown: ConfidenceBreakdown,
    user_mode: str,
    feedback: str | None = None,
) -> str:
    today = date.today().isoformat()
    parts = [
        f"# Tez bağlamı — {ticker}",
        f"**Bugün**: {today}  (Anahtar Katalizörler ve zaman ufukları bu tarihe göre kurgulanmalı; geçmiş tarih veya gerçekçi olmayan yakın gelecek tarihi yazma.)",
        f"user_mode: {user_mode}",
        "",
        "## Macro Context",
        _serialize_for_context(macro)[:1800],
        "",
        "## Technical Analysis",
        _serialize_for_context(tech)[:1800],
        "",
        "## Fundamental Analysis",
        _serialize_for_context(fund)[:2200],
        "",
        "## Devil's Advocate Critique",
        _serialize_for_context(critique)[:1500],
        "",
        "## Memory Hits (geçmiş benzer tezler)",
        _serialize_for_context([h.model_dump(mode="json") for h in memory_hits])[:1500],
        "",
        "Memory hit kuralları: outcome=pending ise bunu önceki tez olarak kıyasla "
        "ama başarı kanıtı gibi sunma. outcome correct/partial/wrong ise tarih, "
        "getiri ve bugünkü teze benzeyen/ayrışan noktayı açıkça belirt. "
        "Memory hit thesis_id değerlerini [kaynak: ...] etiketi olarak kullanma; "
        "memory kıyaslarını Tarihsel Bağlam bölümünde yaz.",
        "",
        "## Confidence Breakdown",
        _serialize_for_context(confidence_breakdown)[:800],
        "",
    ]
    if feedback:
        parts.extend(
            [
                "## ⚠️ Validator geri bildirimi (1. denemeden)",
                feedback,
                "",
                "Lütfen yalnızca yukarıda verilen `observations[].citation_call_id` "
                "değerlerinden gelen UUID'leri kullanarak tezi yeniden yaz.",
                "",
            ]
        )

    parts.append(
        f"Şimdi {ticker} için yatırım tezini Türkçe markdown olarak yaz. "
        "Her sayısal/aktarılan claim'in sonunda `[kaynak: <uuid>]` etiketi olmalı; "
        "UUID'leri yalnızca yukarıdaki observations'lardan al, asla uydurma."
    )
    return "\n".join(parts)


# ───────────────────────── Public API ─────────────────────────


class SynthesizerError(RuntimeError):
    """run_synthesizer'ın fallback markdown stream'lememesi için exception sınıfı."""


async def run_synthesizer(
    ctx: AgentContext,
    *,
    ticker: str,
    macro: MacroContextOutput,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    critique: Critique,
    memory_hits: list[MemoryHit],
    confidence_breakdown: ConfidenceBreakdown,
    user_mode: str = "default",
    feedback: str | None = None,
) -> str:
    """Tek markdown tezi üret. Hata olursa SynthesizerError raise."""
    ctx = ctx.with_agent("synthesizer")
    upper = ticker.upper()
    try:
        agent = _synth_agent(user_mode)
        prompt = _build_user_prompt(
            ticker=upper,
            macro=macro,
            tech=tech,
            fund=fund,
            critique=critique,
            memory_hits=memory_hits,
            confidence_breakdown=confidence_breakdown,
            user_mode=user_mode,
            feedback=feedback,
        )
        out = await run_agent_with_context(agent, prompt, ctx, output_model=None)
        # Strands text response: str veya AgentResult; .message veya str() ile çıkar
        if isinstance(out, str) and out.strip():
            return _repair_missing_bullet_citations(
                out,
                macro=macro,
                tech=tech,
                fund=fund,
                critique=critique,
            )
        for attr in ("message", "output", "text"):
            v = getattr(out, attr, None)
            if isinstance(v, str) and v.strip():
                return _repair_missing_bullet_citations(
                    v,
                    macro=macro,
                    tech=tech,
                    fund=fund,
                    critique=critique,
                )
        s = str(out).strip()
        if s:
            return _repair_missing_bullet_citations(
                s,
                macro=macro,
                tech=tech,
                fund=fund,
                critique=critique,
            )
        raise SynthesizerError("synthesizer returned empty text")
    except SynthesizerError:
        raise
    except Exception as e:
        log.warning("synthesizer_fail", ticker=upper, error=str(e)[:200])
        raise SynthesizerError(str(e)[:200]) from e


# ───────────────────────── Structured extract (regex, no LLM) ─────────────────────────


_UUID_RE = re.compile(r"\[kaynak:\s*([a-f0-9-]{36})\]", re.IGNORECASE)
_UUID_VALUE_RE = re.compile(r"^[a-f0-9-]{36}$", re.IGNORECASE)

# Catalyst tarih prefix'i: YYYY-MM-DD | YYYY-MM | YYYY-Q[1-4] | YYYY-H[1-2]
_CATALYST_DATE_RE = re.compile(
    r"^(\d{4}-(?:Q[1-4]|H[1-2]|\d{2}(?:-\d{2})?))\s*[:—-]\s*(.+)$"
)

# Bullet prefix (Bull/Bear/Risk maddeleri için bold etiket olabilir: **Risk**: ...)
_BULLET_BOLD_PREFIX_RE = re.compile(r"^\*\*[^*]+\*\*\s*[:—-]?\s*")

# Finansal/somut sayı (score heuristic için)
_FINANCIAL_NUMBER_RE = re.compile(
    r"%\s*[\d.,]+"
    r"|[\d.,]+\s*(?:TL|USD|EUR|₺|\$)"
    r"|[\d.,]+\s*(?:milyar|milyon|bin|trilyon)"
    r"|\b\d+[.,]\d+\s*x\b"
    r"|\b\d+\s*(?:baz puan|bp)\b"
    r"|\b\d+[.,]\d+\b",
    re.IGNORECASE,
)

# Catalyst impact için keyword'ler
_HIGH_IMPACT_KW = (
    "re-rating", "kayda değer", "katalizör", "büyük etki", "önemli sonuç",
    "kritik", "tetikleyici",
)
_LOW_IMPACT_KW = (
    "olası", "uzak ihtimal", "spekülatif", "belirsizlik", "düşük olasılık",
)

_TECHNICAL_KW = (
    "rsi", "macd", "sma", "ema", "bollinger", "atr", "destek", "direnç",
    "fiyat", "trend", "momentum", "golden cross", "death cross", "xu100",
    "göreli güç",
)
_FUNDAMENTAL_KW = (
    "kap", "temettü", "finansal", "roe", "roic", "nim", "car", "npl", "casa",
    "karlılık", "bilanço", "gelir", "ebitda", "p/e", "piyasa değeri",
)
_MACRO_KW = (
    "tcmb", "faiz", "tüfe", "usd/try", "eur/try", "brent", "bist",
    "enflasyon", "makro",
)
_RISK_NEWS_KW = (
    "haber", "tradingview", "analist", "hedef fiyat", "kredi kalitesi",
    "net loan", "regülasyon",
)


def _valid_call_id(value: str | None) -> str | None:
    if value and _UUID_VALUE_RE.match(value):
        return value
    return None


def _best_observation_call_id(line: str, observations: list) -> str | None:
    """Pick a citation from observations using simple token overlap."""
    line_words = set(re.findall(r"[a-zA-ZığüşöçİĞÜŞÖÇ0-9]+", line.lower()))
    best_score = -1
    best_call_id: str | None = None
    for obs in observations:
        call_id = _valid_call_id(getattr(obs, "citation_call_id", None))
        if not call_id:
            continue
        text = getattr(obs, "text", "")
        obs_words = set(re.findall(r"[a-zA-ZığüşöçİĞÜŞÖÇ0-9]+", text.lower()))
        score = len(line_words & obs_words)
        if score > best_score:
            best_score = score
            best_call_id = call_id
    return best_call_id


def _repair_missing_bullet_citations(
    md: str,
    *,
    macro: MacroContextOutput,
    tech: TechnicalAnalysis,
    fund: FundamentalAnalysis,
    critique: Critique,
) -> str:
    """Attach existing citation IDs to numeric bullets the LLM left uncited.

    This is intentionally conservative: it only touches markdown bullet lines,
    only when they contain a factual number, and only when the line clearly
    matches technical/fundamental/macro/risk wording.
    """
    repaired: list[str] = []
    risk_ids = [
        cid for cid in (_valid_call_id(c) for c in critique.citation_call_ids) if cid
    ]
    known_ids = {
        cid
        for cid in (
            [_valid_call_id(o.citation_call_id) for o in tech.notable_observations]
            + [_valid_call_id(o.citation_call_id) for o in fund.notable_observations]
            + [_valid_call_id(o.citation_call_id) for o in macro.observations]
            + risk_ids
        )
        if cid
    }
    for raw in md.split("\n"):
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped.startswith(("- ", "* ")):
            repaired.append(line)
            continue

        existing = _UUID_RE.search(stripped)
        if existing and existing.group(1) in known_ids:
            repaired.append(line)
            continue
        if not _FINANCIAL_NUMBER_RE.search(stripped):
            repaired.append(line)
            continue

        lower = stripped.lower()
        call_id: str | None = None
        if any(kw in lower for kw in _TECHNICAL_KW):
            call_id = _best_observation_call_id(line, tech.notable_observations)
        elif any(kw in lower for kw in _FUNDAMENTAL_KW):
            call_id = _best_observation_call_id(line, fund.notable_observations)
        elif any(kw in lower for kw in _MACRO_KW):
            call_id = _best_observation_call_id(line, macro.observations)
        elif any(kw in lower for kw in _RISK_NEWS_KW) and risk_ids:
            call_id = risk_ids[0]

        if call_id:
            if existing:
                line = _UUID_RE.sub(f"[kaynak: {call_id}]", line)
            else:
                line = f"{line} [kaynak: {call_id}]"
        repaired.append(line)

    return "\n".join(repaired)


def _extract_section_bullets(md: str, section_title: str) -> list[str]:
    """Markdown'da `## <section_title>` başlığı altındaki bullet satırlarını topla.

    Sonraki `##` veya `###` başlığına kadar olan blok taranır. Sadece `- ` veya
    `* ` ile başlayan satırlar bullet sayılır.
    """
    lines = md.split("\n")
    bullets: list[str] = []
    in_section = False
    target = section_title.strip().lower()
    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("##"):
            # Yeni bir başlık. Bizim section mı?
            heading = stripped.lstrip("#").strip().lower()
            in_section = (heading == target)
            continue
        if not in_section:
            continue
        if stripped.startswith(("- ", "* ")):
            bullets.append(stripped[2:].strip())
    return bullets


def _parse_bull_bear_bullet(bullet: str) -> BullBearPoint:
    """`- <metin> [kaynak: <uuid>]` → BullBearPoint.

    Score heuristic (Rapor §2.2):
      kaynaklı + finansal sayı → 9
      kaynaklı                 → 7
      sadece finansal sayı     → 6
      ikisi yok                → 4
    """
    m = _UUID_RE.search(bullet)
    call_id: str | None = m.group(1) if m else None
    text = _UUID_RE.sub("", bullet)
    # [kaynak: ...] sonrası noktalama önünde fazla boşluk: "sunuyor ." → "sunuyor."
    text = re.sub(r"\s+([.,;:!?])", r"\1", text).strip()
    has_number = bool(_FINANCIAL_NUMBER_RE.search(text))
    if call_id and has_number:
        score = 9
    elif call_id:
        score = 7
    elif has_number:
        score = 6
    else:
        score = 4
    return BullBearPoint(point=text, call_id=call_id, score=score)


def _parse_catalyst_bullet(bullet: str) -> Catalyst | None:
    """`- 2026-Q3: <event> [kaynak: <uuid>]` → Catalyst.

    Tarih prefix'i yoksa None döner (catalyst değil).
    """
    m = _UUID_RE.search(bullet)
    call_id: str | None = m.group(1) if m else None
    text = _UUID_RE.sub("", bullet)
    text = re.sub(r"\s+([.,;:!?])", r"\1", text).strip()

    dm = _CATALYST_DATE_RE.match(text)
    if not dm:
        return None
    date_str = dm.group(1)
    event = dm.group(2).strip()

    lower = event.lower()
    if any(kw in lower for kw in _HIGH_IMPACT_KW):
        impact: str = "high"
    elif any(kw in lower for kw in _LOW_IMPACT_KW):
        impact = "low"
    else:
        impact = "medium"

    return Catalyst(date=date_str, event=event, impact=impact, call_id=call_id)  # type: ignore[arg-type]


async def extract_structured(
    ctx: AgentContext, *, ticker: str, thesis_md: str
) -> ThesisStructured:
    """Markdown'dan bull/bear/catalysts deterministic regex ile çıkar.

    Rapor §2.2: Önceki sürüm Flash LLM ile 8192 token bütçesi harcıyordu
    (5-15s). Markdown zaten yapısal — regex 1ms'de aynı çıktıyı üretiyor.
    `ctx` argümanı geriye uyumluluk için tutuluyor; kullanılmıyor.
    """
    upper = ticker.upper()
    try:
        bull_bullets = _extract_section_bullets(thesis_md, "Bull Case")
        bear_bullets = _extract_section_bullets(thesis_md, "Bear Case")
        catalyst_bullets = _extract_section_bullets(thesis_md, "Anahtar Katalizörler")

        bull_points = [_parse_bull_bear_bullet(b) for b in bull_bullets if b]
        bear_points = [_parse_bull_bear_bullet(b) for b in bear_bullets if b]
        catalysts: list[Catalyst] = []
        for b in catalyst_bullets:
            if not b:
                continue
            c = _parse_catalyst_bullet(b)
            if c is not None:
                catalysts.append(c)

        log.info(
            "extract_structured_regex",
            ticker=upper,
            bull=len(bull_points),
            bear=len(bear_points),
            catalysts=len(catalysts),
        )
        return ThesisStructured(
            bull_points=bull_points,
            bear_points=bear_points,
            catalysts=catalysts,
        )
    except Exception as e:
        log.warning(
            "synthesizer_extract_fail",
            ticker=upper,
            error=str(e)[:200],
        )
        return ThesisStructured()

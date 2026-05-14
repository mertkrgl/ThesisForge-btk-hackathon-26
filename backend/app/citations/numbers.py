"""Numeric sanity check — claim'deki sayıların tool result'unda olması.

Türkçe biçimle (virgül ondalık ayırıcı, % işareti, binlik nokta) uyumlu.
Yaklaşım: liberal regex + birden fazla normalize edilmiş form ile
substring eşleştirme.
"""
from __future__ import annotations

import re


# 12   |  12,5   |   12.5   |   1.234,56   |   %23.5   |   -3.2
_NUMBER_RE = re.compile(
    r"-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?"
)


def extract_numbers(text: str) -> list[str]:
    """Verilen metindeki tüm sayısal token'ları döndür."""
    return _NUMBER_RE.findall(text)


def _normalize_variants(token: str) -> set[str]:
    """Bir sayı token'ı için olası string formları üret."""
    variants = {token}
    # boşluk yok
    t = token.strip()
    variants.add(t)
    # ondalık ayırıcısı her iki yön
    if "," in t:
        variants.add(t.replace(",", "."))
    if "." in t:
        variants.add(t.replace(".", ","))
    # binlik ayırıcısı sil
    variants.add(t.replace(".", "").replace(",", ""))
    variants.add(t.replace(",", "."))
    variants.add(t.replace(".", ","))
    # float'a parse edilebiliyorsa
    norm = t.replace(",", ".")
    try:
        f = float(norm)
        variants.add(str(f))
        if f.is_integer():
            variants.add(str(int(f)))
        # 1 ondalık temsili
        variants.add(f"{f:.1f}")
        variants.add(f"{f:.2f}")
        variants.add(f"{f:.1f}".replace(".", ","))
        variants.add(f"{f:.2f}".replace(".", ","))
    except ValueError:
        pass
    return variants


def number_appears_in(number_token: str, haystack: str) -> bool:
    """Numara haystack içinde herhangi bir formda görünüyor mu?"""
    for v in _normalize_variants(number_token):
        if v and v in haystack:
            return True
    return False


def find_unsupported_numbers(
    sentence: str, tool_result_str: str, *, skip_short: bool = True
) -> list[str]:
    """sentence içindeki, tool_result_str içinde bulunmayan sayıları döndür.

    skip_short: True ise 1-2 karakterlik küçük tek-haneli sayıları
    (yıl ifadeleri vb.) atla — yanlış-pozitif gürültüyü azaltır.
    """
    unsupported: list[str] = []
    for token in extract_numbers(sentence):
        clean = token.strip()
        if skip_short and len(clean.replace(",", "").replace(".", "").replace("-", "")) < 2:
            continue
        if not number_appears_in(clean, tool_result_str):
            unsupported.append(clean)
    return unsupported

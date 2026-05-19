"""sector_map.yaml bütünlük testi — lenient duplicate audit.

Mevcut `sector_map.yaml` içinde tarihsel olarak biriken duplicate ticker'lar
var (hisse hem Retail hem Healthcare listesinde gibi). `ticker_overrides`
bloğu duplicate kararını YAML sırasından bağımsızlaştırır. Bu test ise
override dışı kalan duplicate'leri stdout'a yazar — assert YOK, CI kırılmaz.

Strict moda yükseltme kararı sonraki bir sprint'e aittir; o zaman 33
mevcut duplicate ya override'a alınır ya da listelerin birinden silinir.
"""
from __future__ import annotations

from app.agents.sector_map import load_sector_map


def test_duplicate_tickers_audit(capsys):
    """Override dışı duplicate ticker varsa log'a yazar; test fail etmez."""
    sm = load_sector_map()
    overrides = set((sm.get("ticker_overrides") or {}).keys())
    seen: dict[str, str] = {}
    duplicates: list[tuple[str, str, str]] = []
    for squad, cfg in sm.items():
        if squad == "ticker_overrides":
            continue
        if not isinstance(cfg, dict):
            continue
        for t in cfg.get("tickers") or []:
            if t in seen and t not in overrides:
                duplicates.append((t, seen[t], squad))
            else:
                seen.setdefault(t, squad)
    if duplicates:
        print(
            f"\n[duplicate-audit] {len(duplicates)} override'sız duplicate ticker:"
        )
        for t, s1, s2 in duplicates:
            print(f"  {t}: {s1} & {s2}")


def test_overrides_are_known_squads():
    """`ticker_overrides` değerleri YAML'da tanımlı squad isimleri olmalı."""
    sm = load_sector_map()
    overrides = sm.get("ticker_overrides") or {}
    known_squads = {
        squad for squad in sm.keys() if squad != "ticker_overrides"
    }
    for ticker, squad in overrides.items():
        assert squad in known_squads, (
            f"ticker_overrides[{ticker}] = '{squad}' YAML'da tanımlı squad değil"
        )

"""Tüm probe'ları çalıştırır ve sonuçları tablo olarak basar."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from rich.console import Console
from rich.table import Table
from rich import box

import probe_tcmb
import probe_mkk
import probe_kap_pykap
import probe_kap_rss
import probe_yfinance
import probe_isyatirim
import probe_borsapy

console = Console()

PROBES = [
    ("TCMB EVDS", probe_tcmb.probe),
    ("MKK API Portal", probe_mkk.probe),
    ("pykap (KAP)", probe_kap_pykap.probe),
    ("KAP RSS", probe_kap_rss.probe),
    ("yfinance", probe_yfinance.probe),
    ("isyatirimhisse", probe_isyatirim.probe),
    ("borsapy", probe_borsapy.probe),
]

STATUS_ICON = {
    "OK": "[green]✅ OK[/green]",
    "PARTIAL": "[yellow]⚠️  PARTIAL[/yellow]",
    "FAIL": "[red]❌ FAIL[/red]",
    "SKIP": "[dim]⏭  SKIP[/dim]",
    "WARN": "[yellow]⚠️  WARN[/yellow]",
}


def run_all():
    table = Table(
        title="[bold]ThesisForge — Veri Kaynakları Probe Sonuçları[/bold]",
        box=box.ROUNDED,
        show_lines=True,
    )
    table.add_column("Kaynak", style="bold", min_width=18)
    table.add_column("Durum", min_width=14)
    table.add_column("Süre", min_width=7)
    table.add_column("Not", min_width=50)

    results = []
    for name, fn in PROBES:
        console.print(f"[dim]→ {name} test ediliyor...[/dim]")
        t0 = time.time()
        try:
            result = fn()
        except Exception as e:
            result = {"status": "FAIL", "note": f"İşlenemeyen hata: {e}"}
        elapsed = time.time() - t0
        results.append((name, result, elapsed))

    console.print()
    for name, result, elapsed in results:
        status = result.get("status", "FAIL")
        note = result.get("note", "")
        table.add_row(
            name,
            STATUS_ICON.get(status, status),
            f"{elapsed:.1f}s",
            note,
        )

    console.print(table)

    # Özet
    ok = sum(1 for _, r, _ in results if r.get("status") == "OK")
    partial = sum(1 for _, r, _ in results if r.get("status") in ("PARTIAL", "WARN"))
    skip = sum(1 for _, r, _ in results if r.get("status") == "SKIP")
    fail = sum(1 for _, r, _ in results if r.get("status") == "FAIL")
    total = len(results)

    console.print(
        f"\n[bold]Özet:[/bold] {ok}/{total} tam çalışıyor"
        f" | {partial} kısmi | {skip} atlandı (key eksik) | {fail} başarısız\n"
    )

    if skip > 0:
        console.print(
            "[yellow]ℹ  API key gerektiren kaynaklar için "
            "[bold].env.probe[/bold] dosyasını doldurun.[/yellow]"
        )


if __name__ == "__main__":
    run_all()

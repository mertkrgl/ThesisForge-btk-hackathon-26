#!/usr/bin/env bash
# ThesisForge tek-komut runner
#
# Kullanım:
#   ./run.sh                       # ASELS default
#   ./run.sh GARAN                 # GARAN default
#   ./run.sh GARAN conservative    # GARAN conservative
#   ./run.sh --stop                # uvicorn + postgres durdur
#
# Ne yapar:
#   1. postgres container'ı kontrol et, yoksa başlat
#   2. uvicorn /health'i kontrol et, yoksa background'da başlat
#   3. POST /chat → WS stream → GET /api/thesis → markdown dosyasına yaz
#   4. Sonuç: thesis_output_<TICKER>_<MODE>.md (repo kökünde)

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
UVICORN_LOG="/tmp/thesisforge_uvicorn.log"

if [[ "${1:-}" == "--stop" ]]; then
    echo "> Durduruluyor..."
    pkill -9 -f "uvicorn app.main" 2>/dev/null && echo "  uvicorn killed" || echo "  uvicorn already stopped"
    (cd "$ROOT" && docker compose stop postgres > /dev/null 2>&1) && echo "  postgres stopped" || echo "  postgres already stopped"
    exit 0
fi

TICKER="${1:-ASELS}"
MODE="${2:-default}"

if [[ "$MODE" != "default" && "$MODE" != "conservative" ]]; then
    echo "ERROR: mode 'default' veya 'conservative' olmalı (gelen: '$MODE')"
    exit 1
fi

echo "> ThesisForge runner  |  ticker=$TICKER  |  mode=$MODE"

# ─────────── 1. Postgres ───────────
if ! docker ps --format '{{.Names}}' | grep -q '^thesisforge-postgres$'; then
    echo "  postgres başlatılıyor..."
    (cd "$ROOT" && docker compose up -d postgres > /dev/null)
fi
until docker ps --format '{{.Names}} {{.Status}}' | grep -q 'thesisforge-postgres.*healthy'; do
    sleep 1
done
echo "  [ok] postgres healthy"

# ─────────── 2. Uvicorn ───────────
if curl -fsS http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo "  [ok] uvicorn already up"
else
    echo "  uvicorn başlatılıyor (log: $UVICORN_LOG)..."
    cd "$BACKEND"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    nohup uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info \
        > "$UVICORN_LOG" 2>&1 &
    disown
    cd "$ROOT"
    # ready bekle (max 30s)
    for _ in $(seq 1 30); do
        if curl -fsS http://127.0.0.1:8000/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    if ! curl -fsS http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "  [error] uvicorn 30s içinde ayağa kalkmadı; log: $UVICORN_LOG"
        tail -20 "$UVICORN_LOG"
        exit 2
    fi
    echo "  [ok] uvicorn ready"
fi

# ─────────── 3. Tez üret + markdown yaz ───────────
cd "$BACKEND"
# shellcheck disable=SC1091
source .venv/bin/activate
python scripts/run_thesis.py "$TICKER" "$MODE"

"""sys.path helpers — scripts/product/ klasörü bir Python paketi değil,
modüller birbirine `from macro import ...` gibi bare import yapıyor.

Bu helper, provider modülleri import edilmeden ÖNCE çağrılır ve
`scripts/product` dizinini sys.path'in başına idempotent şekilde ekler.
"""
from __future__ import annotations

import sys
from pathlib import Path

from app.core.config import settings


_PRODUCT_PATH_INSTALLED = False


def ensure_product_path() -> Path:
    """Idempotent — ilk çağrıda sys.path'e ekler, sonraki çağrılar no-op."""
    global _PRODUCT_PATH_INSTALLED
    p = settings.PRODUCT_SCRIPTS_PATH
    if not _PRODUCT_PATH_INSTALLED:
        s = str(p)
        if s not in sys.path:
            sys.path.insert(0, s)
        _PRODUCT_PATH_INSTALLED = True
    return p

"""Cache backend — InMemory (dev) + RedisCache placeholder (Aşama 13).

Provider chain `fetch_cached(key, ttl)` ile cache-aware çalışır.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from cachetools import TTLCache

from app.core.config import settings


class CacheBackend(ABC):
    @abstractmethod
    async def get(self, key: str) -> Any | None: ...

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...


class InMemoryCache(CacheBackend):
    """Process-local TTLCache. Her TTL kendi bucket'ında durur."""

    def __init__(self, maxsize: int = 1000):
        self._maxsize = maxsize
        self._buckets: dict[int, TTLCache] = {}

    async def get(self, key: str) -> Any | None:
        for cache in self._buckets.values():
            if key in cache:
                return cache[key]
        return None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        bucket = self._buckets.setdefault(
            ttl, TTLCache(maxsize=self._maxsize, ttl=ttl)
        )
        bucket[key] = value

    async def delete(self, key: str) -> None:
        for cache in self._buckets.values():
            cache.pop(key, None)


_singleton: CacheBackend | None = None


def get_cache_backend() -> CacheBackend:
    """Settings'e göre singleton cache döner."""
    global _singleton
    if _singleton is not None:
        return _singleton

    if settings.CACHE_BACKEND == "redis":
        raise NotImplementedError(
            "Redis cache backend Aşama 13'te eklenir. CACHE_BACKEND=memory kullan."
        )

    _singleton = InMemoryCache()
    return _singleton


def reset_cache_backend() -> None:
    """Test fixture kullanımı için singleton'u sıfırla."""
    global _singleton
    _singleton = None

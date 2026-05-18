/**
 * Backend HTTP/WS base + apiFetch (auth-aware).
 *
 * P1 auth sonrası: apiFetch otomatik Authorization header ekler (varsa),
 * 401 alırsa bir kez refresh dener, refresh de fail ederse global sign-out
 * sinyali yayınlar (AuthProvider yakalar → /login redirect).
 *
 * Demo user flow deprecated — getDemoUserId() yine de export edilir ki
 * eski çağrılar derleme hatası vermesin; new code kullanmamalı.
 */

import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  clearAuth,
} from "@/lib/auth/storage";
import { emitSignOut } from "@/lib/auth/signal";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "") ||
  API_BASE_URL.replace(/^http/i, "ws");

const DEMO_USER_KEY = "thesisforge.demo_user_id";

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @deprecated P1 auth ile birlikte JWT kullanıyoruz. Yeni kod yazarken
 * useAuth() hook'undan user.id alın. Geçici BC için kalan referanslar
 * (örn. mock veriler) bu fonksiyonu çağırmaya devam ediyor.
 */
export function getDemoUserId(): string {
  if (typeof window === "undefined") {
    return "00000000-0000-0000-0000-000000000000";
  }
  let id = window.localStorage.getItem(DEMO_USER_KEY);
  if (!id) {
    id = generateUuid();
    window.localStorage.setItem(DEMO_USER_KEY, id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function tryRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string };
    saveAccessToken(data.access_token);
    return data.access_token;
  } catch {
    return null;
  }
}

async function doFetch(
  url: string,
  init: RequestInit | undefined,
  accessToken: string | null,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(url, { ...init, headers });
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  let access = getAccessToken();

  let res = await doFetch(url, init, access);

  // 401 → refresh + bir kez retry. Refresh başarısızsa sign-out sinyali.
  if (res.status === 401 && access) {
    const newToken = await tryRefresh();
    if (newToken) {
      access = newToken;
      res = await doFetch(url, init, access);
    }
    if (res.status === 401) {
      // refresh de fail etti veya retry yine 401 — oturum sonlandı
      clearAuth();
      emitSignOut();
    }
  }

  if (!res.ok) {
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
    }
    const detail =
      (body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : undefined) || res.statusText;
    throw new ApiError(res.status, detail, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function wsUrl(path: string): string {
  if (path.startsWith("ws://") || path.startsWith("wss://")) return path;
  if (!path.startsWith("/")) path = `/${path}`;
  return `${WS_BASE_URL}${path}`;
}

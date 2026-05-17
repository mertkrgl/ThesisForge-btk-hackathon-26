/**
 * Backend HTTP/WS base + demo user_id helper + apiFetch.
 *
 * Backend `/chat` watchlist'in zorunlu `user_id`'sini ister; auth henüz yok.
 * Demo modu için kullanıcıya tarayıcı bazında sabit bir UUID atıyoruz.
 */

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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const res = await fetch(url, { ...init, headers });
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

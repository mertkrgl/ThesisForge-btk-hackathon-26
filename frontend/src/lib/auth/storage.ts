/**
 * localStorage'da JWT + user. Custom auth — NextAuth kullanmıyoruz.
 *
 * Trade-off: localStorage XSS riski taşır (httpOnly cookie daha güvenli olurdu)
 * ama backend FastAPI ve frontend Next aynı originden değil; cross-origin
 * cookie kurulumu hackathon'a yetişmez. Demo bağlamında kabul edilebilir risk.
 */
import type { AuthUser, TokenPair } from "./types";

const KEY_ACCESS = "thesisforge.auth.access_token";
const KEY_REFRESH = "thesisforge.auth.refresh_token";
const KEY_USER = "thesisforge.auth.user";

function safeWindow(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return safeWindow()?.getItem(KEY_ACCESS) ?? null;
}

export function getRefreshToken(): string | null {
  return safeWindow()?.getItem(KEY_REFRESH) ?? null;
}

export function getStoredUser(): AuthUser | null {
  const raw = safeWindow()?.getItem(KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: TokenPair): void {
  const ls = safeWindow();
  if (!ls) return;
  ls.setItem(KEY_ACCESS, tokens.access_token);
  ls.setItem(KEY_REFRESH, tokens.refresh_token);
  ls.setItem(KEY_USER, JSON.stringify(tokens.user));
}

export function saveAccessToken(token: string): void {
  safeWindow()?.setItem(KEY_ACCESS, token);
}

export function saveUser(user: AuthUser): void {
  safeWindow()?.setItem(KEY_USER, JSON.stringify(user));
}

export function clearAuth(): void {
  const ls = safeWindow();
  if (!ls) return;
  ls.removeItem(KEY_ACCESS);
  ls.removeItem(KEY_REFRESH);
  ls.removeItem(KEY_USER);
}

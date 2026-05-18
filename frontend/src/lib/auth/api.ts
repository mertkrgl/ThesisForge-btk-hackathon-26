/**
 * Auth API client — register/login/refresh/me.
 *
 * apiFetch'i kullanmıyoruz çünkü apiFetch otomatik Authorization header
 * ekliyor + 401'de refresh deniyor; auth endpoint'lerinde bu davranış yanlış
 * (refresh request'i refresh deneyemez, login request'i auth header'a sahip
 * olmamalı). Burada düz fetch + manuel error handling.
 */
import { API_BASE_URL, ApiError } from "@/lib/api/client";
import type { AuthUser, TokenPair } from "./types";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let parsed: unknown = undefined;
    try {
      parsed = await res.json();
    } catch {
      /* ignore */
    }
    const detail =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? typeof (parsed as { detail: unknown }).detail === "string"
          ? String((parsed as { detail: unknown }).detail)
          : "Doğrulama hatası."
        : undefined) || res.statusText;
    throw new ApiError(res.status, detail, parsed);
  }
  return (await res.json()) as T;
}

export function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<TokenPair> {
  return postJson<TokenPair>("/api/auth/register", input);
}

export function loginUser(input: {
  email: string;
  password: string;
}): Promise<TokenPair> {
  return postJson<TokenPair>("/api/auth/login", input);
}

export function refreshAccessToken(refresh_token: string): Promise<{
  access_token: string;
  token_type: "bearer";
}> {
  return postJson("/api/auth/refresh", { refresh_token });
}

export async function fetchMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new ApiError(res.status, "Oturum doğrulanamadı.");
  }
  return (await res.json()) as AuthUser;
}

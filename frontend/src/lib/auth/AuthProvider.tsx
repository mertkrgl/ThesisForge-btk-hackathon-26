"use client";

/**
 * Auth Context — global session state.
 *
 * Mount sırasında localStorage'dan token + user okur, /api/auth/me ile
 * doğrular. Token expired ise refresh dener, refresh de fail ederse anonymous'a
 * düşer ve localStorage temizler.
 *
 * apiFetch (lib/api/client) bu provider'a doğrudan bağlı değil — token'ları
 * storage'dan okur. Ancak 401 olduğunda provider'a session expired event'i
 * iletmek için global bir `signOut` callback'i kaydeder.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  loginUser as apiLoginUser,
  refreshAccessToken,
  registerUser as apiRegisterUser,
} from "./api";
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveAccessToken,
  saveTokens,
  saveUser,
} from "./storage";
import { registerSignOutCallback } from "./signal";
import type { AuthState, AuthUser } from "./types";

type AuthContextValue = {
  state: AuthState;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const router = useRouter();
  const bootstrapped = useRef(false);

  const setAuthenticated = useCallback((user: AuthUser) => {
    setState({ status: "authenticated", user });
  }, []);

  const setAnonymous = useCallback(() => {
    setState({ status: "anonymous" });
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAnonymous();
  }, [setAnonymous]);

  // apiFetch içinden 401 geldiğinde tetiklenecek global sinyal
  useEffect(() => {
    return registerSignOutCallback(() => {
      logout();
      router.push("/login");
    });
  }, [logout, router]);

  // Mount: localStorage'dan oku, /me ile verify et
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const access = getAccessToken();
    const refresh = getRefreshToken();
    const stored = getStoredUser();

    if (!access || !stored) {
      queueMicrotask(() => setAnonymous());
      return;
    }

    // Optimistic: hızla "authenticated" göster (UI flicker önlemi),
    // arka planda /me ile doğrula.
    queueMicrotask(() => setAuthenticated(stored));

    (async () => {
      try {
        const fresh = await fetchMe(access);
        saveUser(fresh);
        setAuthenticated(fresh);
      } catch {
        // Access expired olabilir → refresh dene
        if (!refresh) {
          clearAuth();
          setAnonymous();
          return;
        }
        try {
          const { access_token } = await refreshAccessToken(refresh);
          saveAccessToken(access_token);
          const fresh = await fetchMe(access_token);
          saveUser(fresh);
          setAuthenticated(fresh);
        } catch {
          clearAuth();
          setAnonymous();
        }
      }
    })();
  }, [setAuthenticated, setAnonymous]);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const tokens = await apiLoginUser({ email, password });
      saveTokens(tokens);
      setAuthenticated(tokens.user);
      return tokens.user;
    },
    [setAuthenticated],
  );

  const register = useCallback(
    async (input: { email: string; password: string; name?: string }) => {
      const tokens = await apiRegisterUser(input);
      saveTokens(tokens);
      setAuthenticated(tokens.user);
      return tokens.user;
    },
    [setAuthenticated],
  );

  const refreshUser = useCallback(async () => {
    const access = getAccessToken();
    if (!access) return;
    try {
      const fresh = await fetchMe(access);
      saveUser(fresh);
      setAuthenticated(fresh);
    } catch {
      /* sessiz fail — bir sonraki guard'a bırak */
    }
  }, [setAuthenticated]);

  const value: AuthContextValue = {
    state,
    user: state.status === "authenticated" ? state.user : null,
    isAuthenticated: state.status === "authenticated",
    isLoading: state.status === "loading",
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

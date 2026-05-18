"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get("next") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next);
    }
  }, [isLoading, isAuthenticated, router, next]);

  const pwOk = password.length >= 8;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!pwOk) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      });
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Kayıt başarısız. Tekrar deneyin.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2563EB,#22C55E,#F59E0B)]" />

        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          ThesisForge
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Hesap oluştur
        </h1>
        <p className="mt-1 text-[13px] text-text-2">
          Komitenizi ücretsiz kurun. Email + şifre yeterli.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-bear/30 bg-bear/10 p-3 text-[12.5px] text-bear">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Field
            label="Ad (opsiyonel)"
            htmlFor="reg-name"
            input={
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız"
                className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 dark:bg-muted dark:text-white"
              />
            }
          />
          <Field
            label="Email"
            htmlFor="reg-email"
            input={
              <input
                id="reg-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siz@ornek.com"
                className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 dark:bg-muted dark:text-white"
              />
            }
          />
          <Field
            label="Şifre"
            htmlFor="reg-password"
            hint="En az 8 karakter."
            input={
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "h-11 w-full rounded-lg border bg-slate-50 px-3 pr-10 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-[3px] dark:bg-muted dark:text-white",
                    password.length === 0
                      ? "border-border focus:border-primary focus:ring-primary/20"
                      : pwOk
                        ? "border-bull/40 focus:border-bull focus:ring-bull/20"
                        : "border-warn/40 focus:border-warn focus:ring-warn/20",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-text-2"
                  aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            }
          />

          <button
            type="submit"
            disabled={busy || !email.trim() || !pwOk}
            className={cn(
              "mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-semibold text-primary-foreground shadow-[0_10px_25px_-10px_#3B82F6] transition-all hover:bg-[#2563EB]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <UserPlus className="h-4 w-4" />
            {busy ? "Hesap oluşturuluyor…" : "Kayıt Ol"}
          </button>
        </form>

        <div className="mt-5 border-t border-border pt-4 text-center text-[12.5px] text-text-2">
          Zaten hesabınız var mı?{" "}
          <Link
            href={`/login${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-primary hover:underline"
          >
            Giriş yapın
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuthFallback() {
  return (
    <div className="h-[480px] w-full max-w-md animate-pulse rounded-2xl border border-border bg-card/60" />
  );
}

function Field({
  label,
  htmlFor,
  input,
  hint,
}: {
  label: string;
  htmlFor: string;
  input: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="mt-1.5">{input}</div>
      {hint && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listTheses } from "@/lib/api/thesis";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ThesisCard } from "@/components/app/ThesisCard";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/MotionWrappers";
import type { Thesis } from "@/lib/mock/types";

export function RecentTheses() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<Thesis[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!isAuthenticated) {
      queueMicrotask(() => {
        if (!cancelled) setItems([]);
      });
      return;
    }
    listTheses()
      .then((rows) => {
        if (!cancelled) setItems(rows.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white">
          Son Tezler
        </h2>
        <Link
          href="/app/history"
          className="text-[12px] text-text-2 hover:text-white"
        >
          Tümü →
        </Link>
      </div>
      <StaggerContainer
        stagger={0.08}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {items.map((t) => (
          <StaggerItem key={t.id}>
            <ThesisCard thesis={t} />
          </StaggerItem>
        ))}
      </StaggerContainer>
      {!authLoading && isAuthenticated && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-[12px] text-muted-foreground">
          Henüz üretilmiş tez yok.
        </div>
      )}
    </div>
  );
}

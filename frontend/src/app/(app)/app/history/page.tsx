import { Suspense } from "react";
import { HistoryClient } from "@/components/app/HistoryClient";

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryClient />
    </Suspense>
  );
}

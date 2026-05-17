import { apiFetch } from "@/lib/api/client";
import type { BackendConfigInfo } from "@/lib/types/backend";

export async function getConfigInfo(): Promise<BackendConfigInfo> {
  return apiFetch<BackendConfigInfo>(`/api/config/info`);
}

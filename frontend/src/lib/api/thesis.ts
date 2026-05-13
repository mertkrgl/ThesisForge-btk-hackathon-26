import {
  MOCK_THESES,
  getThesisById,
  listThesesByTicker,
} from "@/lib/mock/theses";
import { createMockThesisStream } from "@/lib/mock/stream";
import type { StreamEvent, Thesis } from "@/lib/mock/types";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "0";

export async function getThesis(id: string): Promise<Thesis | undefined> {
  if (USE_MOCKS) return getThesisById(id);
  // TODO: real API
  return undefined;
}

export async function listTheses(ticker?: string): Promise<Thesis[]> {
  if (USE_MOCKS) return listThesesByTicker(ticker);
  // TODO: real API
  return MOCK_THESES;
}

export function streamThesis(
  _params: { ticker: string; question?: string },
  onEvent: (e: StreamEvent) => void
) {
  // Mock için her zaman fake stream. Backend gelince ResilientThesisClient'a swap.
  return createMockThesisStream(onEvent, { speed: 1 });
}

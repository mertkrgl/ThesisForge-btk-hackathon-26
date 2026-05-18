import { apiFetch } from "@/lib/api/client";

export type CompanyRow = {
  ticker: string;
  title: string;
  member_type: string;
  squad: string;
};

export type CompaniesPage = {
  items: CompanyRow[];
  total: number;
  limit: number;
  offset: number;
};

export async function listCompanies(params: {
  search?: string;
  squad?: string;
  limit?: number;
  offset?: number;
}): Promise<CompaniesPage> {
  const qp = new URLSearchParams();
  if (params.search) qp.set("search", params.search);
  if (params.squad) qp.set("squad", params.squad);
  qp.set("limit", String(params.limit ?? 40));
  qp.set("offset", String(params.offset ?? 0));
  return apiFetch<CompaniesPage>(`/api/companies?${qp.toString()}`);
}

import { supabase } from "./supabase";
import type {
  AppUser,
  BusinessNumber,
  Call,
  CallExtraction,
  CallsByPeriodPoint,
  Customer,
  Employee,
  FollowUp,
  FollowUpBreakdownPoint,
  FollowUpStatus,
  Paginated,
  Product,
  ReportsSummary,
  SentimentType,
  TopCarModelPoint,
  TopProductPoint,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // response wasn't JSON -- fall through to statusText
  }
  return res.statusText || `Request failed (${res.status})`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  Object.entries(await authHeader()).forEach(([k, v]) => headers.set(k, v));
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const headers = new Headers(await authHeader());
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res));
  return res.blob();
}

function query(params: object): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | boolean | undefined>)) {
    if (value !== undefined && value !== "") usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export interface CallsQuery {
  search?: string;
  phone?: string;
  carModel?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomersQuery {
  search?: string;
  phone?: string;
  page?: number;
  pageSize?: number;
}

export interface FollowUpsQuery {
  status?: FollowUpStatus;
  assignedTo?: string;
  dueBefore?: string;
  page?: number;
  pageSize?: number;
}

export interface EmployeeInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  active?: boolean;
}

export interface ProductInput {
  name: string;
  category: "car_glasses" | "car_modifications";
  active?: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export interface UpdateExtractionInput {
  customerName?: string;
  carMake?: string;
  carModel?: string;
  carVariant?: string;
  customerRequirements?: string;
  budget?: number;
  followUpRequired?: boolean;
  followUpDate?: string;
  summary?: string;
  sentiment?: SentimentType;
}

export const api = {
  auth: {
    me: () => request<AppUser>("/auth/me"),
  },

  calls: {
    list: (q: CallsQuery = {}) => request<Paginated<Call>>(`/calls${query(q)}`),
    get: (id: string) => request<Call>(`/calls/${id}`),
    recording: (id: string) => request<{ url: string; expiresAt: string }>(`/calls/${id}/recording`),
    updateExtraction: (id: string, dto: UpdateExtractionInput) =>
      request<CallExtraction>(`/calls/${id}/extraction`, { method: "PATCH", body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ deleted: true }>(`/calls/${id}`, { method: "DELETE" }),
    reprocess: (id: string) => request<{ enqueued: true; callId: string }>(`/calls/${id}/reprocess`, { method: "POST" }),
    processingStatus: (id: string) =>
      request<{ id: string; status: Call["status"]; failureReason: string | null; updatedAt: string }>(
        `/calls/${id}/processing-status`,
      ),
    regenerateSummary: (id: string) =>
      request<{ enqueued: true; callId: string }>(`/calls/${id}/extraction/regenerate-summary`, { method: "POST" }),
  },

  customers: {
    list: (q: CustomersQuery = {}) => request<Paginated<Customer>>(`/customers${query(q)}`),
    get: (id: string) => request<Customer>(`/customers/${id}`),
    calls: (id: string) => request<Call[]>(`/customers/${id}/calls`),
    update: (id: string, dto: { name?: string; notes?: string }) =>
      request<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    duplicates: () =>
      request<{ id_a: string; name_a: string; id_b: string; name_b: string; similarity: number }[]>(
        "/customers/duplicates",
      ),
    merge: (duplicateId: string, canonicalId: string) =>
      request<Customer>(`/customers/duplicates/${duplicateId}/merge`, {
        method: "POST",
        body: JSON.stringify({ canonicalId }),
      }),
  },

  employees: {
    list: (active?: boolean) => request<Employee[]>(`/employees${query({ active })}`),
    create: (dto: EmployeeInput) => request<Employee>("/employees", { method: "POST", body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<EmployeeInput>) =>
      request<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ deleted: true }>(`/employees/${id}`, { method: "DELETE" }),
  },

  products: {
    list: (category?: string) => request<Product[]>(`/products${query({ category })}`),
    create: (dto: ProductInput) => request<Product>("/products", { method: "POST", body: JSON.stringify(dto) }),
    update: (id: string, dto: Partial<ProductInput>) =>
      request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ deleted: true }>(`/products/${id}`, { method: "DELETE" }),
  },

  followUps: {
    list: (q: FollowUpsQuery = {}) => request<Paginated<FollowUp>>(`/follow-ups${query(q)}`),
    update: (id: string, dto: { status?: FollowUpStatus; assignedTo?: string; notes?: string }) =>
      request<FollowUp>(`/follow-ups/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
  },

  reports: {
    summary: () => request<ReportsSummary>("/reports/summary"),
    callsByPeriod: (granularity: "daily" | "weekly" | "monthly" = "daily") =>
      request<CallsByPeriodPoint[]>(`/reports/calls-by-period${query({ granularity })}`),
    followUps: () => request<FollowUpBreakdownPoint[]>("/reports/follow-ups"),
    topCarModels: (limit?: number) => request<TopCarModelPoint[]>(`/reports/top-car-models${query({ limit })}`),
    topProducts: (limit?: number) => request<TopProductPoint[]>(`/reports/top-products${query({ limit })}`),
  },

  businessNumbers: {
    list: () => request<BusinessNumber[]>("/business-numbers"),
  },

  export: {
    calls: (format: "xlsx" | "pdf", q: CallsQuery = {}) => requestBlob(`/export/calls.${format}${query(q)}`),
  },

  import: {
    template: () => requestBlob("/import/calls/template"),
    calls: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return request<ImportResult>("/import/calls", { method: "POST", body });
    },
  },
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

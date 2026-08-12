import { supabase } from "./supabase";
import type {
  AppUser,
  AuditLogEntry,
  BusinessCategory,
  BusinessNumber,
  Call,
  CallDuplicateGroup,
  CallExtraction,
  CallsByPeriodPoint,
  Customer,
  CustomerCallHistoryRow,
  CustomersByPeriodPoint,
  Employee,
  FollowUp,
  FollowUpBreakdownPoint,
  FollowUpStatus,
  Paginated,
  PhotoExtractResult,
  Product,
  ReportsSummary,
  SentimentBreakdownPoint,
  SentimentType,
  TopCarModelPoint,
  TopEmployeePoint,
  TopProductPoint,
  UserRole,
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

// Array values are comma-joined into a single query param (matching the
// backend's ToArray() parsing) -- simpler than repeated keys and works the
// same whether the caller passes one value or several.
function query(params: object): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | boolean | string[] | undefined>)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) usp.set(key, value.join(","));
    } else {
      usp.set(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export interface CallsQuery {
  search?: string;
  phone?: string;
  carMake?: string[];
  carModel?: string[];
  sentiment?: SentimentType[];
  followUpRequired?: boolean;
  category?: string[];
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string[];
  page?: number;
  pageSize?: number;
}

export interface CustomersQuery {
  search?: string;
  phone?: string;
  carMake?: string[];
  carModel?: string[];
  category?: string[];
  page?: number;
  pageSize?: number;
}

export interface ReportsQuery {
  category?: string[];
  employeeId?: string[];
  carMake?: string[];
  carModel?: string[];
  sentiment?: SentimentType[];
  productId?: string[];
  dateFrom?: string;
  dateTo?: string;
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

export interface InviteTeamMemberInput {
  name: string;
  email: string;
  role: UserRole;
  redirectTo: string;
}

export interface CommitPhotoRowInput {
  phoneNumber: string;
  businessCategory?: BusinessCategory;
  callDate?: string;
  customerName?: string;
  employeeId?: string;
  durationSeconds?: number;
  carMake?: string;
  carModel?: string;
  carVariant?: string;
  location?: string;
  productsDiscussed?: string[];
  customerRequirements?: string;
  budget?: number;
  followUpRequired?: boolean;
  followUpDate?: string;
  summary?: string;
  sentiment?: SentimentType;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export interface ImportedRowSummary {
  callId: string;
  customerName?: string;
  phoneNumber: string;
  businessCategory: BusinessCategory;
  callDate: string;
  location?: string;
}

export interface CommitRowsResult extends ImportResult {
  importedRows: ImportedRowSummary[];
}

export interface ParsedExcelRow {
  sourceRow: number;
  phoneNumber: string;
  businessCategory?: BusinessCategory;
  callDate?: string;
  customerName?: string;
  employeeId?: string;
  durationSeconds?: number;
  carMake?: string;
  carModel?: string;
  carVariant?: string;
  location?: string;
  productsDiscussed?: string[];
  customerRequirements?: string;
  budget?: number;
  followUpRequired?: boolean;
  followUpDate?: string;
  summary?: string;
  sentiment?: SentimentType;
}

export interface RawSheetPreview {
  headers: string[];
  rows: string[][];
  totalDataRows: number;
}

export interface SheetPreview {
  name: string;
  preview: RawSheetPreview;
}

export interface ParseExcelResult {
  rows: ParsedExcelRow[];
  errors: { row: number; reason: string }[];
  sheets: SheetPreview[];
}

export interface RecordImportHistoryInput {
  source: "excel" | "photo_ocr" | "manual";
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  rows: ImportedRowSummary[];
}

export interface UpdateCallInput {
  businessCategory?: BusinessCategory;
  callDate?: string;
  employeeId?: string;
}

export interface UpdateExtractionInput {
  customerName?: string;
  carMake?: string;
  carModel?: string;
  carVariant?: string;
  location?: string;
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
    update: (id: string, dto: UpdateCallInput) => request<Call>(`/calls/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    updateExtraction: (id: string, dto: UpdateExtractionInput) =>
      request<CallExtraction>(`/calls/${id}/extraction`, { method: "PATCH", body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ deleted: true }>(`/calls/${id}`, { method: "DELETE" }),
    removeMany: (ids: string[]) =>
      request<{ deleted: number }>("/calls/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
    carMakes: (carModel?: string[]) => request<string[]>(`/calls/car-makes${query({ carModel })}`),
    carModels: (carMake?: string[]) => request<string[]>(`/calls/car-models${query({ carMake })}`),
    duplicates: () => request<CallDuplicateGroup[]>("/calls/duplicates"),
    mergeDuplicate: (duplicateId: string, canonicalId: string) =>
      request<Call>(`/calls/duplicates/${duplicateId}/merge`, { method: "POST", body: JSON.stringify({ canonicalId }) }),
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
      request<
        {
          id_a: string;
          name_a: string;
          phone_a: string;
          id_b: string;
          name_b: string;
          phone_b: string;
          name_similarity: number;
          phone_similarity: number;
          vehicle_match: boolean;
          vehicle_a: string | null;
          vehicle_b: string | null;
          call_count_a: number;
          call_count_b: number;
        }[]
      >("/customers/duplicates"),
    merge: (duplicateId: string, canonicalId: string) =>
      request<Customer>(`/customers/duplicates/${duplicateId}/merge`, {
        method: "POST",
        body: JSON.stringify({ canonicalId }),
      }),
    removeMany: (ids: string[]) =>
      request<{ deleted: number }>("/customers/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
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
    summary: (q: ReportsQuery = {}) => request<ReportsSummary>(`/reports/summary${query(q)}`),
    callsByPeriod: (granularity: "daily" | "weekly" | "monthly" = "daily", q: ReportsQuery = {}) =>
      request<CallsByPeriodPoint[]>(`/reports/calls-by-period${query({ granularity, ...q })}`),
    customersByPeriod: (granularity: "daily" | "weekly" | "monthly" = "daily", q: ReportsQuery = {}) =>
      request<CustomersByPeriodPoint[]>(`/reports/customers-by-period${query({ granularity, ...q })}`),
    followUps: (q: ReportsQuery = {}) => request<FollowUpBreakdownPoint[]>(`/reports/follow-ups${query(q)}`),
    sentiment: (q: ReportsQuery = {}) => request<SentimentBreakdownPoint[]>(`/reports/sentiment${query(q)}`),
    topCarModels: (limit?: number, q: ReportsQuery = {}) =>
      request<TopCarModelPoint[]>(`/reports/top-car-models${query({ limit, ...q })}`),
    topProducts: (limit?: number, q: ReportsQuery = {}) =>
      request<TopProductPoint[]>(`/reports/top-products${query({ limit, ...q })}`),
    topEmployees: (limit?: number, q: ReportsQuery = {}) =>
      request<TopEmployeePoint[]>(`/reports/top-employees${query({ limit, ...q })}`),
    customerCallHistory: (page = 1, pageSize = 20, q: ReportsQuery = {}) =>
      request<Paginated<CustomerCallHistoryRow>>(`/reports/customer-call-history${query({ page, pageSize, ...q })}`),
  },

  businessNumbers: {
    list: () => request<BusinessNumber[]>("/business-numbers"),
  },

  export: {
    calls: (format: "xlsx" | "pdf", q: CallsQuery = {}) => requestBlob(`/export/calls.${format}${query(q)}`),
    history: () => request<AuditLogEntry[]>("/export/history"),
  },

  import: {
    template: () => requestBlob("/import/calls/template"),
    parseExcel: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return request<ParseExcelResult>("/import/calls", { method: "POST", body });
    },
    history: () => request<AuditLogEntry[]>("/import/calls/history"),
    deleteHistory: (id: string) => request<{ deletedCalls: number }>(`/import/calls/history/${id}`, { method: "DELETE" }),
    extractPhotos: (files: File[]) => {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      return request<PhotoExtractResult[]>("/import/photos/extract", { method: "POST", body });
    },
    commitPhotoRows: (rows: CommitPhotoRowInput[]) =>
      request<CommitRowsResult>("/import/photos/commit", { method: "POST", body: JSON.stringify({ rows }) }),
    recordHistory: (dto: RecordImportHistoryInput) =>
      request<{ recorded: true }>("/import/history", { method: "POST", body: JSON.stringify(dto) }),
  },

  team: {
    list: () => request<AppUser[]>("/team"),
    invite: (dto: InviteTeamMemberInput) => request<AppUser>("/team/invite", { method: "POST", body: JSON.stringify(dto) }),
    update: (id: string, dto: { name?: string; role?: UserRole; active?: boolean }) =>
      request<AppUser>(`/team/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
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

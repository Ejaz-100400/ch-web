// Mirrors the subset of the call-management-api's Prisma schema the
// dashboard consumes. Keep field names/casing identical to the API's JSON
// responses (camelCase) so no mapping layer is needed.

export type BusinessCategory = "car_glasses" | "car_modifications";

export type CallStatus = "pending" | "processing" | "completed" | "failed";

export type SentimentType = "interested" | "not_interested" | "needs_follow_up";

export type FollowUpStatus = "pending" | "completed" | "missed";

export type UserRole = "admin" | "manager" | "viewer";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string | null;
  phoneNumber: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: BusinessCategory;
  active: boolean;
  createdAt: string;
}

export interface Transcript {
  id: string;
  callId: string;
  rawText: string;
  language: string | null;
  provider: string | null;
  createdAt: string;
}

export interface CallExtraction {
  id: string;
  callId: string;
  customerName: string | null;
  phoneNumber: string | null;
  businessCategory: BusinessCategory | null;
  carMake: string | null;
  carModel: string | null;
  carVariant: string | null;
  productsDiscussed: string[];
  customerRequirements: string | null;
  budget: number | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  summary: string | null;
  sentiment: SentimentType | null;
  extractedByModel: string | null;
  extractedAt: string | null;
  editedBy: string | null;
  editedAt: string | null;
}

export interface Call {
  id: string;
  externalCallId: string | null;
  businessCategory: BusinessCategory;
  employeeId: string | null;
  customerId: string | null;
  callDate: string;
  durationSeconds: number;
  recordingStorageKey: string | null;
  status: CallStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer | null;
  employee?: Employee | null;
  extraction?: CallExtraction | null;
  transcript?: Transcript | null;
  products?: { product: Product }[];
  importedBy?: { name: string; email: string } | null;
}

export interface FollowUp {
  id: string;
  callId: string;
  dueDate: string;
  status: FollowUpStatus;
  assignedTo: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  call?: Call & { customer?: Customer | null };
  employee?: Employee | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportsSummary {
  totalCalls: number;
  totalEnquiries: number;
  carGlassesEnquiries: number;
  carModificationEnquiries: number;
  followUpsPending: number;
}

export interface CallsByPeriodPoint {
  period: string;
  count: number;
}

export interface FollowUpBreakdownPoint {
  status: FollowUpStatus;
  count: number;
}

export interface TopCarModelPoint {
  car_model: string;
  count: number;
}

export interface TopProductPoint {
  name: string;
  category: BusinessCategory;
  count: number;
}

export interface ExtractedEntry {
  customerName: string | null;
  phoneNumber: string | null;
  businessCategory: BusinessCategory | null;
  callDate: string | null;
  employeeName: string | null;
  carMake: string | null;
  carModel: string | null;
  carVariant: string | null;
  productsDiscussed: string[];
  customerRequirements: string | null;
  budget: number | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  summary: string | null;
  sentiment: SentimentType | null;
  rawNoteText: string;
}

export interface PhotoExtractResult {
  sourceFile: string;
  entries: ExtractedEntry[];
  error?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  createdAt: string;
  details: Record<string, unknown> | null;
  user: { name: string; email: string | null } | null;
}

export interface BusinessNumber {
  number: string;
  category: BusinessCategory;
  label: string;
}

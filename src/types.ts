// Mirrors the subset of the call-management-api's Prisma schema the
// dashboard consumes. Keep field names/casing identical to the API's JSON
// responses (camelCase) so no mapping layer is needed.

export type BusinessCategory = "car_glasses" | "car_modifications" | "unknown";

export type CallStatus = "pending" | "processing" | "completed" | "failed";

export type Branch = "ambattur" | "kattankulathur" | "sithalapakkam" | "pondicherry";

export type SentimentType = "interested" | "not_interested" | "needs_follow_up";

export type FollowUpStatus = "pending" | "completed" | "missed";

export type UserRole = "admin" | "manager" | "viewer";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isOwner: boolean;
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
  // Only present on list responses -- the vehicle from this customer's most
  // recent call, since a customer can have several cars over time.
  latestCarMake?: string | null;
  latestCarModel?: string | null;
  latestCarVariant?: string | null;
}

export interface Product {
  id: string;
  name: string;
  // Products always belong to a real business line -- unlike calls, "unknown" never applies here.
  category: "car_glasses" | "car_modifications";
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
  location: string | null;
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
  direction: "inbound" | "outbound";
  channel: "phone" | "whatsapp";
  businessCategory: BusinessCategory;
  branch: Branch | null;
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

export interface CallDuplicateEntry {
  id: string;
  businessCategory: BusinessCategory;
  carMake: string | null;
  carModel: string | null;
  employeeName: string | null;
  status: CallStatus;
  summary: string | null;
  imported: boolean;
  createdAt: string;
}

export interface CallDuplicateGroup {
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  callDate: string;
  calls: CallDuplicateEntry[];
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
  carGlassesEnquiries: number;
  carModificationEnquiries: number;
  unknownCategoryEnquiries: number;
  followUpsPending: number;
  followUpsOverdue: number;
  followUpsCompleted: number;
  followUpsMissed: number;
  avgCallDurationSeconds: number | null;
  interestedRate: number | null;
  followUpCompletionRate: number | null;
  totalCustomers: number;
  returningCustomers: number;
}

export interface CallsByPeriodPoint {
  period: string;
  carGlasses: number;
  carModifications: number;
  unknown: number;
}

export interface CustomersByPeriodPoint {
  period: string;
  count: number;
}

export interface FollowUpBreakdownPoint {
  status: FollowUpStatus;
  count: number;
}

export interface SentimentBreakdownPoint {
  sentiment: SentimentType;
  count: number;
}

export interface TopEmployeePoint {
  name: string;
  count: number;
}

export interface BranchBreakdownPoint {
  branch: Branch;
  count: number;
}

export interface TopCarModelPoint {
  car_model: string;
  count: number;
}

export interface TopCarMakePoint {
  car_make: string;
  count: number;
}

export interface TopProductPoint {
  name: string;
  category: BusinessCategory;
  count: number;
}

export interface CustomerCallHistoryRow {
  customerId: string;
  name: string | null;
  phoneNumber: string;
  callCount: number;
  lastCallDate: string;
  totalBudget: number;
  latestCarMake: string | null;
  latestCarModel: string | null;
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
  location: string | null;
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
  id: string;
  number: string;
  exophoneNumber: string | null;
  whatsappPhoneNumberId: string | null;
  category: BusinessCategory;
  label: string;
}

export interface NumberCoverage {
  id: string;
  phoneNumber: string;
  employeeId: string;
  startHour: number | null;
  endHour: number | null;
  isBackup: boolean;
  createdAt: string;
  employee: Employee;
}

export type SaleSource = "call" | "whatsapp" | "walk_in" | "owner" | "unknown";

export type EnquiryOutcome = "purchased" | "not_purchased" | "undecided";

export interface Sale {
  id: string;
  customerPhone: string;
  customerId: string | null;
  carMake: string | null;
  carModel: string | null;
  branch: Branch;
  saleDate: string;
  source: SaleSource;
  matchedCallId: string | null;
  notes: string | null;
  enteredByUserId: string;
  createdAt: string;
  customer?: { id: string; name: string | null; phoneNumber: string } | Customer | null;
  matchedCall?: { id: string; callDate: string; businessCategory: BusinessCategory } | null;
  enteredBy?: { name: string } | null;
}

export interface InPersonEnquiry {
  id: string;
  customerPhone: string | null;
  customerId: string | null;
  customerName: string | null;
  carMake: string | null;
  carModel: string | null;
  branch: Branch;
  enquiryDate: string;
  outcome: EnquiryOutcome;
  notes: string | null;
  employeeId: string | null;
  enteredByUserId: string;
  createdAt: string;
  customer?: { id: string; name: string | null; phoneNumber: string } | Customer | null;
  employee?: Employee | null;
  enteredBy?: { name: string } | null;
}

export interface SaleMatchCall {
  id: string;
  callDate: string;
  businessCategory: BusinessCategory;
  employee: { name: string } | null;
  extraction: { sentiment: SentimentType | null; summary: string | null } | null;
}

export type SaleMatchResult =
  | { matched: false }
  | {
      matched: true;
      customer: {
        id: string;
        name: string | null;
        carMake: string | null;
        carModel: string | null;
        calls: SaleMatchCall[];
      };
    };

export interface SalesReminderStatus {
  afterCutoff: boolean;
  missingBranches: Branch[];
}

export type StockMovementType = "in" | "out";

export interface StockItemQuantity {
  branch: Branch;
  quantity: number;
  lowStock: boolean;
}

export interface StockItem {
  id: string;
  name: string;
  category: "car_glasses" | "car_modifications";
  unit: string;
  reorderThreshold: number;
  active: boolean;
  createdAt: string;
  quantities: StockItemQuantity[];
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  branch: Branch;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  movementDate: string;
  notes: string | null;
  enteredByUserId: string;
  createdAt: string;
  stockItem?: { id: string; name: string; category: BusinessCategory; unit: string } | null;
  enteredBy?: { name: string } | null;
}

export interface StockLowStockEntry {
  stockItemId: string;
  name: string;
  category: string;
  unit: string;
  branch: Branch;
  quantity: number;
  reorderThreshold: number;
}

export interface StockOverview {
  totalItems: number;
  lowStockCount: number;
  lowStockEntries: StockLowStockEntry[];
  totalsByCategory: { category: string; total: number }[];
}

export interface ConversionSummary {
  totalSales: number;
  salesBySource: { source: SaleSource; count: number }[];
  totalEnquiries: number;
  purchasedEnquiries: number;
  callToSaleRate: number | null;
  walkInToSaleRate: number | null;
}

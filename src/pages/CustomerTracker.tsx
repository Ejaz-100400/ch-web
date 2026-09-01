import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  ShieldAlert,
  TrendingUp,
  Users,
  Phone,
  MessageCircle,
  Store,
  HelpCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ClipboardList,
  Handshake,
  UserCog,
  User,
  UserCircle,
  UserPlus,
  Pencil,
  Camera,
  ThumbsUp,
  PlayCircle,
  Repeat2,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, MultiSelectFilter, ClearFiltersButton } from "../components/ui/FilterBar";
import { DateInput } from "../components/ui/DateInput";
import { SkeletonRows, Skeleton } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { api, ApiError, type CreateSaleInput, type CreateEnquiryInput } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { formatDate } from "../lib/format";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import type { Branch, ConversionSummary, Employee, EnquiryOutcome, InPersonEnquiry, Sale, SaleMatchResult, SaleSource } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const BRANCH_OPTIONS = (Object.keys(BRANCH_LABELS) as Branch[]).map((value) => ({ value, label: BRANCH_LABELS[value] }));

const SOURCE_LABELS: Record<SaleSource, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  walk_in: "Walk-in",
  owner: "Owner",
  dastagir: "Dastagir",
  karthik: "Karthik",
  referral: "Referral",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  regular_customer: "Regular Customer",
  unknown: "Unknown",
};
const SOURCE_ICONS: Record<SaleSource, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  walk_in: Store,
  owner: UserCog,
  dastagir: User,
  karthik: UserCircle,
  referral: UserPlus,
  instagram: Camera,
  facebook: ThumbsUp,
  youtube: PlayCircle,
  regular_customer: Repeat2,
  unknown: HelpCircle,
};
const SOURCE_OPTIONS = (Object.keys(SOURCE_LABELS) as SaleSource[]).map((value) => ({ value, label: SOURCE_LABELS[value] }));

const OUTCOME_LABELS: Record<EnquiryOutcome, string> = { purchased: "Purchased", not_purchased: "Not purchased", undecided: "Undecided" };
const OUTCOME_OPTIONS = (Object.keys(OUTCOME_LABELS) as EnquiryOutcome[]).map((value) => ({ value, label: OUTCOME_LABELS[value] }));

const PAGE_SIZE = 20;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CustomerTracker() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"sales" | "enquiries">("sales");
  const [branch, setBranch] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [summary, setSummary] = useState<ConversionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    let active = true;
    setSummaryLoading(true);
    api.sales
      .conversionSummary({ branch: branch.length ? (branch as Branch[]) : undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
      .then((res) => {
        if (active) setSummary(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load conversion summary", "error"))
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, dateFrom, dateTo, refreshKey]);

  function onEntrySaved() {
    setRefreshKey((k) => k + 1);
  }

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Customer Tracker" title="Customer tracker & conversion" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Customer tracker requires manager or admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  const callRate = summary?.callToSaleRate;
  const walkInRate = summary?.walkInToSaleRate;

  return (
    <div>
      <PageHeader
        eyebrow="Customer Tracker"
        title="Customer tracker & conversion"
        description="Daily sales entry and in-person enquiries, matched against call history to see what's actually converting."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
        <KpiCard icon={TrendingUp} label="Total sales" value={summary?.totalSales} tint="var(--brand)" loading={summaryLoading} />
        <KpiCard icon={Users} label="Total enquiries" value={summary?.totalEnquiries} tint="var(--violet)" loading={summaryLoading} />
        <KpiCard icon={Phone} label="Call → Sale rate" value={callRate != null ? `${callRate}%` : "—"} tint="var(--brand)" loading={summaryLoading} />
        <KpiCard icon={Store} label="Walk-in → Sale rate" value={walkInRate != null ? `${walkInRate}%` : "—"} tint="var(--violet)" loading={summaryLoading} />
      </div>

      {summary && summary.salesBySource.length > 0 && (
        <div style={{ ...cardStyle, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sales by source
          </span>
          {summary.salesBySource.map((s) => {
            const Icon = SOURCE_ICONS[s.source];
            return (
              <span key={s.source} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <Icon size={13} color="var(--text-soft)" />
                {SOURCE_LABELS[s.source]}
                <strong>{s.count}</strong>
              </span>
            );
          })}
        </div>
      )}

      <FilterBar>
        <MultiSelectFilter label="Branch" values={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
        <DateInput value={dateFrom} onChange={setDateFrom} aria-label="From date" style={filterDateStyle} />
        <DateInput value={dateTo} onChange={setDateTo} aria-label="To date" style={filterDateStyle} />
        {(branch.length > 0 || dateFrom || dateTo) && (
          <ClearFiltersButton
            onClick={() => {
              setBranch([]);
              setDateFrom("");
              setDateTo("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
        {(["sales", "enquiries"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "var(--brand)" : "transparent"}`,
              fontSize: 13.5,
              fontWeight: activeTab === tab ? 700 : 600,
              color: activeTab === tab ? "var(--text)" : "var(--text-soft)",
              cursor: "pointer",
            }}
          >
            {tab === "sales" ? <Handshake size={15} /> : <ClipboardList size={15} />}
            {tab === "sales" ? "Sales entry" : "In-person enquiry"}
          </button>
        ))}
      </div>

      {activeTab === "sales" ? (
        <SalesTab branch={branch as Branch[]} dateFrom={dateFrom} dateTo={dateTo} refreshKey={refreshKey} onSaved={onEntrySaved} />
      ) : (
        <EnquiriesTab branch={branch as Branch[]} dateFrom={dateFrom} dateTo={dateTo} refreshKey={refreshKey} employees={employees} onSaved={onEntrySaved} />
      )}
    </div>
  );
}

// ---------- Sales tab ----------

const EMPTY_SALE_FORM: CreateSaleInput = {
  customerPhone: "",
  carMake: "",
  carModel: "",
  branch: "ambattur",
  saleDate: todayIso(),
  source: "unknown",
  notes: "",
};

function SalesTab({
  branch,
  dateFrom,
  dateTo,
  refreshKey,
  onSaved,
}: {
  branch: Branch[];
  dateFrom: string;
  dateTo: string;
  refreshKey: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [source, setSource] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSaleInput>(EMPTY_SALE_FORM);
  const [sourceTouched, setSourceTouched] = useState(false);
  const [matchResult, setMatchResult] = useState<SaleMatchResult | null>(null);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [branch, dateFrom, dateTo, source, phone]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.sales
      .list({
        branch: branch.length ? branch : undefined,
        source: source.length ? (source as SaleSource[]) : undefined,
        phone: phone || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load sales", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, source, phone, dateFrom, dateTo, page, refreshKey]);

  // Debounced phone-match lookup for the add-entry form -- only runs once
  // the number looks plausible so it's not firing a request per keystroke.
  useEffect(() => {
    if (!formOpen) return;
    const phoneValue = form.customerPhone.trim();
    if (phoneValue.length < 6) {
      setMatchResult(null);
      return;
    }
    const t = setTimeout(() => {
      setMatching(true);
      api.sales
        .match(phoneValue)
        .then((res) => {
          setMatchResult(res);
          if (res.matched && !sourceTouched) {
            setForm((f) => ({
              ...f,
              source: "call",
              carMake: f.carMake || res.customer.carMake || "",
              carModel: f.carModel || res.customer.carModel || "",
            }));
          }
        })
        .catch(() => setMatchResult(null))
        .finally(() => setMatching(false));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customerPhone, formOpen]);

  function openForm() {
    setEditingId(null);
    setForm(EMPTY_SALE_FORM);
    setSourceTouched(false);
    setMatchResult(null);
    setFormOpen(true);
  }

  function openEdit(sale: Sale) {
    setEditingId(sale.id);
    setForm({
      customerPhone: sale.customerPhone,
      carMake: sale.carMake ?? "",
      carModel: sale.carModel ?? "",
      branch: sale.branch,
      saleDate: sale.saleDate.slice(0, 10),
      source: sale.source,
      notes: sale.notes ?? "",
    });
    // The phone-match effect would otherwise overwrite an already-set
    // source the moment it re-runs on open -- an edit's existing source was
    // a deliberate choice, not something a fresh match lookup should override.
    setSourceTouched(true);
    setMatchResult(null);
    setFormOpen(true);
  }

  async function handleSave() {
    const phoneValue = form.customerPhone.trim();
    if (!phoneValue) {
      toast.show("Customer phone number is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const dto = {
        customerPhone: phoneValue,
        carMake: form.carMake?.trim() || undefined,
        carModel: form.carModel?.trim() || undefined,
        branch: form.branch,
        saleDate: form.saleDate,
        source: form.source,
        matchedCallId: matchResult?.matched ? matchResult.customer.calls[0]?.id : undefined,
        notes: form.notes?.trim() || undefined,
      };
      if (editingId) {
        await api.sales.update(editingId, dto);
        toast.show("Sale updated.", "success");
      } else {
        await api.sales.create(dto);
        toast.show("Sale recorded.", "success");
      }
      setFormOpen(false);
      onSaved();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save sale", "error");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(source.length || phone);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        {!formOpen && (
          <button onClick={openForm} style={primaryButtonStyle}>
            <Plus size={15} /> Add sale
          </button>
        )}
      </div>

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{editingId ? "Edit sale" : "New sale"}</div>
            <button onClick={() => setFormOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              Customer phone
              <input
                style={inputStyle}
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="9xxxxxxxxx"
              />
            </label>
            <label style={fieldLabelStyle}>
              Sale date
              <DateInput value={form.saleDate} onChange={(v) => setForm((f) => ({ ...f, saleDate: v }))} style={inputStyle} />
            </label>
          </div>

          {matching && <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}><LoadingText label="Checking call history…" /></div>}

          {!matching && matchResult && (
            matchResult.matched ? (
              <div style={matchHintStyle}>
                <CheckCircle2 size={14} color="var(--brand-strong)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5 }}>
                  <strong>{matchResult.customer.name ?? "This number"}</strong> has called before — {matchResult.customer.calls.length} call
                  {matchResult.customer.calls.length === 1 ? "" : "s"} on record.
                  {matchResult.customer.calls[0] && (
                    <div style={{ color: "var(--text-soft)", marginTop: 2 }}>
                      Most recent: {formatDate(matchResult.customer.calls[0].callDate)} · {matchResult.customer.calls[0].employee?.name ?? "Unassigned"}
                      {matchResult.customer.calls[0].extraction?.summary ? ` — ${matchResult.customer.calls[0].extraction.summary}` : ""}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ ...matchHintStyle, background: "var(--border-soft)" }}>
                <HelpCircle size={14} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>No call history for this number — pick the source manually (WhatsApp or Walk-in).</span>
              </div>
            )
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              Car make
              <input style={inputStyle} value={form.carMake} onChange={(e) => setForm((f) => ({ ...f, carMake: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Car model
              <input style={inputStyle} value={form.carModel} onChange={(e) => setForm((f) => ({ ...f, carModel: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Branch
              <select style={inputStyle} value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}>
                {BRANCH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Source
              <select
                style={inputStyle}
                value={form.source}
                onChange={(e) => {
                  setSourceTouched(true);
                  setForm((f) => ({ ...f, source: e.target.value as SaleSource }));
                }}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
            Notes
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Record sale"}
            </button>
            <button onClick={() => setFormOpen(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <FilterBar>
        <SearchInput value={phone} onChange={setPhone} placeholder="Search phone number" />
        <MultiSelectFilter label="Source" values={source} onChange={setSource} options={SOURCE_OPTIONS} />
        {hasFilters && <ClearFiltersButton onClick={() => { setSource([]); setPhone(""); }} />}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} sale${total === 1 ? "" : "s"}`}
      </div>

      <div style={tableWrapStyle}>
        <div className="table-scroll">
          <div style={{ minWidth: 860 }}>
            <div className="mono" style={theadStyle("1fr 1.4fr 1.2fr 1fr 110px 1.2fr 40px")}>
              <span>Date</span>
              <span>Customer</span>
              <span>Vehicle</span>
              <span>Branch</span>
              <span>Source</span>
              <span>Entered by</span>
              <span></span>
            </div>

            {loading && <SkeletonRows rows={6} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {items.map((s) => {
                    const Icon = SOURCE_ICONS[s.source];
                    return (
                      <motion.div key={s.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle("1fr 1.4fr 1.2fr 1fr 110px 1.2fr 40px")}>
                        <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>{formatDate(s.saleDate)}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 600 }}>{s.customer && "name" in s.customer ? s.customer.name ?? s.customerPhone : s.customerPhone}</span>
                          <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11.5, marginLeft: 6 }}>{s.customerPhone}</span>
                        </span>
                        <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{[s.carMake, s.carModel].filter(Boolean).join(" ") || "—"}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{BRANCH_LABELS[s.branch]}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-soft)" }}>
                          <Icon size={13} /> {SOURCE_LABELS[s.source]}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{s.enteredBy?.name ?? "—"}</span>
                        <span>
                          <button onClick={() => openEdit(s)} aria-label="Edit sale" title="Edit" style={iconButtonStyle}>
                            <Pencil size={14} />
                          </button>
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && items.length === 0 && (
          <div style={emptyStateStyle}>
            <Handshake size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No sales match these filters</p>
            <p style={{ fontSize: 13 }}>Try different filters, or add today's sales.</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

// ---------- Enquiries tab ----------

const EMPTY_ENQUIRY_FORM: CreateEnquiryInput = {
  customerPhone: "",
  customerName: "",
  carMake: "",
  carModel: "",
  branch: "ambattur",
  enquiryDate: todayIso(),
  outcome: "undecided",
  notes: "",
  employeeId: "",
};

const OUTCOME_ICONS: Record<EnquiryOutcome, typeof CheckCircle2> = { purchased: CheckCircle2, not_purchased: XCircle, undecided: MinusCircle };
const OUTCOME_COLORS: Record<EnquiryOutcome, string> = { purchased: "var(--brand-strong)", not_purchased: "var(--coral)", undecided: "var(--text-faint)" };

function EnquiriesTab({
  branch,
  dateFrom,
  dateTo,
  refreshKey,
  employees,
  onSaved,
}: {
  branch: Branch[];
  dateFrom: string;
  dateTo: string;
  refreshKey: number;
  employees: Employee[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [outcome, setOutcome] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InPersonEnquiry[]>([]);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEnquiryInput>(EMPTY_ENQUIRY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [branch, dateFrom, dateTo, outcome, phone]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.enquiries
      .list({
        branch: branch.length ? branch : undefined,
        outcome: outcome.length ? (outcome as EnquiryOutcome[]) : undefined,
        phone: phone || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load enquiries", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, outcome, phone, dateFrom, dateTo, page, refreshKey]);

  function openForm() {
    setEditingId(null);
    setForm(EMPTY_ENQUIRY_FORM);
    setFormOpen(true);
  }

  function openEdit(enquiry: InPersonEnquiry) {
    setEditingId(enquiry.id);
    setForm({
      customerPhone: enquiry.customerPhone ?? "",
      customerName: enquiry.customerName ?? "",
      carMake: enquiry.carMake ?? "",
      carModel: enquiry.carModel ?? "",
      branch: enquiry.branch,
      enquiryDate: enquiry.enquiryDate.slice(0, 10),
      outcome: enquiry.outcome,
      notes: enquiry.notes ?? "",
      employeeId: enquiry.employeeId ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const dto = {
        customerPhone: form.customerPhone?.trim() || undefined,
        customerName: form.customerName?.trim() || undefined,
        carMake: form.carMake?.trim() || undefined,
        carModel: form.carModel?.trim() || undefined,
        branch: form.branch,
        enquiryDate: form.enquiryDate,
        outcome: form.outcome,
        notes: form.notes?.trim() || undefined,
        employeeId: form.employeeId || undefined,
      };
      if (editingId) {
        await api.enquiries.update(editingId, dto);
        toast.show("Enquiry updated.", "success");
      } else {
        await api.enquiries.create(dto);
        toast.show("Enquiry recorded.", "success");
      }
      setFormOpen(false);
      onSaved();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save enquiry", "error");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(outcome.length || phone);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        {!formOpen && (
          <button onClick={openForm} style={primaryButtonStyle}>
            <Plus size={15} /> Add enquiry
          </button>
        )}
      </div>

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{editingId ? "Edit in-person enquiry" : "New in-person enquiry"}</div>
            <button onClick={() => setFormOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              Customer name
              <input style={inputStyle} value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Customer phone <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
              <input style={inputStyle} value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="9xxxxxxxxx" />
            </label>
            <label style={fieldLabelStyle}>
              Car make
              <input style={inputStyle} value={form.carMake} onChange={(e) => setForm((f) => ({ ...f, carMake: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Car model
              <input style={inputStyle} value={form.carModel} onChange={(e) => setForm((f) => ({ ...f, carModel: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Branch
              <select style={inputStyle} value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}>
                {BRANCH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Date
              <DateInput value={form.enquiryDate} onChange={(v) => setForm((f) => ({ ...f, enquiryDate: v }))} style={inputStyle} />
            </label>
            <label style={fieldLabelStyle}>
              Did they buy?
              <select style={inputStyle} value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value as EnquiryOutcome }))}>
                {OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Spoke to <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
              <select style={inputStyle} value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
            Notes
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Record enquiry"}
            </button>
            <button onClick={() => setFormOpen(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <FilterBar>
        <SearchInput value={phone} onChange={setPhone} placeholder="Search phone number" />
        <MultiSelectFilter label="Outcome" values={outcome} onChange={setOutcome} options={OUTCOME_OPTIONS} />
        {hasFilters && <ClearFiltersButton onClick={() => { setOutcome([]); setPhone(""); }} />}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} enquir${total === 1 ? "y" : "ies"}`}
      </div>

      <div style={tableWrapStyle}>
        <div className="table-scroll">
          <div style={{ minWidth: 860 }}>
            <div className="mono" style={theadStyle("1fr 1.4fr 1.2fr 1fr 130px 1.2fr 40px")}>
              <span>Date</span>
              <span>Customer</span>
              <span>Vehicle</span>
              <span>Branch</span>
              <span>Outcome</span>
              <span>Entered by</span>
              <span></span>
            </div>

            {loading && <SkeletonRows rows={6} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {items.map((e) => {
                    const Icon = OUTCOME_ICONS[e.outcome];
                    return (
                      <motion.div key={e.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle("1fr 1.4fr 1.2fr 1fr 130px 1.2fr 40px")}>
                        <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>{formatDate(e.enquiryDate)}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 600 }}>{e.customerName ?? e.customerPhone ?? "Unnamed visitor"}</span>
                          {e.customerPhone && <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11.5, marginLeft: 6 }}>{e.customerPhone}</span>}
                        </span>
                        <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{[e.carMake, e.carModel].filter(Boolean).join(" ") || "—"}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{BRANCH_LABELS[e.branch]}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: OUTCOME_COLORS[e.outcome] }}>
                          <Icon size={13} /> {OUTCOME_LABELS[e.outcome]}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{e.enteredBy?.name ?? "—"}</span>
                        <span>
                          <button onClick={() => openEdit(e)} aria-label="Edit enquiry" title="Edit" style={iconButtonStyle}>
                            <Pencil size={14} />
                          </button>
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && items.length === 0 && (
          <div style={emptyStateStyle}>
            <ClipboardList size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No enquiries match these filters</p>
            <p style={{ fontSize: 13 }}>Try different filters, or log a walk-in.</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

// ---------- Shared bits ----------

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  loading,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: ReactNode;
  tint: string;
  loading: boolean;
}) {
  return (
    <div style={cardStyle} className="fade-in-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={tint} strokeWidth={2.2} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{label}</span>
      </div>
      {loading ? <Skeleton width={60} height={26} /> : <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{value ?? "—"}</div>}
    </div>
  );
}

function theadStyle(columns: string): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: columns,
    padding: "10px 18px",
    fontSize: 11,
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    color: "var(--text-faint)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border-soft)",
  };
}

function trowStyle(columns: string): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: columns,
    alignItems: "center",
    padding: "12px 18px",
    borderBottom: "1px solid var(--border-soft)",
    fontSize: 13,
  };
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 18,
  boxShadow: "var(--shadow-card)",
};

const tableWrapStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  overflow: "hidden",
  boxShadow: "var(--shadow-card)",
};

const emptyStateStyle: CSSProperties = { padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" };

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
  minWidth: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
  fontWeight: 400,
  fontFamily: "inherit",
};

const filterDateStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
};

const primaryButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 15px",
  background: "var(--brand)",
  color: "var(--on-brand)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "9px 15px",
  background: "var(--paper)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 600,
};

const iconButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  background: "none",
  border: "none",
  borderRadius: 6,
  color: "var(--text-soft)",
};

const matchHintStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
  background: "var(--brand-soft)",
  marginBottom: 0,
};

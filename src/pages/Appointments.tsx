import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck, CheckCircle2, HelpCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, MultiSelectFilter, ClearFiltersButton } from "../components/ui/FilterBar";
import { DateInput } from "../components/ui/DateInput";
import { SuggestInput } from "../components/ui/SuggestInput";
import { BranchBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { LoadingText } from "../components/ui/Spinner";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { formatDate, formatDateTime } from "../lib/format";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import { SOURCE_ICONS, SOURCE_LABELS, SOURCE_OPTIONS } from "../lib/sale-source";
import { istDateTimeToIso, isoToIstParts, relativeToAppointment, todayIstDate } from "../lib/appointment-time";
import type { Appointment, AppointmentStatus, Branch, Product, SaleMatchResult, SaleSource } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Velacherry",
  pondicherry: "Pondicherry",
};
const BRANCH_OPTIONS = (Object.keys(BRANCH_LABELS) as Branch[]).map((value) => ({ value, label: BRANCH_LABELS[value] }));

const STATUS_META: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Scheduled", color: "var(--violet)", bg: "var(--violet-soft)" },
  arrived: { label: "Arrived", color: "var(--amber)", bg: "var(--amber-soft)" },
  completed: { label: "Completed", color: "var(--success)", bg: "var(--success-soft)" },
  no_show: { label: "No-show", color: "var(--coral)", bg: "var(--coral-soft)" },
  cancelled: { label: "Cancelled", color: "var(--text-faint)", bg: "var(--border-soft)" },
};
const STATUS_ORDER = Object.keys(STATUS_META) as AppointmentStatus[];
const STATUS_OPTIONS = STATUS_ORDER.map((value) => ({ value, label: STATUS_META[value].label }));

const PAGE_SIZE = 20;

interface FormState {
  customerName: string;
  customerPhone: string;
  carMake: string;
  carModel: string;
  branch: Branch;
  productIds: string[];
  source: SaleSource;
  date: string;
  time: string;
}

function emptyForm(): FormState {
  return { customerName: "", customerPhone: "", carMake: "", carModel: "", branch: "ambattur", productIds: [], source: "call", date: todayIstDate(), time: "" };
}

export default function Appointments() {
  const { appUser } = useAuth();
  const toast = useToast();
  const manager = canManage(appUser?.role);

  // "Upcoming" is the working view (what's coming today and after, soonest
  // first); "All" is the full history with every filter.
  const [view, setView] = useState<"upcoming" | "all">("upcoming");
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  // Ticks so "in 40 min" / "15 min late" stay current without a refetch.
  const [now, setNow] = useState(() => Date.now());

  const [products, setProducts] = useState<Product[]>([]);
  const [knownCarMakes, setKnownCarMakes] = useState<string[]>([]);
  const [knownCarModels, setKnownCarModels] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<SaleMatchResult | null>(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    api.products.list("car_modifications").then(setProducts).catch(() => setProducts([]));
    api.calls.carMakes().then(setKnownCarMakes).catch(() => setKnownCarMakes([]));
    api.calls.carModels().then(setKnownCarModels).catch(() => setKnownCarModels([]));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Light upgrades are Car Modifications products -- the same catalog the
  // calls' "products discussed" link to.
  const productOptions = useMemo(() => products.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name })), [products]);

  useEffect(() => {
    setPage(1);
  }, [view, search, branch, status, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(
      () => {
        api.appointments
          .list({
            search: search || undefined,
            branch: branch.length ? (branch as Branch[]) : undefined,
            ...(view === "upcoming"
              ? { status: ["scheduled", "arrived"] as AppointmentStatus[], dateFrom: todayIstDate(), order: "asc" as const }
              : {
                  status: status.length ? (status as AppointmentStatus[]) : undefined,
                  dateFrom: dateFrom || undefined,
                  dateTo: dateTo || undefined,
                  order: "desc" as const,
                }),
            page,
            pageSize: PAGE_SIZE,
          })
          .then((res) => {
            if (!active) return;
            setItems(res.items);
            setTotal(res.total);
          })
          .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load appointments", "error"))
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      search ? 300 : 0,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search, branch, status, dateFrom, dateTo, page, refreshKey]);

  // Same debounced call-history lookup the Customer Tracker's sales form
  // does -- once the number looks plausible, say whether they've called
  // before, and fill in any of name/make/model still left blank from what
  // we already know (never overwriting something already typed).
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
          if (res.matched) {
            setForm((f) => ({
              ...f,
              customerName: f.customerName || res.customer.name || "",
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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(a: Appointment) {
    const { date, time } = isoToIstParts(a.appointmentAt);
    setEditing(a);
    setForm({
      customerName: a.customerName,
      customerPhone: a.customerPhone ?? "",
      carMake: a.carMake ?? "",
      carModel: a.carModel ?? "",
      branch: a.branch,
      productIds: a.products.map((p) => p.id),
      source: a.source,
      date,
      time,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  // Name, date and time are required -- the button below stays disabled until
  // all three are filled, so a booking can't be submitted without a time (and
  // there's no error to show after the fact).
  const canSubmit = Boolean(form.customerName.trim() && form.date && form.time);

  async function handleSave() {
    if (!canSubmit) return;
    const dto = {
      customerName: form.customerName.trim(),
      // Sent even when empty so clearing a number on edit reaches the server.
      customerPhone: form.customerPhone.trim(),
      carMake: form.carMake.trim(),
      carModel: form.carModel.trim(),
      branch: form.branch,
      source: form.source,
      appointmentAt: istDateTimeToIso(form.date, form.time),
      productIds: form.productIds,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.appointments.update(editing.id, dto);
        toast.show("Appointment updated.", "success");
      } else {
        await api.appointments.create(dto);
        toast.show("Appointment booked.", "success");
      }
      closeForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save appointment", "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(a: Appointment, next: AppointmentStatus) {
    setBusyId(a.id);
    try {
      await api.appointments.update(a.id, { status: next });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to update status", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(a: Appointment) {
    if (!window.confirm(`Delete the appointment for ${a.customerName}? This can't be undone.`)) return;
    setBusyId(a.id);
    try {
      await api.appointments.remove(a.id);
      toast.show("Appointment deleted.", "success");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete appointment", "error");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || branch.length || (view === "all" && (status.length || dateFrom || dateTo)));

  return (
    <div>
      <PageHeader
        eyebrow="Appointments"
        title="Appointment status"
        description="Customers booked in to come to a branch for a light upgrade -- you'll get an alert an hour before each one."
        actions={
          manager && !formOpen ? (
            <button onClick={openCreate} style={primaryButtonStyle}>
              <Plus size={15} /> Book appointment
            </button>
          ) : undefined
        }
      />

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit appointment" : "Book an appointment"}</div>
            <button onClick={closeForm} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              <span>Customer name <RequiredMark /></span>
              <input style={inputStyle} value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Ravi Kumar" />
            </label>
            <label style={fieldLabelStyle}>
              Phone number
              <input style={inputStyle} value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="9xxxxxxxxx" />
            </label>
            <label style={fieldLabelStyle}>
              Car make
              <SuggestInput style={inputStyle} value={form.carMake} onChange={(v) => setForm((f) => ({ ...f, carMake: v }))} options={knownCarMakes} placeholder="Pick or type a make" />
            </label>
            <label style={fieldLabelStyle}>
              Car model
              <SuggestInput style={inputStyle} value={form.carModel} onChange={(v) => setForm((f) => ({ ...f, carModel: v }))} options={knownCarModels} placeholder="Pick or type a model" />
            </label>
          </div>

          {matching && (
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>
              <LoadingText label="Checking call history…" />
            </div>
          )}
          {!matching && matchResult && (
            <div style={{ ...matchHintStyle, background: matchResult.matched ? "var(--brand-soft)" : "var(--border-soft)" }}>
              {matchResult.matched ? (
                <CheckCircle2 size={14} color="var(--brand-strong)" style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <HelpCircle size={14} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <span style={{ fontSize: 12.5, color: matchResult.matched ? "var(--text)" : "var(--text-soft)" }}>
                {matchResult.matched ? (
                  <>
                    <strong>{matchResult.customer.name ?? "This number"}</strong> has called before -- {matchResult.customer.calls.length} call
                    {matchResult.customer.calls.length === 1 ? "" : "s"} on record
                    {matchResult.customer.calls[0] ? ` (most recent ${formatDate(matchResult.customer.calls[0].callDate)})` : ""}.
                  </>
                ) : (
                  "No call history for this number yet."
                )}
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              Branch
              <select style={inputStyle} value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}>
                {BRANCH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div style={fieldLabelStyle}>
              Light upgrade
              <MultiSelectFilter
                label={form.productIds.length ? `${form.productIds.length} selected` : "Select light upgrade(s)"}
                values={form.productIds}
                onChange={(v) => setForm((f) => ({ ...f, productIds: v }))}
                options={productOptions}
                triggerStyle={{ width: "100%", justifyContent: "space-between", padding: "8px 10px", fontSize: 13 }}
              />
            </div>
            <label style={fieldLabelStyle}>
              Source
              <select style={inputStyle} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as SaleSource }))}>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {form.productIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {form.productIds.map((id) => (
                <span key={id} style={productChipStyle}>
                  {products.find((p) => p.id === id)?.name ?? "Unknown product"}
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setForm((f) => ({ ...f, productIds: f.productIds.filter((x) => x !== id) }))}
                    style={{ background: "none", border: "none", padding: 0, display: "flex", color: "inherit", cursor: "pointer" }}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
            <label style={fieldLabelStyle}>
              <span>Appointment date <RequiredMark /></span>
              <DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} style={inputStyle} />
            </label>
            <label style={fieldLabelStyle}>
              <span>Appointment time <RequiredMark /></span>
              <input type="time" required style={{ ...inputStyle, borderColor: form.time ? "var(--border)" : "var(--brand)" }} value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={saving || !canSubmit}
              style={{ ...primaryButtonStyle, opacity: saving || !canSubmit ? 0.55 : 1, cursor: saving || !canSubmit ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Book appointment"}
            </button>
            <button onClick={closeForm} style={secondaryButtonStyle}>
              Cancel
            </button>
            {!canSubmit && !saving && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Add the customer name, date and time to continue.</span>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["upcoming", "all"] as const).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "7px 14px",
                border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--brand-soft)" : "var(--paper)",
                color: active ? "var(--brand-strong)" : "var(--text-soft)",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
              }}
            >
              {v === "upcoming" ? "Upcoming" : "All appointments"}
            </button>
          );
        })}
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customer name or phone" />
        <MultiSelectFilter label="Branch" values={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
        {view === "all" && (
          <>
            <MultiSelectFilter label="Status" values={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <DateInput value={dateFrom} onChange={setDateFrom} aria-label="From date" style={filterDateStyle} />
            <DateInput value={dateTo} onChange={setDateTo} aria-label="To date" style={filterDateStyle} />
          </>
        )}
        {hasFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setBranch([]);
              setStatus([]);
              setDateFrom("");
              setDateTo("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} appointment${total === 1 ? "" : "s"}`}
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 980 }}>
            <div className="mono" style={theadStyle}>
              <span>When</span>
              <span>Customer</span>
              <span>Branch</span>
              <span>Light upgrade</span>
              <span>Source</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={5} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {items.map((a) => {
                    const SourceIcon = SOURCE_ICONS[a.source];
                    const meta = STATUS_META[a.status];
                    const countdown = a.status === "scheduled" ? relativeToAppointment(a.appointmentAt, now) : null;
                    return (
                      <motion.div key={a.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle}>
                        <span>
                          <div style={{ fontWeight: 600 }}>{formatDateTime(a.appointmentAt)}</div>
                          {countdown && (
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: countdown.overdue ? "var(--coral)" : countdown.soon ? "var(--amber)" : "var(--text-faint)" }}>
                              {countdown.label}
                            </div>
                          )}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.customerId ? (
                              <Link to={`/customers/${a.customerId}`} title="View customer and call history" style={{ color: "inherit", textDecoration: "none" }}>
                                {a.customerName}
                              </Link>
                            ) : (
                              a.customerName
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                            {[[a.carMake, a.carModel].filter(Boolean).join(" "), a.customerPhone].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </span>
                        <span><BranchBadge branch={a.branch} /></span>
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {a.products.length > 0 ? a.products.map((p) => <span key={p.id} style={productChipStyle}>{p.name}</span>) : <span style={{ color: "var(--text-faint)" }}>—</span>}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-soft)", fontSize: 12.5 }}>
                          <SourceIcon size={13} /> {SOURCE_LABELS[a.source]}
                        </span>
                        <span>
                          {manager ? (
                            <select
                              value={a.status}
                              disabled={busyId === a.id}
                              onChange={(e) => changeStatus(a, e.target.value as AppointmentStatus)}
                              aria-label="Change status"
                              style={{ padding: "4px 8px", border: "none", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                            >
                              {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ padding: "3px 9px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700 }}>{meta.label}</span>
                          )}
                        </span>
                        <span style={{ display: "flex", gap: 4 }}>
                          {manager && (
                            <>
                              <button onClick={() => openEdit(a)} aria-label={`Edit appointment for ${a.customerName}`} title="Edit" style={iconButtonStyle}>
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(a)}
                                disabled={busyId === a.id}
                                aria-label={`Delete appointment for ${a.customerName}`}
                                title="Delete"
                                style={{ ...iconButtonStyle, color: "var(--coral)" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
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
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <CalendarCheck size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>
              {view === "upcoming" ? "Nothing coming up" : "No appointments match these filters"}
            </p>
            <p style={{ fontSize: 13 }}>{manager ? "Book one to start tracking customers coming in." : "Appointments booked by your team will show up here."}</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

const gridColumns = "170px 1.2fr 1fr 1.5fr 1fr 130px 76px";

const theadStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: gridColumns,
  padding: "10px 18px",
  fontSize: 11,
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  color: "var(--text-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border-soft)",
};

const trowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: gridColumns,
  alignItems: "center",
  gap: 8,
  padding: "12px 18px",
  borderBottom: "1px solid var(--border-soft)",
  fontSize: 13,
};

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
  fontFamily: "inherit",
};

const filterDateStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
};

function RequiredMark() {
  return (
    <span aria-hidden="true" title="Required" style={{ color: "var(--coral)", fontWeight: 700 }}>
      *
    </span>
  );
}

const matchHintStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "9px 12px",
  borderRadius: "var(--radius-sm)",
  marginBottom: 12,
};

const productChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 8px",
  borderRadius: 999,
  background: "var(--violet-soft)",
  color: "var(--violet)",
  fontSize: 11.5,
  fontWeight: 700,
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
  cursor: "pointer",
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

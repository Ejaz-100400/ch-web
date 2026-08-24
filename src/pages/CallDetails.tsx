import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Trash2,
  Pencil,
  Save,
  X,
  FileAudio,
  Car,
  Wallet,
  CalendarClock,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { CallStatusBadge, SentimentBadge, ImportedBadge, BranchBadge } from "../components/ui/StatusBadge";
import { Avatar } from "../components/ui/Avatar";
import { Skeleton } from "../components/ui/Skeleton";
import { Spinner } from "../components/ui/Spinner";
import { DateInput } from "../components/ui/DateInput";
import { MultiSelectFilter } from "../components/ui/FilterBar";
import { SuggestInput } from "../components/ui/SuggestInput";
import { AudioPlayer } from "../components/ui/AudioPlayer";
import { api, ApiError, type UpdateCallInput, type UpdateExtractionInput } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { formatCurrency, formatDateTime, formatDuration } from "../lib/format";
import type { Branch, BusinessCategory, Call, Employee, Product, SentimentType } from "../types";

const SENTIMENT_OPTIONS: { value: SentimentType; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

const CATEGORY_OPTIONS: { value: BusinessCategory; label: string }[] = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

const BRANCH_OPTIONS: { value: Branch; label: string }[] = [
  { value: "ambattur", label: "Ambattur (HQ)" },
  { value: "kattankulathur", label: "Kattankulathur" },
  { value: "sithalapakkam", label: "Sithalapakkam" },
  { value: "pondicherry", label: "Pondicherry" },
];

export default function CallDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { appUser } = useAuth();

  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateExtractionInput>({});
  const [category, setCategory] = useState<BusinessCategory>("unknown");
  const [callDate, setCallDate] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [branch, setBranch] = useState<Branch | "">("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [knownCarMakes, setKnownCarMakes] = useState<string[]>([]);
  const [knownCarModels, setKnownCarModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<"reprocess" | "summary" | "delete" | null>(null);
  const [customerCalls, setCustomerCalls] = useState<Call[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
    api.products.list().then(setProducts).catch(() => setProducts([]));
    api.calls.carMakes().then(setKnownCarMakes).catch(() => setKnownCarMakes([]));
    api.calls.carModels().then(setKnownCarModels).catch(() => setKnownCarModels([]));
  }, []);

  async function load(silent = false) {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.calls.get(id);
      setCall(data);
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else toast.show(err instanceof ApiError ? err.message : "Failed to load call", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Powers the call-tracking timeline -- the full history of this customer's
  // other calls, so it can show where the call currently open falls among
  // them (see CallTrackingTimeline below).
  useEffect(() => {
    if (!call?.customerId) {
      setCustomerCalls([]);
      return;
    }
    let active = true;
    api.customers
      .calls(call.customerId)
      .then((res) => {
        if (active) setCustomerCalls(res);
      })
      .catch(() => {
        if (active) setCustomerCalls([]);
      });
    return () => {
      active = false;
    };
  }, [call?.customerId]);

  // Auto-refresh while the worker is still processing this call.
  useEffect(() => {
    if (call && (call.status === "pending" || call.status === "processing")) {
      pollRef.current = setInterval(() => load(true), 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.status]);

  function startEdit() {
    if (!call) return;
    // Calls with no extraction yet (missed/unanswered, or the AI pipeline
    // hasn't run) start from a blank form -- the backend upserts on save,
    // so there's no need for one to already exist before it can be edited.
    const e = call.extraction ?? {
      customerName: null,
      carMake: null,
      carModel: null,
      carVariant: null,
      location: null,
      productsDiscussed: [],
      customerRequirements: null,
      budget: null,
      followUpRequired: false,
      followUpDate: null,
      summary: null,
      sentiment: null,
    };
    setForm({
      customerName: e.customerName ?? undefined,
      carMake: e.carMake ?? undefined,
      carModel: e.carModel ?? undefined,
      carVariant: e.carVariant ?? undefined,
      location: e.location ?? undefined,
      productsDiscussed: e.productsDiscussed ?? [],
      customerRequirements: e.customerRequirements ?? undefined,
      // budget is a Postgres Decimal -- Prisma serializes those as a JSON
      // string (e.g. "13.00"), not a number, so this has to convert it
      // explicitly or an untouched budget gets sent back as a string and
      // fails the backend's @IsNumber() validation.
      budget: e.budget != null ? Number(e.budget) : undefined,
      followUpRequired: e.followUpRequired,
      followUpDate: e.followUpDate ? e.followUpDate.slice(0, 10) : undefined,
      summary: e.summary ?? undefined,
      sentiment: e.sentiment ?? undefined,
    });
    setCategory(call.businessCategory);
    setCallDate(call.callDate.slice(0, 10));
    setEmployeeId(call.employeeId ?? "");
    setBranch(call.branch ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    if (!id || !call) return;
    setSaving(true);
    try {
      if (isAdmin) {
        // The date input only edits the day -- keep the original time-of-day
        // rather than silently collapsing it to midnight.
        const original = new Date(call.callDate);
        const [year, month, day] = callDate.split("-").map(Number);
        original.setFullYear(year, month - 1, day);
        const callDto: UpdateCallInput = { businessCategory: category, callDate: original.toISOString(), employeeId, branch };
        await api.calls.update(id, callDto);
      }
      await api.calls.updateExtraction(id, form);
      toast.show("Call updated.", "success");
      setEditing(false);
      await load(true);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReprocess() {
    if (!id) return;
    setActionPending("reprocess");
    try {
      await api.calls.reprocess(id);
      toast.show("Reprocessing queued.", "success");
      await load(true);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to queue reprocessing", "error");
    } finally {
      setActionPending(null);
    }
  }

  async function handleRegenerateSummary() {
    if (!id) return;
    setActionPending("summary");
    try {
      await api.calls.regenerateSummary(id);
      toast.show("Summary regeneration queued.", "success");
      await load(true);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to queue summary regeneration", "error");
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm("Delete this call permanently? This cannot be undone.")) return;
    setActionPending("delete");
    try {
      await api.calls.remove(id);
      toast.show("Call deleted.", "success");
      navigate("/calls");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete call", "error");
      setActionPending(null);
    }
  }

  if (notFound) {
    return (
      <div>
        <button onClick={() => navigate("/calls")} style={backLinkStyle}>
          <ArrowLeft size={15} /> Back to calls
        </button>
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-faint)" }}>
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Call not found</p>
          <p style={{ fontSize: 13 }}>It may have been deleted, or the link is out of date.</p>
        </div>
      </div>
    );
  }

  if (loading || !call) {
    return (
      <div>
        <Skeleton width={120} height={16} />
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          <div style={cardStyle}>
            <Skeleton height={80} />
          </div>
          <div style={cardStyle}>
            <Skeleton height={160} />
          </div>
        </div>
      </div>
    );
  }

  const canEdit = canManage(appUser?.role);
  const isAdmin = appUser?.role === "admin";
  const e = call.extraction;
  const isImported = e?.extractedByModel === "manual_import";

  return (
    <div>
      <button onClick={() => navigate("/calls")} style={backLinkStyle}>
        <ArrowLeft size={15} /> Back to calls
      </button>

      <PageHeader
        eyebrow={
          (call.businessCategory === "car_glasses" ? "Car Glasses enquiry" : "Car Modifications enquiry") +
          (call.direction === "outbound" ? " · Outbound call" : "")
        }
        title={call.customer?.name ?? e?.customerName ?? "Unknown caller"}
        description={`${call.customer?.phoneNumber ?? e?.phoneNumber ?? "Unknown number"} · ${formatDateTime(call.callDate)}`}
        alignActions="flex-start"
        actions={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {customerCalls.length > 0 && <CallTrackingTimeline calls={customerCalls} activeCallId={call.id} />}
            <div style={{ display: "flex", gap: 8 }}>
              {canEdit && (
                <button onClick={handleReprocess} disabled={actionPending !== null} style={secondaryButtonStyle}>
                  {actionPending === "reprocess" ? <Spinner size={14} /> : <RefreshCw size={14} />} Reprocess
                </button>
              )}
              {canEdit && call.transcript && (
                <button onClick={handleRegenerateSummary} disabled={actionPending !== null} style={secondaryButtonStyle}>
                  <Sparkles size={14} /> Regenerate summary
                </button>
              )}
              {isAdmin && (
                <button onClick={handleDelete} disabled={actionPending !== null} style={{ ...secondaryButtonStyle, color: "var(--coral)", borderColor: "var(--coral)" }}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        }
      />

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left: metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={cardStyle}>
            <SectionLabel>Customer</SectionLabel>
            {call.customer ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <Avatar name={call.customer.name ?? call.customer.phoneNumber} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{call.customer.name ?? "Unnamed caller"}</div>
                    <div className="mono" style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{call.customer.phoneNumber}</div>
                  </div>
                </div>
                {call.customer.notes && <p style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: 6 }}>{call.customer.notes}</p>}
                <Link to="/customers" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand-strong)", display: "inline-block", marginTop: 10 }}>
                  View customer directory →
                </Link>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
                No matching customer record{e?.phoneNumber ? ` for ${e.phoneNumber}` : ""}.
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <SectionLabel>Call summary</SectionLabel>
            <Row label="Status">
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CallStatusBadge status={call.status} />
                {isImported && <ImportedBadge importedByName={call.importedBy?.name} />}
              </span>
            </Row>
            {call.status === "failed" && call.failureReason && (
              <div style={{ background: "var(--coral-soft)", color: "var(--coral)", fontSize: 12, padding: "8px 10px", borderRadius: "var(--radius-sm)", marginTop: 8 }}>
                {call.failureReason}
              </div>
            )}
            <Row label="Employee">
              <span style={{ fontSize: 13 }}>{call.employee?.name ?? "Unassigned"}</span>
            </Row>
            <Row label="Branch">
              {call.branch ? <BranchBadge branch={call.branch} /> : <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Not set</span>}
            </Row>
            <Row label="Duration">
              <span className="mono" style={{ fontSize: 12.5 }}>{formatDuration(call.durationSeconds)}</span>
            </Row>
          </div>

          <div style={cardStyle}>
            <SectionLabel>Recording</SectionLabel>
            {call.recordingStorageKey ? (
              <RecordingPlayer callId={call.id} />
            ) : isImported ? (
              <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                No recording — this call was added from a historical data import
                {call.importedBy?.name ? ` by ${call.importedBy.name}` : ""}, not the live call pipeline.
              </p>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No recording stored for this call yet.</p>
            )}
          </div>
        </div>

        {/* Right: transcript + extraction */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={cardStyle}>
            <SectionLabel>Transcript</SectionLabel>
            {call.transcript ? (
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text)", whiteSpace: "pre-wrap" }}>{call.transcript.rawText}</p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
                No transcript yet — this call is {call.status}.
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionLabelInline>AI extraction</SectionLabelInline>
              {canEdit && !editing && (
                <button onClick={startEdit} style={iconButtonStyle}>
                  <Pencil size={13} /> Edit
                </button>
              )}
              {editing && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={saveEdit} disabled={saving} style={{ ...iconButtonStyle, background: "var(--brand)", color: "var(--on-brand)", borderColor: "var(--brand)" }}>
                    <Save size={13} /> {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(false)} style={iconButtonStyle}>
                    <X size={13} /> Cancel
                  </button>
                </div>
              )}
            </div>

            {!e && !editing && (
              <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
                No extraction yet — it will appear here once processing completes, or click Edit to fill it in by hand.
              </p>
            )}

            {e && !editing && (() => {
              const missing = [
                !e.customerName && "the customer's name",
                !(e.carMake || e.carModel) && "their car model",
                !e.productsDiscussed?.length && "which product(s) they asked about",
              ].filter(Boolean) as string[];
              if (missing.length === 0) return null;
              return (
                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "flex-start",
                    background: "var(--amber-soft)",
                    border: "1px solid var(--amber)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 12px",
                    marginBottom: 14,
                  }}
                >
                  <AlertTriangle size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)" }}>
                    <strong>Before you move on:</strong> confirm {missing.join(", ")} with the customer and add it via Edit —
                    the next teammate to speak with them relies on this.
                  </p>
                </div>
              );
            })()}

            {e && !editing && (
              <div className="fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(e.carMake || e.carModel || e.carVariant) && (
                    <InfoPill icon={Car} text={[e.carMake, e.carModel, e.carVariant].filter(Boolean).join(" ")} />
                  )}
                  {e.location && <InfoPill icon={MapPin} text={e.location} />}
                  {e.budget != null && <InfoPill icon={Wallet} text={formatCurrency(e.budget)} />}
                  {e.followUpRequired && (
                    <InfoPill icon={CalendarClock} text={e.followUpDate ? `Follow up by ${e.followUpDate.slice(0, 10)}` : "Follow-up required"} />
                  )}
                  {e.sentiment && <SentimentBadge sentiment={e.sentiment} />}
                </div>

                {e.summary && (
                  <div>
                    <SectionLabel>Summary</SectionLabel>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{e.summary}</p>
                  </div>
                )}

                {e.customerRequirements && (
                  <div>
                    <SectionLabel>Customer requirements</SectionLabel>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-soft)" }}>{e.customerRequirements}</p>
                  </div>
                )}

                {e.productsDiscussed.length > 0 && (
                  <div>
                    <SectionLabel>Products discussed</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {e.productsDiscussed.map((p, i) => (
                        <span key={i} style={chipStyle}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11.5, color: "var(--text-faint)", borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
                  {e.extractedByModel && e.extractedAt && `Extracted by ${e.extractedByModel} on ${formatDateTime(e.extractedAt)}`}
                  {e.editedAt && ` · Edited ${formatDateTime(e.editedAt)}`}
                </div>
              </div>
            )}

            {editing && (
              <div className="fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <FormRow label="Category">
                      <select style={inputStyle} value={category} onChange={(ev) => setCategory(ev.target.value as BusinessCategory)}>
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Call date">
                      <DateInput style={inputStyle} value={callDate} onChange={setCallDate} />
                    </FormRow>
                    <FormRow label="Employee">
                      <select style={inputStyle} value={employeeId} onChange={(ev) => setEmployeeId(ev.target.value)}>
                        <option value="">Unassigned</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Branch">
                      <select style={inputStyle} value={branch} onChange={(ev) => setBranch(ev.target.value as Branch | "")}>
                        <option value="">Not set</option>
                        {BRANCH_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </FormRow>
                  </div>
                )}
                <FormRow label="Customer name">
                  <input style={inputStyle} value={form.customerName ?? ""} onChange={(ev) => setForm((f) => ({ ...f, customerName: ev.target.value }))} />
                </FormRow>
                <div style={{ display: "flex", gap: 10 }}>
                  <FormRow label="Car make">
                    <SuggestInput
                      style={inputStyle}
                      value={form.carMake ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, carMake: v }))}
                      options={knownCarMakes}
                      placeholder="Pick or type a new make"
                    />
                  </FormRow>
                  <FormRow label="Car model">
                    <SuggestInput
                      style={inputStyle}
                      value={form.carModel ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, carModel: v }))}
                      options={knownCarModels}
                      placeholder="Pick or type a new model"
                    />
                  </FormRow>
                  <FormRow label="Variant">
                    <input style={inputStyle} value={form.carVariant ?? ""} onChange={(ev) => setForm((f) => ({ ...f, carVariant: ev.target.value }))} />
                  </FormRow>
                  <FormRow label="Location">
                    <input style={inputStyle} value={form.location ?? ""} onChange={(ev) => setForm((f) => ({ ...f, location: ev.target.value }))} />
                  </FormRow>
                </div>
                <FormRow label="Products discussed">
                  <MultiSelectFilter
                    label="Select products"
                    values={form.productsDiscussed ?? []}
                    onChange={(v) => setForm((f) => ({ ...f, productsDiscussed: v }))}
                    options={products
                      .filter((p) => p.category === category)
                      .map((p) => ({ value: p.name, label: p.name }))}
                    triggerStyle={{ width: "100%" }}
                  />
                </FormRow>
                <FormRow label="Customer requirements">
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.customerRequirements ?? ""} onChange={(ev) => setForm((f) => ({ ...f, customerRequirements: ev.target.value }))} />
                </FormRow>
                <div style={{ display: "flex", gap: 10 }}>
                  <FormRow label="Budget (₹)">
                    <input
                      type="number"
                      style={inputStyle}
                      value={form.budget ?? ""}
                      onChange={(ev) => setForm((f) => ({ ...f, budget: ev.target.value ? Number(ev.target.value) : undefined }))}
                    />
                  </FormRow>
                  <FormRow label="Sentiment">
                    <select style={inputStyle} value={form.sentiment ?? ""} onChange={(ev) => setForm((f) => ({ ...f, sentiment: (ev.target.value || undefined) as SentimentType | undefined }))}>
                      <option value="">—</option>
                      {SENTIMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FormRow>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)", paddingBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.followUpRequired ?? false}
                      onChange={(ev) => setForm((f) => ({ ...f, followUpRequired: ev.target.checked }))}
                      style={{ accentColor: "var(--brand)" }}
                    />
                    Follow-up required
                  </label>
                  <FormRow label="Follow-up date">
                    <DateInput
                      style={inputStyle}
                      value={form.followUpDate ?? ""}
                      onChange={(value) => setForm((f) => ({ ...f, followUpDate: value || undefined }))}
                      disabled={!form.followUpRequired}
                    />
                  </FormRow>
                </div>
                <FormRow label="Summary">
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.summary ?? ""} onChange={(ev) => setForm((f) => ({ ...f, summary: ev.target.value }))} />
                </FormRow>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TIMELINE_ITEM_WIDTH = 148;
const TIMELINE_CONNECTOR_WIDTH = 28;

function timelineSentimentColor(call: Call): string {
  const sentiment = call.extraction?.sentiment;
  if (sentiment === "interested") return "var(--success)";
  if (sentiment === "needs_follow_up") return "var(--amber)";
  if (sentiment === "not_interested") return "var(--coral)";
  return "var(--border)";
}

/**
 * Horizontal call-history tracker for this customer, styled after a package-
 * tracking timeline -- oldest call on the left, newest on the right, the
 * call currently open highlighted. Fixed to 3 visible items; more scroll
 * into view rather than shrinking, and the active call auto-scrolls into
 * view on load in case it isn't one of the first 3.
 */
function CallTrackingTimeline({ calls, activeCallId }: { calls: Call[]; activeCallId: string }) {
  const sorted = [...calls].sort((a, b) => new Date(a.callDate).getTime() - new Date(b.callDate).getTime());
  const activeIndex = sorted.findIndex((c) => c.id === activeCallId);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeCallId]);

  return (
    <div
      style={{
        background: "var(--paper-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px 8px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Call history{activeIndex >= 0 && ` · ${activeIndex + 1} of ${sorted.length}`}
      </div>
      <div style={{ display: "flex", overflowX: "auto", width: TIMELINE_ITEM_WIDTH * 3 + TIMELINE_CONNECTOR_WIDTH * 2, paddingBottom: 4 }}>
        {sorted.map((c, i) => {
          const isActive = c.id === activeCallId;
          const color = timelineSentimentColor(c);
          const vehicle = [c.extraction?.carMake, c.extraction?.carModel].filter(Boolean).join(" ");
          const product = c.extraction?.productsDiscussed?.[0];
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
              {i > 0 && (
                <div style={{ width: TIMELINE_CONNECTOR_WIDTH, height: 2, background: timelineSentimentColor(sorted[i - 1]), marginTop: 7, flexShrink: 0 }} />
              )}
              <Link
                ref={isActive ? activeItemRef : undefined}
                to={`/calls/${c.id}`}
                style={{
                  width: TIMELINE_ITEM_WIDTH,
                  flexShrink: 0,
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  padding: "5px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--brand-soft)" : "transparent",
                  border: `1px solid ${isActive ? "var(--brand)" : "transparent"}`,
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: isActive ? 13 : 10,
                    height: isActive ? 13 : 10,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: isActive ? `0 0 0 2px color-mix(in srgb, ${color} 35%, transparent)` : "none",
                    marginBottom: 6,
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.employee?.name ?? "Unassigned"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {vehicle || product || "—"}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{formatDateTime(c.callDate)}</div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecordingPlayer({ callId }: { callId: string }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    api.calls
      .recording(callId)
      .then((res) => {
        if (active) setUrl(res.url);
      })
      .catch((err) => {
        if (!active) return;
        setError(true);
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.show(err instanceof ApiError ? err.message : "Failed to load recording", "error");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  if (loading) return <Skeleton height={84} />;

  if (error || !url) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-faint)" }}>
        <FileAudio size={16} />
        <span>Recording is stored but couldn't be loaded right now.</span>
      </div>
    );
  }

  return <AudioPlayer src={url} downloadFileName={`call-${callId}.mp3`} />;
}

function InfoPill({ icon: Icon, text }: { icon: typeof Car; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: "var(--border-soft)", color: "var(--text)" }}>
      <Icon size={13} /> {text}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function SectionLabelInline({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-soft)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{label}</span>
      {children}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--text-soft)", flex: 1, minWidth: 0 }}>
      {label}
      {children}
    </label>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 18,
  boxShadow: "var(--shadow-card)",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 600,
  padding: "3px 9px",
  borderRadius: 999,
  background: "var(--border-soft)",
  color: "var(--text-soft)",
};

const backLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "none",
  border: "none",
  color: "var(--text-soft)",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 16,
  padding: 0,
};

const secondaryButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 15px",
  background: "var(--paper-raised)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 600,
};

const iconButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  background: "var(--paper)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
};

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, CalendarClock, StickyNote, Car } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Avatar } from "../components/ui/Avatar";
import { CategoryBadge, CallStatusBadge } from "../components/ui/StatusBadge";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { formatDateTime, formatDuration, relativeDay } from "../lib/format";
import type { Call, Customer } from "../types";

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    Promise.all([api.customers.get(id), api.customers.calls(id)])
      .then(([c, cs]) => {
        if (!active) return;
        setCustomer(c);
        setCalls(cs);
        setNotFound(false);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else toast.show(err instanceof ApiError ? err.message : "Failed to load customer", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <div>
        <button onClick={() => navigate("/customers")} style={backLinkStyle}>
          <ArrowLeft size={15} /> Back to customers
        </button>
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-faint)" }}>
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Customer not found</p>
          <p style={{ fontSize: 13 }}>They may have been deleted or merged, or the link is out of date.</p>
        </div>
      </div>
    );
  }

  if (loading || !customer) {
    return (
      <div>
        <Skeleton width={140} height={16} />
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          <div style={cardStyle}>
            <Skeleton height={100} />
          </div>
          <div style={cardStyle}>
            <Skeleton height={220} />
          </div>
        </div>
      </div>
    );
  }

  const latestVehicle = calls.find((c) => c.extraction?.carMake || c.extraction?.carModel)?.extraction;

  return (
    <div>
      <button onClick={() => navigate("/customers")} style={backLinkStyle}>
        <ArrowLeft size={15} /> Back to customers
      </button>

      <PageHeader
        eyebrow="Customer"
        title={customer.name ?? "Unnamed caller"}
        description={`${customer.phoneNumber} · Customer since ${relativeDay(customer.createdAt)}`}
      />

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
            <Avatar name={customer.name ?? customer.phoneNumber} size={56} />
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>{customer.name ?? "Unnamed caller"}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Phone size={15} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Phone</div>
                <div className="mono" style={{ fontSize: 13.5 }}>{customer.phoneNumber}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <CalendarClock size={15} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Customer since</div>
                <div style={{ fontSize: 13.5 }}>{formatDateTime(customer.createdAt)}</div>
              </div>
            </div>

            {(latestVehicle?.carMake || latestVehicle?.carModel) && (
              <div style={{ display: "flex", gap: 10 }}>
                <Car size={15} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Latest vehicle</div>
                  <div style={{ fontSize: 13.5 }}>{[latestVehicle?.carMake, latestVehicle?.carModel].filter(Boolean).join(" ")}</div>
                </div>
              </div>
            )}

            {customer.notes && (
              <div style={{ display: "flex", gap: 10 }}>
                <StickyNote size={15} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Notes</div>
                  <div style={{ fontSize: 13.5 }}>{customer.notes}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
            Call history ({calls.length})
          </div>
          {calls.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No calls logged yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {calls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => navigate(`/calls/${call.id}`)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px auto 1fr auto",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 14px",
                    background: "var(--paper)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "var(--radius-sm)",
                    textAlign: "left",
                    fontSize: 13,
                  }}
                >
                  <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>
                    {formatDateTime(call.callDate)}
                  </span>
                  <CategoryBadge category={call.businessCategory} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-soft)" }}>
                    {call.extraction?.summary ?? "No summary yet"}
                    {call.employee && <span style={{ color: "var(--text-faint)" }}> · {call.employee.name}</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-soft)" }}>
                      {formatDuration(call.durationSeconds)}
                    </span>
                    <CallStatusBadge status={call.status} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 18,
  boxShadow: "var(--shadow-card)",
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

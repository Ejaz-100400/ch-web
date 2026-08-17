import { useEffect, useState } from "react";
import { Phone, PhoneMissed } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { relativeDay } from "../lib/format";
import type { Call } from "../types";

const PAGE_SIZE = 25;

// Built for technicians on a phone, not a desk -- no filters, no columns to
// read, just "here's the number, tap it to call." A missed call is any call
// the processing pipeline marked "failed", which in practice means no
// recording ever showed up -- the customer's real signal for that is the
// call never got answered.
export default function MissedCalls() {
  const toast = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.calls
      .list({ status: ["failed"], page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!active) return;
        setCalls(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load missed calls", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        eyebrow="Calls"
        title="Missed calls"
        description="Customers who called and never got through -- tap a number to call them back."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
        {loading &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={72} />)}

        {!loading && calls.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <PhoneMissed size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>No missed calls</p>
          </div>
        )}

        {!loading &&
          calls.map((call) => {
            const phone = call.customer?.phoneNumber;
            return (
              <div
                key={call.id}
                className="fade-in-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  background: "var(--paper-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "var(--coral-soft)",
                    flexShrink: 0,
                  }}
                >
                  <PhoneMissed size={19} color="var(--coral)" />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {phone ? (
                    <a
                      href={`tel:${phone}`}
                      className="mono"
                      style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", textDecoration: "none", display: "block" }}
                    >
                      {phone}
                    </a>
                  ) : (
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-faint)" }}>Unknown number</span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{relativeDay(call.callDate)}</span>
                    <CategoryBadge category={call.businessCategory} />
                    {call.employee?.name && (
                      <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>· {call.employee.name}</span>
                    )}
                  </div>
                </div>

                {phone && (
                  <a
                    href={`tel:${phone}`}
                    aria-label={`Call ${phone}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--brand)",
                      color: "var(--on-brand)",
                      flexShrink: 0,
                    }}
                  >
                    <Phone size={19} />
                  </a>
                )}
              </div>
            );
          })}
      </div>

      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={pagerButtonStyle(page <= 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={pagerButtonStyle(page >= totalPages)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function pagerButtonStyle(disabled: boolean) {
  return {
    padding: "7px 14px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper-raised)",
    fontSize: 12.5,
    fontWeight: 600,
    color: disabled ? "var(--text-faint)" : "var(--text)",
    opacity: disabled ? 0.6 : 1,
  } as const;
}

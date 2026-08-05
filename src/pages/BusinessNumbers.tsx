import { useEffect, useState } from "react";
import { Info, Phone } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import type { BusinessNumber } from "../types";

export default function BusinessNumbers() {
  const toast = useToast();
  const [numbers, setNumbers] = useState<BusinessNumber[] | null>(null);

  useEffect(() => {
    let active = true;
    api.businessNumbers
      .list()
      .then((res) => {
        if (active) setNumbers(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load business numbers", "error"));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Business phone numbers"
        description="The lines inbound calls are routed through, and which category each one resolves to."
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--brand-soft)", color: "var(--brand-strong)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: 12.5, marginBottom: 20, maxWidth: 560 }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Read-only for now — with just two lines this is configured directly in the backend's environment. Adding
          a third line means promoting this into a proper database table; ask an engineer if you need that.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        {numbers === null &&
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={64} />)}

        {numbers?.map((n) => (
          <div
            key={n.number}
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
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--brand-soft)",
                flexShrink: 0,
              }}
            >
              <Phone size={17} color="var(--brand-strong)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{n.number}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{n.label}</div>
            </div>
            <CategoryBadge category={n.category} />
          </div>
        ))}

        {numbers?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No business numbers configured.</p>
        )}
      </div>
    </div>
  );
}

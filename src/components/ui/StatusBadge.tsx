import { Upload } from "lucide-react";
import type { BusinessCategory, CallStatus, FollowUpStatus, SentimentType } from "../../types";

const CALL_STATUS_META: Record<CallStatus, { label: string; color: string; bg: string; live?: boolean }> = {
  pending: { label: "Pending", color: "var(--amber)", bg: "var(--amber-soft)", live: true },
  processing: { label: "Processing", color: "var(--violet)", bg: "var(--violet-soft)", live: true },
  completed: { label: "Completed", color: "var(--brand-strong)", bg: "var(--brand-soft)" },
  failed: { label: "Failed", color: "var(--coral)", bg: "var(--coral-soft)" },
};

const SENTIMENT_META: Record<SentimentType, { label: string; color: string; bg: string }> = {
  interested: { label: "Interested", color: "var(--brand-strong)", bg: "var(--brand-soft)" },
  not_interested: { label: "Not interested", color: "var(--coral)", bg: "var(--coral-soft)" },
  needs_follow_up: { label: "Needs follow-up", color: "var(--amber)", bg: "var(--amber-soft)" },
};

const CATEGORY_META: Record<BusinessCategory, { label: string; color: string; bg: string }> = {
  car_glasses: { label: "Car Glasses", color: "var(--brand-strong)", bg: "var(--brand-soft)" },
  car_modifications: { label: "Car Modifications", color: "var(--violet)", bg: "var(--violet-soft)" },
  unknown: { label: "Unknown", color: "var(--text-faint)", bg: "var(--border-soft)" },
};

const FOLLOWUP_STATUS_META: Record<FollowUpStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "var(--amber)", bg: "var(--amber-soft)" },
  completed: { label: "Completed", color: "var(--brand-strong)", bg: "var(--brand-soft)" },
  missed: { label: "Missed", color: "var(--coral)", bg: "var(--coral-soft)" },
};

function Badge({ label, color, bg, live }: { label: string; color: string; bg: string; live?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      {live && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            animation: "pulse-dot 1.2s ease-in-out infinite",
          }}
        />
      )}
      {label}
    </span>
  );
}

export function CallStatusBadge({ status }: { status: CallStatus }) {
  return <Badge {...CALL_STATUS_META[status]} />;
}

export function SentimentBadge({ sentiment }: { sentiment: SentimentType }) {
  return <Badge {...SENTIMENT_META[sentiment]} />;
}

export function CategoryBadge({ category }: { category: BusinessCategory }) {
  return <Badge {...CATEGORY_META[category]} />;
}

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  return <Badge {...FOLLOWUP_STATUS_META[status]} />;
}

/**
 * Marks a call that came from a bulk historical-data import rather than the
 * live call pipeline -- these have no recording/transcript by nature, not
 * because anything failed, so it's worth a quiet visual distinction rather
 * than looking like a broken live call.
 */
export function ImportedBadge({ importedByName }: { importedByName?: string | null }) {
  return (
    <span
      title={
        importedByName
          ? `Added from a historical data import by ${importedByName} -- no recording exists for this call`
          : "Added from a historical data import -- no recording exists for this call"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-faint)",
        background: "var(--border-soft)",
        whiteSpace: "nowrap",
      }}
    >
      <Upload size={10} />
      Imported
    </span>
  );
}

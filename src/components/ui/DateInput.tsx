import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// Native <input type="date"> renders its visible text in whatever locale the
// browser/OS is set to (mm/dd/yyyy on a US-locale browser) -- there is no
// HTML/CSS way to force a display format on it. Since this business reads
// and enters dates as dd/mm/yyyy, we mask a plain text input instead so the
// display format is consistent everywhere regardless of the viewer's
// browser locale. The value/onChange contract (yyyy-mm-dd, same as a native
// date input) is unchanged so this drops in wherever type="date" was used.
// A click-to-pick calendar sits alongside the typed-text option -- typing
// stays available for anyone who prefers it, but a full month grid is much
// faster than keying in eight digits.

function isoToDisplay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dStr, mStr, yStr] = match;
  const day = Number(dStr);
  const month = Number(mStr);
  const year = Number(yStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${yStr}-${mStr.padStart(2, "0")}-${dStr.padStart(2, "0")}`;
}

function maskDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join("/");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

export function DateInput({ value, onChange, style, disabled, placeholder, ...rest }: DateInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // The popup renders in a portal (see below) so a scroll-clipping ancestor
  // -- AppShell's <main> is exactly this -- can never cut it off the way an
  // inline position:absolute child would be. Position is computed from the
  // input's real screen location instead of relying on CSS inheritance.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const selected = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected ? Number(selected[1]) : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected ? Number(selected[2]) - 1 : today.getMonth());

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    setViewYear(match ? Number(match[1]) : today.getFullYear());
    setViewMonth(match ? Number(match[2]) - 1 : today.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Simpler and less error-prone than tracking every scrollable ancestor
    // to keep the popup glued to the input -- closing on scroll/resize is
    // the same behavior most popover libraries default to. `capture: true`
    // so this fires for a scroll on any ancestor (e.g. AppShell's <main>),
    // not just window-level scrolling.
    function close() {
      setOpen(false);
    }
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function commitText() {
    if (!text.trim()) {
      if (value) onChange("");
      return;
    }
    const iso = displayToIso(text);
    if (iso) onChange(iso);
    else setText(isoToDisplay(value));
  }

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div ref={rootRef} style={{ position: "relative", ...(style?.width ? { width: style.width } : undefined) }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? "DD/MM/YYYY"}
          style={{ ...style, paddingRight: 30 }}
          onChange={(ev) => setText(maskDigits(ev.target.value))}
          onBlur={commitText}
          {...rest}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open calendar"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              padding: 3,
              background: "none",
              border: "none",
              color: "var(--text-faint)",
              cursor: "pointer",
            }}
          >
            <Calendar size={14} />
          </button>
        )}
      </div>

      {open && !disabled && coords && createPortal(
        <div
          ref={popupRef}
          className="fade-in-up"
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 1000,
            width: 240,
            background: "var(--paper-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-card)",
            padding: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" onClick={() => goMonth(-1)} aria-label="Previous month" style={navButtonStyle}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={() => goMonth(1)} aria-label="Next month" style={navButtonStyle}>
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--text-faint)", padding: "2px 0" }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const iso = toIsoDate(viewYear, viewMonth, day);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setText(isoToDisplay(iso));
                    setOpen(false);
                  }}
                  style={{
                    padding: "6px 0",
                    fontSize: 12,
                    borderRadius: 6,
                    border: isToday && !isSelected ? "1px solid var(--brand)" : "1px solid transparent",
                    background: isSelected ? "var(--brand)" : "none",
                    color: isSelected ? "var(--on-brand)" : "var(--text)",
                    fontWeight: isSelected || isToday ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setText("");
                setOpen(false);
              }}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "6px 8px",
                background: "none",
                border: "none",
                borderTop: "1px solid var(--border-soft)",
                color: "var(--text-soft)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
  background: "none",
  border: "none",
  color: "var(--text-soft)",
  cursor: "pointer",
  borderRadius: 6,
};

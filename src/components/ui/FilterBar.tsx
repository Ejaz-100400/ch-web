import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        background: "var(--paper-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 10,
        marginBottom: 18,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
      <Search
        size={15}
        style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "9px 12px 9px 34px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--paper)",
          fontSize: 13.5,
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "var(--text-faint)",
            display: "flex",
            padding: 3,
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const isActive = value !== "";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      style={{
        padding: "9px 30px 9px 12px",
        border: `1px solid ${isActive ? "var(--brand)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        background: isActive ? "var(--brand-soft)" : "var(--paper)",
        color: isActive ? "var(--brand-strong)" : "var(--text)",
        fontSize: 13.5,
        fontWeight: isActive ? 600 : 400,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235B6270' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function MultiSelectFilter({
  label,
  values,
  onChange,
  options,
  triggerStyle,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  triggerStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isActive = values.length > 0;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "9px 12px",
          border: `1px solid ${isActive ? "var(--brand)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          background: isActive ? "var(--brand-soft)" : "var(--paper)",
          color: isActive ? "var(--brand-strong)" : "var(--text)",
          fontSize: 13.5,
          fontWeight: isActive ? 600 : 400,
          whiteSpace: "nowrap",
          ...triggerStyle,
        }}
      >
        {label}
        {isActive && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--brand)",
              color: "var(--on-brand)",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {values.length}
          </span>
        )}
        <ChevronDown size={13} style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : undefined, transition: "transform 120ms ease" }} />
      </button>

      {open && (
        <div
          className="fade-in-up"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            minWidth: 210,
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--paper-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-card)",
            padding: 6,
          }}
        >
          {options.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "6px 8px" }}>No options</div>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 13, borderRadius: 6, cursor: "pointer" }}
            >
              <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggleValue(o.value)} />
              {o.label}
            </label>
          ))}
          {isActive && (
            <button
              onClick={() => onChange([])}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                background: "none",
                border: "none",
                borderTop: "1px solid var(--border-soft)",
                color: "var(--text-soft)",
                fontSize: 12,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdvancedFiltersToggle({
  open,
  count,
  onClick,
}: {
  open: boolean;
  count: number;
  onClick: () => void;
}) {
  const isActive = open || count > 0;
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        border: `1px solid ${isActive ? "var(--brand)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        background: isActive ? "var(--brand-soft)" : "var(--paper)",
        color: isActive ? "var(--brand-strong)" : "var(--text)",
        fontSize: 13.5,
        fontWeight: isActive ? 700 : 600,
      }}
    >
      <SlidersHorizontal size={14} />
      Advanced filters
      {count > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 17,
            height: 17,
            padding: "0 4px",
            borderRadius: 999,
            background: "var(--brand)",
            color: "var(--on-brand)",
            fontSize: 10.5,
            fontWeight: 800,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginLeft: "auto",
        background: "none",
        border: "none",
        color: "var(--text-soft)",
        fontSize: 13,
        fontWeight: 600,
        padding: "9px 6px",
      }}
    >
      Clear filters
    </button>
  );
}

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

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

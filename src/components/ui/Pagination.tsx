import { useEffect, useState } from "react";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(page));

  useEffect(() => {
    setInputValue(String(page));
  }, [page]);

  function commit() {
    const parsed = Math.round(Number(inputValue));
    const clamped = Number.isFinite(parsed) ? Math.max(1, Math.min(totalPages, parsed)) : page;
    setInputValue(String(clamped));
    if (clamped !== page) onPageChange(clamped);
  }

  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
        Previous
      </button>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)" }}>
        Page
        <input
          type="number"
          inputMode="numeric"
          value={inputValue}
          min={1}
          max={totalPages}
          aria-label="Page number"
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={{
            width: 44,
            textAlign: "center",
            padding: "5px 2px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--paper-raised)",
            color: "var(--text)",
            fontSize: 12.5,
          }}
        />
        of {totalPages}
      </span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={pagerButtonStyle(page >= totalPages)}>
        Next
      </button>
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

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Text input with a suggestions dropdown, but still accepts anything typed
 * that isn't in the list -- for fields like Car make/model where the value
 * needs to suggest existing entries without being locked to them. Built as a
 * real component rather than native <input list>/<datalist>: datalist's
 * suggestion popup is unreliable on mobile (iOS Safari effectively ignores
 * it, Android Chrome support varies by version), which is where this
 * business's staff actually use the app.
 */
export function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const query = value.trim().toLowerCase();
  const filtered = (query ? options.filter((o) => o.toLowerCase().includes(query)) : options).slice(0, 50);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        style={style}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          className="fade-in-up"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 220,
            overflowY: "auto",
            background: "var(--paper-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-card)",
            padding: 4,
          }}
        >
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              // mousedown (not click) fires before the input's blur, so the
              // dropdown doesn't close itself out from under the tap first.
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(option);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 9px",
                background: "none",
                border: "none",
                fontSize: 13,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

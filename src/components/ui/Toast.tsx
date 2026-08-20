import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, PhoneCall, X } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "alert";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const KIND_META: Record<ToastKind, { icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle2, color: "var(--brand-strong)", bg: "var(--brand-soft)", border: "var(--brand)" },
  error: { icon: XCircle, color: "var(--coral)", bg: "var(--coral-soft)", border: "var(--coral)" },
  info: { icon: Info, color: "var(--violet)", bg: "var(--violet-soft)", border: "var(--violet)" },
  // Distinct from the others on purpose -- this is for things a worker
  // genuinely needs to notice mid-task (a missed call just got handled),
  // not routine save-confirmation noise, so it reads louder: solid brand
  // fill instead of a soft tint, a bigger icon, and it defaults to staying
  // up longer.
  alert: { icon: PhoneCall, color: "var(--on-brand)", bg: "var(--brand)", border: "var(--brand)" },
};

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3800,
  error: 5000,
  info: 3800,
  alert: 6500,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "success", options?: ToastOptions) => {
      const id = nextId.current++;
      const duration = options?.duration ?? DEFAULT_DURATION[kind];
      setItems((prev) => [...prev, { id, kind, message, duration, action: options?.action }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          zIndex: 2000,
          maxWidth: 380,
          width: "calc(100% - 40px)",
        }}
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const isAlert = item.kind === "alert";

  return (
    <div
      role={isAlert ? "alert" : "status"}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        padding: isAlert ? "13px 14px 15px" : "10px 12px 12px",
        borderRadius: "var(--radius-md)",
        background: isAlert ? meta.bg : "var(--paper-raised)",
        border: `1px solid ${meta.border}`,
        boxShadow: "var(--shadow-pop)",
        overflow: "hidden",
        animation: "toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: isAlert ? 30 : 22,
          height: isAlert ? 30 : 22,
          flexShrink: 0,
          borderRadius: "50%",
          background: isAlert ? "rgba(0,0,0,0.08)" : "transparent",
          marginTop: isAlert ? 0 : 1,
        }}
      >
        <Icon size={isAlert ? 17 : 16} color={isAlert ? meta.color : meta.color} fill={isAlert ? "none" : undefined} />
      </span>

      <div style={{ flex: 1, minWidth: 0, paddingTop: isAlert ? 4 : 1 }}>
        <span
          style={{
            fontSize: isAlert ? 13.5 : 13,
            fontWeight: isAlert ? 700 : 600,
            color: isAlert ? "var(--on-brand)" : "var(--text)",
            display: "block",
          }}
        >
          {item.message}
        </span>
        {item.action && (
          <button
            onClick={() => {
              item.action!.onClick();
              onDismiss();
            }}
            style={{
              marginTop: 6,
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${isAlert ? "rgba(0,0,0,0.15)" : "var(--border)"}`,
              background: isAlert ? "rgba(255,255,255,0.35)" : "var(--paper)",
              color: isAlert ? "var(--on-brand)" : "var(--text)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          display: "flex",
          flexShrink: 0,
          padding: 3,
          marginTop: 1,
          background: "none",
          border: "none",
          color: isAlert ? "rgba(0,0,0,0.45)" : "var(--text-faint)",
          cursor: "pointer",
        }}
      >
        <X size={14} />
      </button>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: isAlert ? "rgba(0,0,0,0.12)" : "var(--border-soft)",
        }}
      >
        <div
          style={{
            height: "100%",
            background: isAlert ? "rgba(0,0,0,0.3)" : meta.border,
            animation: `toast-countdown ${item.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

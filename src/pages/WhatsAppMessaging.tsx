import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MessageCircle, Search as SearchIcon, User } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { MultiSelectFilter } from "../components/ui/FilterBar";
import { Skeleton } from "../components/ui/Skeleton";
import { LoadingText } from "../components/ui/Spinner";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/format";
import { productGradient, PRODUCT_GRADIENT_TEXT, UNCLASSIFIED_GRADIENT } from "../lib/product-color";
import type { Product, WhatsAppConversationSummary, WhatsAppMessage } from "../types";

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unclassified line" },
];

function listTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(iso);
}

function threadTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function WhatsAppMessaging() {
  const toast = useToast();

  const [category, setCategory] = useState<string[]>([]);
  const [productId, setProductId] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  const [conversations, setConversations] = useState<WhatsAppConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    api.products.list().then(setProducts).catch(() => setProducts([]));
  }, []);

  const productOptions = useMemo(
    () =>
      products
        .filter((p) => category.length === 0 || category.includes(p.category))
        .map((p) => ({ value: p.id, label: p.name })),
    [products, category],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      api.whatsapp
        .conversations({
          category: category.length ? (category as ("car_glasses" | "car_modifications" | "unknown")[]) : undefined,
          productId: productId.length ? productId : undefined,
          search: search || undefined,
        })
        .then((res) => {
          if (!active) return;
          setConversations(res);
          // Keep whatever's already open if it still matches the filter;
          // otherwise default to the most recent conversation, same as
          // opening WhatsApp itself lands you on the top chat.
          setSelectedId((current) => (current && res.some((c) => c.id === current) ? current : res[0]?.id ?? null));
        })
        .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load WhatsApp conversations", "error"))
        .finally(() => {
          if (active) setLoading(false);
        });
    }, search ? 300 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, productId, search]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    setMessagesLoading(true);
    api.whatsapp
      .messages(selectedId)
      .then((res) => {
        if (active) setMessages(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load the conversation", "error"))
      .finally(() => {
        if (active) setMessagesLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="WhatsApp"
        title="WhatsApp Messaging"
        description="Every conversation coming in over WhatsApp, classified against your product catalog."
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <MultiSelectFilter label="Product" values={productId} onChange={setProductId} options={productOptions} />
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <SearchIcon size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone"
            style={{ ...searchInputStyle, width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          height: "calc(100vh - 260px)",
          minHeight: 420,
          background: "var(--paper-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        {/* Conversation list */}
        <div style={{ borderRight: "1px solid var(--border-soft)", overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Skeleton width={40} height={40} radius={999} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <Skeleton width={120} height={12} />
                    <Skeleton width={170} height={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-faint)" }}>
              <MessageCircle size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No WhatsApp conversations yet</p>
              <p style={{ fontSize: 13 }}>They'll show up here as customers message in.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === selectedId;
              const name = c.customer.name ?? c.customer.phoneNumber;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "12px 14px",
                    background: isActive ? "var(--brand-soft)" : "none",
                    border: "none",
                    borderBottom: "1px solid var(--border-soft)",
                    borderLeft: `3px solid ${isActive ? "var(--brand)" : "transparent"}`,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "var(--paper)",
                      border: "1px solid var(--border)",
                      color: "var(--text-faint)",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {c.customer.name ? c.customer.name.charAt(0).toUpperCase() : <User size={18} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>{listTimestamp(c.lastMessageAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                      {c.lastMessagePreview ?? "—"}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                      {c.products.length > 0 ? (
                        c.products.map((p) => (
                          <span key={p.id} style={{ ...productPillStyle, background: productGradient(p.id), color: PRODUCT_GRADIENT_TEXT }}>
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ ...productPillStyle, background: UNCLASSIFIED_GRADIENT, color: "var(--text-faint)" }}>Unclassified</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Thread */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)" }}>
              <div style={{ textAlign: "center" }}>
                <MessageCircle size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p style={{ fontSize: 13.5 }}>Select a conversation to read it</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "var(--paper)",
                    border: "1px solid var(--border)",
                    color: "var(--text-faint)",
                    fontWeight: 700,
                  }}
                >
                  {selected.customer.name ? selected.customer.name.charAt(0).toUpperCase() : <User size={16} />}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.customer.name ?? selected.customer.phoneNumber}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{selected.customer.phoneNumber}</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, background: "var(--paper)" }}>
                {messagesLoading ? (
                  <LoadingText />
                ) : messages.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", marginTop: 20 }}>No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: m.direction === "outbound" ? "flex-end" : "flex-start" }}>
                      <div
                        style={{
                          maxWidth: "70%",
                          padding: "8px 12px",
                          borderRadius: "var(--radius-md)",
                          background: m.direction === "outbound" ? "var(--brand-soft)" : "var(--paper-raised)",
                          border: "1px solid var(--border-soft)",
                          boxShadow: "var(--shadow-card)",
                        }}
                      >
                        <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {m.body ?? `[${m.messageType}]`}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 4, textAlign: "right" }}>
                          {threadTimestamp(m.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const searchInputStyle: CSSProperties = {
  padding: "9px 12px 9px 30px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13.5,
};

const productPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 700,
};

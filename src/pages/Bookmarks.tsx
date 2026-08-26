import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, BookmarkX } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, ClearFiltersButton } from "../components/ui/FilterBar";
import { Avatar } from "../components/ui/Avatar";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { relativeDay } from "../lib/format";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import type { Customer } from "../types";

const PAGE_SIZE = 20;

export default function Bookmarks() {
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [debouncedPhone, setDebouncedPhone] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  function setPage(update: number | ((p: number) => number)) {
    const next = typeof update === "function" ? update(page) : update;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next <= 1) params.delete("page");
        else params.set("page", String(next));
        return params;
      },
      { replace: true },
    );
  }

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isFirstSearchEffect = useRef(true);
  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false;
      return;
    }
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedPhone(phone);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, phone]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.customers
      .list({ bookmarked: true, search: debouncedSearch || undefined, phone: debouncedPhone || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!active) return;
        setCustomers(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load bookmarks", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedPhone, page]);

  async function handleRemove(customer: Customer) {
    setRemovingId(customer.id);
    try {
      await api.customers.toggleBookmark(customer.id, false);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.show("Removed from bookmarks.", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to remove bookmark", "error");
    } finally {
      setRemovingId(null);
    }
  }

  const hasActiveFilters = Boolean(search || phone);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const gridCols = "1.8fr 1.2fr 1.2fr 1fr 90px";

  return (
    <div>
      <PageHeader
        eyebrow="Bookmarks"
        title="Bookmarked customers"
        description="Customers you're specifically keeping an eye on -- separate from the structured follow-up queue and its statuses. Bookmark any call from the call log or a call's detail page."
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 150 }}
        />
        {hasActiveFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setPhone("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} bookmarked customer${total === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 680 }}>
            <div
              className="mono"
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                padding: "10px 18px",
                fontSize: 11,
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <span>Customer</span>
              <span>Phone</span>
              <span>Vehicle</span>
              <span>Bookmarked</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={6} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {customers.map((c) => (
                    <motion.div
                      key={c.id}
                      layout="position"
                      variants={listItemVariants}
                      exit="exit"
                      style={{
                        display: "grid",
                        gridTemplateColumns: gridCols,
                        alignItems: "center",
                        padding: "12px 18px",
                        borderBottom: "1px solid var(--border-soft)",
                        fontSize: 13.5,
                      }}
                    >
                      <Link to={`/customers/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, color: "inherit", textDecoration: "none" }}>
                        <Avatar name={c.name ?? c.phoneNumber} size={30} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                          {c.name ?? <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Unnamed caller</span>}
                        </span>
                      </Link>
                      <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{c.phoneNumber}</span>
                      <span style={{ color: "var(--text-soft)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.latestCarMake || c.latestCarModel
                          ? [c.latestCarMake, c.latestCarModel].filter(Boolean).join(" ")
                          : <span style={{ color: "var(--text-faint)" }}>—</span>}
                      </span>
                      <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{c.bookmarkedAt ? relativeDay(c.bookmarkedAt) : "—"}</span>
                      <button
                        onClick={() => handleRemove(c)}
                        disabled={removingId === c.id}
                        aria-label={`Remove bookmark for ${c.name ?? c.phoneNumber}`}
                        title="Remove bookmark"
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "var(--coral-soft)", color: "var(--coral)", border: "1px solid var(--coral)", borderRadius: 6, fontSize: 12, fontWeight: 600, justifySelf: "start" }}
                      >
                        <BookmarkX size={13} /> Remove
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && customers.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <Bookmark size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No bookmarks yet</p>
            <p style={{ fontSize: 13 }}>Use the bookmark icon on a call in the call log or a call's detail page to add one.</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

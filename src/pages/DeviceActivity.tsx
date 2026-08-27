import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Laptop, Smartphone, Tablet, MonitorSmartphone, Trash2, MapPin } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, ClearFiltersButton } from "../components/ui/FilterBar";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { relativeDay, formatDateTime } from "../lib/format";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import type { UserDevice } from "../types";

function deviceIcon(deviceType: string) {
  if (deviceType === "mobile") return Smartphone;
  if (deviceType === "tablet") return Tablet;
  if (deviceType === "desktop") return Laptop;
  return MonitorSmartphone;
}

export default function DeviceActivity() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.auth
      .devices()
      .then(setDevices)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load login activity", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (appUser && !appUser.isOwner) {
    return (
      <div>
        <PageHeader eyebrow="Security" title="Login activity" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>This page is restricted to the account owner</p>
          <p style={{ fontSize: 13 }}>Ask the owner if you need access to this.</p>
        </div>
      </div>
    );
  }

  async function handleForget(device: UserDevice) {
    if (!window.confirm(`Forget "${device.deviceLabel}" for ${device.user.name}? Their next login from it will look new again and send an alert.`)) return;
    setRemovingId(device.id);
    try {
      await api.auth.deleteDevice(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.show("Device forgotten.", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to forget device", "error");
    } finally {
      setRemovingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.user.name.toLowerCase().includes(q) ||
        d.user.email.toLowerCase().includes(q) ||
        d.deviceLabel.toLowerCase().includes(q) ||
        (d.city ?? "").toLowerCase().includes(q) ||
        (d.country ?? "").toLowerCase().includes(q),
    );
  }, [devices, search]);

  const accountCount = new Set(devices.map((d) => d.userId)).size;
  const gridCols = "1.5fr 1.6fr 1.3fr 1fr 1fr 70px 70px";

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Login activity"
        description="Every device that's signed in across every account -- visible only to you."
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, device, or location" />
        {search && <ClearFiltersButton onClick={() => setSearch("")} />}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${filtered.length} device${filtered.length === 1 ? "" : "s"} across ${accountCount} account${accountCount === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 900 }}>
            <div className="mono" style={theadStyle(gridCols)}>
              <span>Account</span>
              <span>Device</span>
              <span>Location</span>
              <span>First seen</span>
              <span>Last seen</span>
              <span>Logins</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={6} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {filtered.map((d) => {
                    const Icon = deviceIcon(d.deviceType);
                    return (
                      <motion.div key={d.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle(gridCols)}>
                        <span style={{ overflow: "hidden" }}>
                          <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.user.name}</div>
                          <div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.user.email}
                          </div>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
                          <Icon size={14} color="var(--text-faint)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.deviceLabel}</span>
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            {[d.city, d.region, d.country].filter(Boolean).join(", ") || "Unknown"}
                            {d.locationSource === "gps" && (
                              <span title="Precise GPS fix from the browser, not just an IP lookup" style={{ display: "inline-flex" }}>
                                <MapPin size={11} color="var(--brand)" />
                              </span>
                            )}
                          </span>
                          {d.ipAddress && (
                            <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                              {d.ipAddress}
                              {d.locationSource !== "gps" && " (IP-based, approximate)"}
                            </div>
                          )}
                          {d.lat != null && d.lng != null && (
                            <a
                              href={`https://www.google.com/maps?q=${d.lat},${d.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 11, color: "var(--brand)" }}
                            >
                              View on map
                            </a>
                          )}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-soft)" }} title={formatDateTime(d.firstSeenAt)}>
                          {relativeDay(d.firstSeenAt)}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-soft)" }} title={formatDateTime(d.lastSeenAt)}>
                          {relativeDay(d.lastSeenAt)}
                        </span>
                        <span className="mono" style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{d.loginCount}</span>
                        <button
                          onClick={() => handleForget(d)}
                          disabled={removingId === d.id}
                          aria-label={`Forget ${d.deviceLabel} for ${d.user.name}`}
                          title="Forget this device"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "none", border: "none", borderRadius: 6, color: "var(--coral)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <MonitorSmartphone size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>
              {devices.length === 0 ? "No logins tracked yet" : "No devices match that search"}
            </p>
            <p style={{ fontSize: 13 }}>
              {devices.length === 0 ? "Tracking started when this feature shipped -- devices show up as people actually sign in." : "Try a different search, or clear it."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

function theadStyle(gridCols: string): CSSProperties {
  return {
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
  };
}

function trowStyle(gridCols: string): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: gridCols,
    alignItems: "center",
    padding: "12px 18px",
    borderBottom: "1px solid var(--border-soft)",
    fontSize: 13,
  };
}

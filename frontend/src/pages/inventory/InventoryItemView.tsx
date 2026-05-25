"use client";
import React, { useEffect, useState } from "react";
import { ROUTES } from "../../app/router/routes";
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  DollarSign,
  BarChart3,
  AlertCircle,
  Loader2,
  Hash,
  Layers,
  Scale,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceHistoryEntry {
  id: string;
  unitPrice: number;
  effectiveDate: string;
  createdAt: string;
}

interface MovementEntry {
  id: string;
  movementType:
    | "RECEIPT"
    | "ISSUE_TO_PRODUCTION"
    | "ISSUE_TO_PACKAGING"
    | "SALES_DISPATCH"
    | "ADJUSTMENT";
  quantityDelta: number;
  unitPriceApplied: number;
  movementAt: string;
  notes?: string | null;
}

interface InventoryItemDetail {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: "RAW_MATERIAL" | "FINISHED_GOOD" | "BY_PRODUCT";
  unit: string;
  quantity: number;
  unitPrice: number | null;
  reorderLevel?: number | null;
  reorderQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
  priceHistory: PriceHistoryEntry[];
  movements: MovementEntry[];
}

// ─── Mock data (offline fallback) ─────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
 const fmtCompact = (value: number) => {
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  return fmt(value, 2);
};

const MOVEMENT_META: Record<MovementEntry["movementType"], { label: string; color: string; bg: string; sign: "+" | "−" }> = {
  RECEIPT:            { label: "Receipt",          color: "#16a34a", bg: "#f0fdf4", sign: "+" },
  ISSUE_TO_PRODUCTION:{ label: "To Production",    color: "#d97706", bg: "#fffbeb", sign: "−" },
  ISSUE_TO_PACKAGING: { label: "To Packaging",     color: "#0891b2", bg: "#ecfeff", sign: "−" },
  SALES_DISPATCH:     { label: "Sales Dispatch",   color: "#2563eb", bg: "#eff6ff", sign: "−" },
  ADJUSTMENT:         { label: "Adjustment",       color: "#7c3aed", bg: "#faf5ff", sign: "±" as any },
};

const TYPE_META = {
  RAW_MATERIAL: { label: "Raw Material",  color: "#92400e", bg: "#fef3c7" },
  FINISHED_GOOD:{ label: "Finished Good", color: "#065f46", bg: "#d1fae5" },
  BY_PRODUCT:   { label: "By-Product",    color: "#4c1d95", bg: "#ede9fe" },
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "#fef9f0",
        border: "1px solid #fde68a",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#d97706", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.2, marginTop: 2, fontFamily: "'DM Mono', 'Courier New', monospace" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(to bottom, #f59e0b, #ef4444)" }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

import { useParams, useNavigate } from "react-router-dom";

type InventoryItemRouteParams = {
  itemId: string;
};

export function InventoryItemView() {
  const { itemId } = useParams<InventoryItemRouteParams>();
  const navigate = useNavigate();


  const [item, setItem] = useState<InventoryItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"price" | "movements">("movements");

  useEffect(() => {
    if (!itemId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/inventory/${itemId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItem(data.item);
      } catch (e) {
        setError("Could not reach server or item not found.");
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6b7280", fontSize: 14, fontWeight: 600 }}>
          <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
          Loading item details…
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ textAlign: "center", padding: "40px", background: "#fff", borderRadius: "16px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <Package style={{ width: 48, height: 48, color: "#d1d5db", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", marginBottom: "8px" }}>No Item Data</h2>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "20px" }}>There is no information to display for this inventory item.</p>
          <button onClick={() => navigate(ROUTES.INVENTORY_CATALOGUE)} style={{ color: "#d97706", fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer" }}>Back to Catalog</button>
        </div>
      </div>
    );
  }

  const typeMeta = TYPE_META[item.type];
  const latestPrice = item.priceHistory[0]?.unitPrice ?? item.unitPrice ?? 0;
  const totalValue = item.quantity * latestPrice;

  const priceTrend = item.priceHistory.length >= 2
    ? latestPrice - item.priceHistory[1].unitPrice
    : null;

  return (
    <div style={{
      background: "transparent",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Content header (inside InventoryLayout main area) */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "14px 18px",
        height: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 30,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        marginBottom: 20,
      }}>
        <button
          onClick={() => navigate(ROUTES.INVENTORY_CATALOGUE)}

          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid #e5e7eb",
            borderRadius: 8, padding: "6px 14px",
            fontSize: 12, fontWeight: 700, color: "#374151",
            cursor: "pointer",
          }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to Catalog
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 800,
            padding: "3px 10px", borderRadius: 999,
            color: typeMeta.color, background: typeMeta.bg,
            border: `1px solid ${typeMeta.color}40`,
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            {typeMeta.label}
          </span>
          <span style={{
            fontFamily: "monospace", fontSize: 13, fontWeight: 700,
            color: "#6b7280", background: "#f3f4f6",
            padding: "3px 10px", borderRadius: 6,
          }}>
            {item.sku}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: "0" }}>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 10, padding: "10px 16px",
            fontSize: 12, color: "#92400e", fontWeight: 600,
            marginBottom: 20,
          }}>
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* ── Hero identity card ── */}
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: "24px 28px",
          marginBottom: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* decorative accent */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 4,
            background: "linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6)",
            borderRadius: "18px 18px 0 0",
          }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
            {/* avatar */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "linear-gradient(135deg, #fef3c7, #fde68a)",
              border: "1px solid #fcd34d",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Package style={{ width: 26, height: 26, color: "#d97706" }} />
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>{item.name}</h1>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {item.description ?? "No description provided."}
              </p>
            </div>

            {/* quick meta chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              <Chip icon={<Hash style={{ width: 11, height: 11 }} />} label="SKU" value={item.sku} />
              <Chip icon={<Scale style={{ width: 11, height: 11 }} />} label="Unit" value={item.unit} />
              <Chip icon={<Layers style={{ width: 11, height: 11 }} />} label="Added" value={fmtDate(item.createdAt)} />
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
          <StatCard
            icon={<Activity style={{ width: 18, height: 18 }} />}
            label="Quantity on Hand"
            value={`${fmt(item.quantity)} ${item.unit}`}
            sub={
              item.reorderLevel != null && item.quantity <= item.reorderLevel
                ? `⚠ Below reorder (${item.reorderLevel} ${item.unit})`
                : "In stock"
            }
          />
          <StatCard
            icon={<DollarSign style={{ width: 18, height: 18 }} />}
            label="Unit Price"
            value={`ksh${fmt(latestPrice)}`}
            sub={priceTrend !== null
              ? `${priceTrend >= 0 ? "▲" : "▼"} $${fmt(Math.abs(priceTrend))} vs prev`
              : "Current price"}
          />
          <StatCard
            icon={<BarChart3 style={{ width: 18, height: 18 }} />}
            label="Stock Value"
            value={`KSh ${fmtCompact(totalValue)}`}
            sub={`${item.quantity.toFixed(3)} × ksh${fmt(latestPrice)}`}
          />
          <StatCard
            icon={<Clock style={{ width: 18, height: 18 }} />}
            label="Last Updated"
            value={fmtDate(item.updatedAt)}
            sub={fmtDateTime(item.updatedAt)}
          />
        </div>

        {/* ── Tabbed history section ── */}
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          {/* tab header */}
          <div style={{
            padding: "0 24px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            gap: 4,
          }}>
            {(["movements", "price"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "16px 18px 14px",
                  border: "none",
                  borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent",
                  background: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  color: tab === t ? "#d97706" : "#9ca3af",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  transition: "color 0.15s",
                }}
              >
                {t === "movements" ? "Quantity History" : "Price History"}
              </button>
            ))}
          </div>

          <div style={{ padding: "20px 24px" }}>
            {tab === "movements" && (
              <MovementsTable movements={item.movements} unit={item.unit} />
            )}
            {tab === "price" && (
              <PriceHistoryTable priceHistory={item.priceHistory} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: "#f9fafb", border: "1px solid #e5e7eb",
      borderRadius: 8, padding: "5px 10px",
      fontSize: 11,
    }}>
      <span style={{ color: "#9ca3af" }}>{icon}</span>
      <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}:</span>
      <span style={{ color: "#111827", fontWeight: 700, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function MovementsTable({ movements, unit }: { movements: MovementEntry[]; unit: string }) {
  if (movements.length === 0) {
    return <EmptyState icon={<Activity />} message="No stock movements recorded yet." />;
  }

  return (
    <div>
      <SectionHeading>Stock Movement Log</SectionHeading>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              {["Date & Time", "Type", "Δ Quantity", "Unit Price", "Notes"].map((h) => (
                <th key={h} style={{
                  padding: "8px 12px", textAlign: "left",
                  fontSize: 10, fontWeight: 800, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const meta = MOVEMENT_META[m.movementType];
              const isPos = m.quantityDelta > 0;
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #f9fafb" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                    {fmtDateTime(m.movementAt)}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: "3px 9px", borderRadius: 999,
                      color: meta.color, background: meta.bg,
                      border: `1px solid ${meta.color}30`,
                    }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={{
                    padding: "11px 12px",
                    fontFamily: "monospace", fontWeight: 800,
                    color: isPos ? "#16a34a" : m.quantityDelta < 0 ? "#dc2626" : "#7c3aed",
                  }}>
                    {isPos ? "+" : ""}{fmt(m.quantityDelta, 3)} {unit}
                  </td>
                  <td style={{ padding: "11px 12px", fontFamily: "monospace", color: "#374151" }}>
                    ksh{fmt(m.unitPriceApplied)}
                  </td>
                  <td style={{ padding: "11px 12px", color: "#9ca3af", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.notes ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceHistoryTable({ priceHistory }: { priceHistory: PriceHistoryEntry[] }) {
  if (priceHistory.length === 0) {
    return <EmptyState icon={<DollarSign />} message="No price history recorded yet." />;
  }

  return (
    <div>
      <SectionHeading>Price History</SectionHeading>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              {["Effective Date", "Unit Price", "Change", "Recorded At"].map((h) => (
                <th key={h} style={{
                  padding: "8px 12px", textAlign: "left",
                  fontSize: 10, fontWeight: 800, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priceHistory.map((p, idx) => {
              const prev = priceHistory[idx + 1];
              const delta = prev ? p.unitPrice - prev.unitPrice : null;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f9fafb" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 12px", color: "#374151", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {fmtDate(p.effectiveDate)}
                  </td>
                  <td style={{ padding: "11px 12px", fontFamily: "monospace", fontWeight: 800, color: "#111827", fontSize: 14 }}>
                    ksh{fmt(p.unitPrice)}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    {delta === null ? (
                      <span style={{ color: "#d1d5db", fontSize: 11 }}>Initial price</span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontFamily: "monospace", fontWeight: 700, fontSize: 12,
                        color: delta > 0 ? "#dc2626" : delta < 0 ? "#16a34a" : "#9ca3af",
                      }}>
                        {delta > 0
                          ? <TrendingUp style={{ width: 12, height: 12 }} />
                          : delta < 0
                          ? <TrendingDown style={{ width: 12, height: 12 }} />
                          : null}
                        {delta > 0 ? "+" : ""}${fmt(delta)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "11px 12px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {fmtDateTime(p.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
      <div style={{ width: 36, height: 36, margin: "0 auto 10px", opacity: 0.4 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{message}</p>
    </div>
  );
}
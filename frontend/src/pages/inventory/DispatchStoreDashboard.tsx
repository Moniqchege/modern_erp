import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch } from "../../api/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type BaleStockRow = {
  sku: string;
  name: string;
  unit: string;
  type?: string;
  kgPerUnit?: number;
  physicalQty: number;
  transitQty: number;
  value: number;
};

type InboundTransferItem = {
  sku: string;
  name: string;
  unit: string;
  qtyRequested: number;
  qtyIssued: number | null;
};

type InboundTransfer = {
  id: string;
  requestNumber: string;
  status: "PENDING" | "APPROVED_IN_TRANSIT" | "PENDING_CORRECTION";
  requestedBy: string;
  createdAt: string;
  items: InboundTransferItem[];
};

type RecentMovement = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  movementType: string;
  quantityDelta: number;
  movementAt: string;
  notes?: string | null;
};

type MovementTrendDay = { date: string; receiptsKg: number; issuesKg: number };

type DispatchDashboardData = {
  isDispatchStore: true;
  kpis: {
    totalBaleSkus: number;
    totalBalesOnHand: number;
    totalBalesInTransit: number;
    totalValuationKes: number;
    inTransitIn: number;
    pendingInbound: number;
  };
  baleStock: BaleStockRow[];
  inboundTransfers: InboundTransfer[];
  movementTrend: MovementTrendDay[];
  recentMovements: RecentMovement[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtNum = (n: number, decimals = 0) =>
  n.toLocaleString(undefined, { maximumFractionDigits: decimals });

const fmtKes = (n: number) =>
  `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const INBOUND_STATUS_META = {
  PENDING: {
    label: "Awaiting issue",
    className: "text-amber-700 bg-amber-50 border-amber-200",
    icon: Clock,
  },
  APPROVED_IN_TRANSIT: {
    label: "In transit",
    className: "text-blue-700 bg-blue-50 border-blue-200",
    icon: Truck,
  },
  PENDING_CORRECTION: {
    label: "Correction needed",
    className: "text-orange-700 bg-orange-50 border-orange-200",
    icon: AlertTriangle,
  },
} as const;

// ─── Bale type badge ──────────────────────────────────────────────────────────

const BALE_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  KHAKI_BALER_2KG:  { label: "2kg Khaki Bale",    className: "text-orange-700 bg-orange-50 border-orange-200" },
  KHAKI_BALER_1KG:  { label: "1kg Khaki Bale",    className: "text-orange-700 bg-orange-50 border-orange-200" },
  NYLON_BALER_2KG:  { label: "2kg Nylon Bale",    className: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  NYLON_BALER_1KG:  { label: "1kg Nylon Bale",    className: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  LAMINATED_BALER:  { label: "Laminated Bale",     className: "text-violet-700 bg-violet-50 border-violet-200" },
  PACKETS_2KG:      { label: "2kg Packets",        className: "text-blue-700 bg-blue-50 border-blue-200" },
  PACKETS_1KG:      { label: "1kg Packets",        className: "text-blue-700 bg-blue-50 border-blue-200" },
  BAG_5KG:          { label: "5kg Bag",            className: "text-slate-600 bg-slate-50 border-slate-200" },
  BAG_10KG:         { label: "10kg Bag",           className: "text-slate-600 bg-slate-50 border-slate-200" },
  BAG_50KG:         { label: "50kg Bag",           className: "text-slate-600 bg-slate-50 border-slate-200" },
  BAG_90KG:         { label: "90kg Bag",           className: "text-slate-600 bg-slate-50 border-slate-200" },
  FINISHED_GOOD:    { label: "Finished Good",      className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  BY_PRODUCT:       { label: "By-Product",         className: "text-purple-700 bg-purple-50 border-purple-200" },
};

function BaleTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const meta = BALE_TYPE_LABELS[type];
  const label = meta?.label ?? type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  const className = meta?.className ?? "text-indigo-700 bg-indigo-50 border-indigo-200";
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border ${className} select-none`}>
      {label}
    </span>
  );
}

function MiniBar({
  items,
  valueKey,
  color,
}: {
  items: Array<{ label: string } & Record<string, number | string>>;
  valueKey: string;
  color: string;
}) {
  const values = items.map((i) => Number(i[valueKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-10">
      {items.map((item, i) => {
        const v = Number(item[valueKey]) || 0;
        const h = Math.max(3, (v / max) * 40);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div
              className={`w-full rounded-t ${color}`}
              style={{ height: h }}
              title={`${item.label}: ${v.toFixed(1)}`}
            />
            <span className="text-[7px] text-slate-400 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DispatchStoreDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DispatchDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/inventory/dashboard?storeCode=DISPATCH_STORE");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.isDispatchStore) throw new Error("Unexpected response format");
      setData(json as DispatchDashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dispatch store data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>{error ?? "No data available"}</span>
        <button
          type="button"
          onClick={load}
          className="ml-auto text-xs font-bold hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Dispatch Store
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bale arrivals from Packaging · Outbound customer deliveries
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff7d12] text-white text-xs font-bold"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Bale Transfers
          </button>
        </div>
      </div>

      {/* Alert: pending inbound */}
      {k.pendingInbound > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-900">
            {k.pendingInbound} inbound bale transfer
            {k.pendingInbound !== 1 ? "s" : ""} need your attention
          </p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
            className="ml-auto text-xs font-bold text-amber-800 hover:underline whitespace-nowrap"
          >
            View transfers →
          </button>
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Bale SKUs on hand",
            value: String(k.totalBaleSkus),
            sub: "Finished goods ready",
            icon: Package,
            accent: "border-slate-200",
          },
          {
            label: "Total bales on hand",
            value: fmtNum(k.totalBalesOnHand, 1),
            sub: "Physical stock",
            icon: CheckCircle2,
            accent: "border-emerald-200 bg-emerald-50/30",
          },
          {
            label: "Bales in transit",
            value: fmtNum(k.totalBalesInTransit, 1),
            sub: `${k.inTransitIn} transfer${k.inTransitIn !== 1 ? "s" : ""} in flight`,
            icon: Truck,
            accent: "border-blue-200 bg-blue-50/30",
          },
          {
            label: "Stock valuation",
            value: fmtKes(k.totalValuationKes),
            sub: "Bales × kg/bale × flour selling price",
            icon: DollarSign,
            accent: "border-orange-200 bg-orange-50/30",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-xl border p-5 shadow-sm ${card.accent}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {card.label}
                </span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {card.value}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">{card.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Bale stock table + movement trend */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bale stock on hand */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-800">
              Bales on hand
            </h3>
            <button
              type="button"
              onClick={() => navigate(ROUTES.INVENTORY_CATALOGUE)}
              className="text-[10px] font-bold text-orange-600 hover:underline"
            >
              Full catalogue →
            </button>
          </div>
          {data.baleStock.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-400">
              No bales currently in dispatch store.
              <br />
              <button
                type="button"
                onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
                className="mt-2 text-[#ff7d12] font-bold hover:underline"
              >
                Request bales from Packaging →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Bale Type</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3 text-center">Kg/Bale</th>
                    <th className="px-5 py-3 text-right">On hand</th>
                    <th className="px-5 py-3 text-right">In transit</th>
                    <th className="px-5 py-3 text-right">Value (selling)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.baleStock.map((row) => (
                    <tr key={row.sku} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-mono font-bold text-slate-800">
                        {row.sku}
                      </td>
                      <td className="px-5 py-3">
                        <BaleTypeBadge type={row.type} />
                      </td>
                      <td className="px-5 py-3 text-slate-600 max-w-[130px] truncate">
                        {row.name}
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-slate-500 text-[11px]">
                        {row.kgPerUnit ?? 24} kg
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                        {fmtNum(row.physicalQty, 1)}{" "}
                        <span className="text-[10px] text-slate-400 font-sans">
                          {row.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-blue-600">
                        {row.transitQty > 0
                          ? `+${fmtNum(row.transitQty, 1)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.value > 0 ? (
                          <div>
                            <div className="font-mono font-bold text-emerald-700">{fmtKes(row.value)}</div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {row.physicalQty} × {row.kgPerUnit ?? 24}kg
                            </div>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Movement trend (7 days) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase text-slate-800 mb-4">
            Movement (7 days)
          </h3>
          {data.movementTrend.length > 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">
                  Receipts (bales in)
                </p>
                <MiniBar
                  items={data.movementTrend.map((d) => ({
                    label: d.date.slice(5),
                    v: d.receiptsKg,
                  }))}
                  valueKey="v"
                  color="bg-emerald-500"
                />
              </div>
              <div>
                <p className="text-[9px] font-bold text-rose-500 uppercase mb-1">
                  Issues (dispatched out)
                </p>
                <MiniBar
                  items={data.movementTrend.map((d) => ({
                    label: d.date.slice(5),
                    v: d.issuesKg,
                  }))}
                  valueKey="v"
                  color="bg-rose-400"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              No movements in the last 7 days.
            </p>
          )}
        </div>
      </section>

      {/* Pending / in-transit inbound transfers */}
      {data.inboundTransfers.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-800">
              Pending inbound transfers
            </h3>
            <button
              type="button"
              onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
              className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5 hover:underline"
            >
              Manage all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.inboundTransfers.map((t) => {
              const meta = INBOUND_STATUS_META[t.status];
              const Icon = meta.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    navigate(ROUTES.INVENTORY_BALE_TRANSFER_DETAIL(t.id))
                  }
                  className="w-full text-left px-5 py-4 hover:bg-slate-50/60 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-black text-slate-800">
                          {t.requestNumber}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.className}`}
                        >
                          <Icon className="h-2.5 w-2.5" />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Requested by {t.requestedBy} ·{" "}
                        {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                      <ul className="mt-1.5 space-y-0.5">
                        {t.items.map((line, i) => (
                          <li key={i} className="text-[11px] text-slate-600">
                            <span className="font-medium">{line.name}</span>
                            {" — "}
                            {line.qtyIssued != null
                              ? `${fmtNum(line.qtyIssued, 1)} ${line.unit} issued`
                              : `${fmtNum(line.qtyRequested, 1)} ${line.unit} requested`}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent movements */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase text-slate-800">
            Recent bale movements (30 days)
          </h3>
        </div>
        {data.recentMovements.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-400">
            No bale movements recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-5 py-2">When</th>
                  <th className="px-5 py-2">SKU</th>
                  <th className="px-5 py-2">Product</th>
                  <th className="px-5 py-2">Type</th>
                  <th className="px-5 py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentMovements.map((m) => {
                  const isInbound = m.movementType === "RECEIPT";
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">
                        {new Date(m.movementAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-2.5 font-mono font-bold text-slate-800">
                        {m.sku}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600 max-w-[140px] truncate">
                        {m.name}
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isInbound
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-rose-700 bg-rose-50 border-rose-200"
                          }`}
                        >
                          {isInbound ? (
                            <ArrowDownToLine className="h-2.5 w-2.5" />
                          ) : (
                            <ArrowUpFromLine className="h-2.5 w-2.5" />
                          )}
                          {isInbound ? "Received" : "Dispatched"}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right font-mono font-bold ${
                          m.quantityDelta >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {m.quantityDelta >= 0 ? "+" : ""}
                        {m.quantityDelta.toFixed(1)} {m.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick actions footer */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS + "?status=APPROVED_IN_TRANSIT")}
          className="flex items-center gap-4 bg-white border border-blue-200 hover:border-blue-300 rounded-2xl p-5 shadow-sm text-left transition-all group"
        >
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">In-transit bales</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {k.inTransitIn > 0
                ? `${k.inTransitIn} transfer${k.inTransitIn !== 1 ? "s" : ""} awaiting receipt`
                : "No bales currently in transit"}
            </p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS + "?status=PENDING")}
          className="flex items-center gap-4 bg-white border border-amber-200 hover:border-amber-300 rounded-2xl p-5 shadow-sm text-left transition-all group"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Request bales</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Pull from Packaging Store when stock runs low
            </p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
        </button>
      </section>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Package, Factory, Box, FileSpreadsheet,
  Wheat, Warehouse, TrendingUp, ArrowRight, Loader2, Layers,
  DollarSign, ArrowLeftRight, ChevronDown,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch } from "../../api/apiClient";
import { getCurrentUser } from "../../auth/authClient";
import { DispatchStoreDashboard } from "./DispatchStoreDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Store = { id: string; code: string; name: string; isActive: boolean };

type DashboardData = {
  storeCode: string | null;
  kpis: {
    totalSkus: number; outOfStock: number; belowReorderCount: number;
    totalValuationKes: number; rawMaizeKg: number;
    grade1BulkKg: number; grade2BulkKg: number;
    grade1Bales: number; grade2Bales: number; packagingMaterialKg: number;
    avgMillingEfficiencyPct: number; avgPackagingYieldPct: number;
    productionRuns30d: number; packagingRuns30d: number;
    inTransitIn?: number; pendingTransfers?: number;
  };
  stockByType: { counts: Record<string, number>; quantitiesKg: Record<string, number> };
  belowReorder: Array<{ id: string; sku: string; name: string; quantity: number; reorderLevel: number; unit: string; shortfall: number }>;
  topStockByValue: Array<{ sku: string; name: string; quantity: number; unit: string; value: number }>;
  movementTrend: Array<{ date: string; receiptsKg: number; issuesKg: number }>;
  productionYieldHistory: Array<{ label: string; efficiencyPct: number }>;
  packagingYieldHistory: Array<{ label: string; yieldPct: number }>;
  recentMovements: Array<{ id: string; sku: string; name: string; movementType: string; quantityDelta: number; movementAt: string; notes?: string | null }>;
  recentProduction: Array<{ batchNumber: string; efficiency: number; rawMaizeConsumed: number; createdAt: string }>;
  recentPackaging: Array<{ runNumber: string; yieldPercent: number; totalPackagedKg: number; createdAt: string }>;
  recentTransfers?: Array<{ id: string; requestNumber: string; status: string; createdAt: string }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtKg = (n?: number | null) =>
  `${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} KG`;
const fmtKes = (n?: number | null) =>
  `KES ${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function MiniBarChart({ items, valueKey, maxHeight = 48, color = "bg-indigo-500" }: {
  items: Array<{ label: string } & Record<string, number | string>>;
  valueKey: string; maxHeight?: number; color?: string;
}) {
  const values = items.map((i) => Number(i[valueKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5 h-14">
      {items.map((item, i) => {
        const v = Number(item[valueKey]) || 0;
        const h = Math.max(4, (v / max) * maxHeight);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className={`w-full rounded-t ${color} opacity-90`} style={{ height: h }} title={`${v}`} />
            <span className="text-[8px] text-slate-400 truncate w-full text-center">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Store Picker (admin only) ─────────────────────────────────────────────────

function StorePicker({ stores, selected, onChange }: {
  stores: Store[]; selected: string | null; onChange: (code: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-extrabold text-slate-400 uppercase">Viewing:</span>
      <div className="relative">
        <select
          aria-label="Select store"
          value={selected ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-400 cursor-pointer"
        >
          <option value="">All Stores (Global)</option>
          {stores.map((s) => (
            <option key={s.id} value={s.code}>{s.name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InventoryDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  // Dispatch store managers get their own tailored dashboard
  if (user?.role === "DISPATCH_STORE_MANAGER") {
    return <DispatchStoreDashboard />;
  }

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin: list of stores for picker
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  // Non-admin: their own store code resolved from /api/stores/me
  const [myStoreCode, setMyStoreCode] = useState<string | null | undefined>(undefined);
  const [myStoreName, setMyStoreName] = useState<string | null>(null);

  // Resolve non-admin store once
  useEffect(() => {
    if (isAdmin) { setMyStoreCode(null); return; }
    apiFetch("/api/stores/me")
      .then((r) => r.json())
      .then((j: { storeCode: string | null; store?: { name: string } | null }) => {
        setMyStoreCode(j.storeCode);
        setMyStoreName(j.store?.name ?? null);
      })
      .catch(() => setMyStoreCode(null));
  }, [isAdmin]);

  // Admin: load store list for picker
  useEffect(() => {
    if (!isAdmin) return;
    apiFetch("/api/stores")
      .then((r) => r.json())
      .then((j: { stores: Store[] }) => setStores(j.stores ?? []))
      .catch(() => null);
  }, [isAdmin]);

  // Effective store code for API calls
  const effectiveStoreCode = isAdmin ? selectedStore : myStoreCode;

  const loadDashboard = useCallback(async (storeCode: string | null | undefined) => {
    if (storeCode === undefined) return; // still loading my store
    setLoading(true);
    try {
      const qs = storeCode ? `?storeCode=${encodeURIComponent(storeCode)}` : "";
      const res = await apiFetch(`/api/inventory/dashboard${qs}`);
      if (res.ok) setData(await res.json());
    } catch { /* offline */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDashboard(effectiveStoreCode); }, [effectiveStoreCode, loadDashboard]);

  const kpis = data?.kpis;
  const isScoped = Boolean(effectiveStoreCode);

  const quickLinks = useMemo(() => [
    { label: "Catalogue", to: ROUTES.INVENTORY_CATALOGUE, icon: Package },
    ...(isAdmin ? [
      { label: "Milling", to: ROUTES.INVENTORY_PRODUCTION, icon: Factory },
      { label: "Packaging", to: ROUTES.INVENTORY_PACKAGING, icon: Box },
    ] : []),
    { label: "Transfers", to: ROUTES.INVENTORY_STOCK_TRANSFERS, icon: ArrowLeftRight },
    { label: "Reports", to: ROUTES.INVENTORY_REPORTS, icon: FileSpreadsheet },
  ], [isAdmin]);

  if (loading || myStoreCode === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const k = {
    totalSkus: kpis?.totalSkus ?? 0, outOfStock: kpis?.outOfStock ?? 0,
    belowReorderCount: kpis?.belowReorderCount ?? 0, totalValuationKes: kpis?.totalValuationKes ?? 0,
    rawMaizeKg: kpis?.rawMaizeKg ?? 0, grade1BulkKg: kpis?.grade1BulkKg ?? 0,
    grade2BulkKg: kpis?.grade2BulkKg ?? 0, grade1Bales: kpis?.grade1Bales ?? 0,
    grade2Bales: kpis?.grade2Bales ?? 0, packagingMaterialKg: kpis?.packagingMaterialKg ?? 0,
    avgMillingEfficiencyPct: kpis?.avgMillingEfficiencyPct ?? 0, avgPackagingYieldPct: kpis?.avgPackagingYieldPct ?? 0,
    productionRuns30d: kpis?.productionRuns30d ?? 0, packagingRuns30d: kpis?.packagingRuns30d ?? 0,
    inTransitIn: kpis?.inTransitIn ?? 0, pendingTransfers: kpis?.pendingTransfers ?? 0,
  };

  const pageTitle = isScoped
    ? (myStoreName ?? (stores.find((s) => s.code === effectiveStoreCode)?.name ?? effectiveStoreCode) ?? "My Store")
    : "Inventory Dashboard";
  const pageSub = isScoped
    ? "Stock levels, movements, and transfer activity for your store."
    : "Global stock health, valuation, milling & packaging performance.";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{pageSub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <StorePicker stores={stores} selected={selectedStore} onChange={setSelectedStore} />
          )}
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button key={link.to} type="button" onClick={() => navigate(link.to)}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-orange-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-lg shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 text-orange-600" />{link.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert banner */}
      {(k.belowReorderCount > 0 || k.outOfStock > 0) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-amber-900">
              {k.belowReorderCount} item{k.belowReorderCount !== 1 ? "s" : ""} at or below reorder level
              {k.outOfStock > 0 ? ` · ${k.outOfStock} out of stock` : ""}
            </p>
            <button type="button" onClick={() => navigate(ROUTES.INVENTORY_CATALOGUE)}
              className="text-amber-800 font-bold mt-1 hover:underline">Review catalogue →</button>
          </div>
        </div>
      )}

      {/* Scoped transfer status (store manager view) */}
      {isScoped && (k.inTransitIn > 0 || k.pendingTransfers > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-blue-500 uppercase">In Transit To Store</p>
            <p className="text-2xl font-black text-blue-900 mt-1">{k.inTransitIn}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-amber-500 uppercase">Pending Approval</p>
            <p className="text-2xl font-black text-amber-900 mt-1">{k.pendingTransfers}</p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: isScoped ? "Items in Store" : "Total SKUs", value: String(k.totalSkus), sub: `${k.outOfStock} out of stock`, icon: Layers, accent: "border-slate-200" },
          { label: "Stock valuation", value: fmtKes(k.totalValuationKes), sub: "At latest unit prices", icon: DollarSign, accent: "border-emerald-200 bg-emerald-50/30" },
          { label: "Below reorder", value: String(k.belowReorderCount), sub: "Needs replenishment", icon: AlertTriangle, accent: "border-amber-200 bg-amber-50/30" },
          { label: isScoped ? "Total on-hand" : "Raw maize", value: isScoped ? fmtKes(k.totalValuationKes) : fmtKg(k.rawMaizeKg), sub: isScoped ? "Store value" : "Bulk grain on hand", icon: isScoped ? Warehouse : Wheat, accent: "border-orange-200 bg-orange-50/30" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-xl border p-5 shadow-sm ${card.accent}`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{card.label}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{card.value}</div>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">{card.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Global-only: bulk flour + operations panels */}
      {!isScoped && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-[10px] uppercase mb-3">
              <Warehouse className="h-4 w-4" /> Bulk flour
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Grade 1 bulk</span><span className="font-mono font-bold">{fmtKg(k.grade1BulkKg)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Grade 2 bulk</span><span className="font-mono font-bold">{fmtKg(k.grade2BulkKg)}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-[10px] uppercase mb-3">
              <Box className="h-4 w-4" /> Packaged (24 kg bales)
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Grade 1 bales</span><span className="font-mono font-bold">{k.grade1Bales} BAG</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Grade 2 bales</span><span className="font-mono font-bold">{k.grade2Bales} BAG</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-500">Pkg material</span><span className="font-mono font-bold">{fmtKg(k.packagingMaterialKg)}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-[10px] uppercase mb-3">
              <TrendingUp className="h-4 w-4" /> Operations (30d)
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Avg milling efficiency</span><span className="font-mono font-bold">{k.avgMillingEfficiencyPct.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Avg packaging yield</span><span className="font-mono font-bold">{k.avgPackagingYieldPct.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Production runs</span><span className="font-mono font-bold">{k.productionRuns30d}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Packaging runs</span><span className="font-mono font-bold">{k.packagingRuns30d}</span></div>
            </div>
          </div>
        </section>
      )}

      {/* Movement trend + stock by type */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!isScoped && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-4">Stock by type</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              {(["RAW_MATERIAL", "FINISHED_GOOD", "BY_PRODUCT"] as const).map((type) => (
                <div key={type} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">{type.replace("_", " ")}</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{data?.stockByType.counts[type] ?? 0}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">{fmtKg(data?.stockByType.quantitiesKg[type] ?? 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm ${isScoped ? "lg:col-span-2" : ""}`}>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">Movement activity (7 days)</h3>
          {(data?.movementTrend?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              <MiniBarChart items={data!.movementTrend.map((d) => ({ label: d.date.slice(5), receipts: d.receiptsKg }))} valueKey="receipts" color="bg-emerald-500" />
              <MiniBarChart items={data!.movementTrend.map((d) => ({ label: d.date.slice(5), issues: d.issuesKg }))} valueKey="issues" color="bg-rose-400" />
              <div className="flex gap-4 text-[9px] font-bold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Receipts</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-400" /> Issues</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">No movements in the last 7 days.</p>
          )}
        </div>
      </section>

      {/* Global-only: yield trends */}
      {!isScoped && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase mb-3">Milling yield trend</h3>
            {(data?.productionYieldHistory?.length ?? 0) > 0
              ? <MiniBarChart items={data!.productionYieldHistory} valueKey="efficiencyPct" color="bg-indigo-500" />
              : <p className="text-xs text-slate-400 text-center py-6">No production batches yet.</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase mb-3">Packaging yield trend</h3>
            {(data?.packagingYieldHistory?.length ?? 0) > 0
              ? <MiniBarChart items={data!.packagingYieldHistory} valueKey="yieldPct" color="bg-orange-500" />
              : <p className="text-xs text-slate-400 text-center py-6">No packaging runs yet.</p>}
          </div>
        </section>
      )}

      {/* Top stock + recent movements */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-slate-800">Top stock by value</h3>
            <button type="button" onClick={() => navigate(ROUTES.INVENTORY_CATALOGUE)} className="text-[10px] font-bold text-orange-600">View all</button>
          </div>
          <ul className="divide-y divide-slate-100 text-xs">
            {(data?.topStockByValue ?? []).slice(0, 6).map((row) => (
              <li key={row.sku} className="px-5 py-3 flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-slate-800">{row.sku}</div>
                  <div className="text-slate-500 truncate">{row.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-emerald-700">{fmtKes(row.value)}</div>
                  <div className="text-slate-400 font-mono">{row.quantity.toFixed(1)} {row.unit}</div>
                </div>
              </li>
            ))}
            {(data?.topStockByValue ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-xs text-slate-400">No stock data yet.</li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-slate-800">Recent stock movements</h3>
            <button type="button" onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)} className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5">
              Transfers <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.recentMovements ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(m.movementAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono font-bold">{m.sku}</td>
                    <td className="px-4 py-2">{m.movementType.replace(/_/g, " ")}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${m.quantityDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(data?.recentMovements ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No recent movements.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Below reorder alert table */}
      {(data?.belowReorder?.length ?? 0) > 0 && (
        <section className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50">
            <h3 className="text-xs font-bold uppercase text-amber-900">Items below reorder level</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left">SKU</th>
                <th className="px-5 py-2 text-left">Name</th>
                <th className="px-5 py-2 text-right">On hand</th>
                <th className="px-5 py-2 text-right">Reorder at</th>
                <th className="px-5 py-2 text-right">Shortfall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.belowReorder.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(ROUTES.INVENTORY_DETAIL(row.id))}>
                  <td className="px-5 py-2 font-mono font-bold">{row.sku}</td>
                  <td className="px-5 py-2">{row.name}</td>
                  <td className="px-5 py-2 text-right font-mono">{row.quantity.toFixed(2)} {row.unit}</td>
                  <td className="px-5 py-2 text-right font-mono">{row.reorderLevel}</td>
                  <td className="px-5 py-2 text-right font-mono text-amber-700">{row.shortfall.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Global-only: recent production + packaging */}
      {!isScoped && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase">Recent milling</h3>
              <button type="button" onClick={() => navigate(ROUTES.INVENTORY_PRODUCTION)} className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">Open <ArrowRight className="h-3 w-3" /></button>
            </div>
            <ul className="space-y-2 text-xs">
              {(data?.recentProduction ?? []).map((b) => (
                <li key={b.batchNumber} className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="font-mono font-bold">{b.batchNumber}</span>
                  <span className="text-slate-500">{b.efficiency.toFixed(1)}% · {fmtKg(b.rawMaizeConsumed)}</span>
                </li>
              ))}
              {(data?.recentProduction ?? []).length === 0 && <li className="text-slate-400 text-center py-4">No production batches yet.</li>}
            </ul>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase">Recent packaging</h3>
              <button type="button" onClick={() => navigate(ROUTES.INVENTORY_PACKAGING)} className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5">Open <ArrowRight className="h-3 w-3" /></button>
            </div>
            <ul className="space-y-2 text-xs">
              {(data?.recentPackaging ?? []).map((r) => (
                <li key={r.runNumber} className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="font-mono font-bold">{r.runNumber}</span>
                  <span className="text-slate-500">{r.yieldPercent.toFixed(1)}% · {fmtKg(r.totalPackagedKg)}</span>
                </li>
              ))}
              {(data?.recentPackaging ?? []).length === 0 && <li className="text-slate-400 text-center py-4">No packaging runs yet.</li>}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

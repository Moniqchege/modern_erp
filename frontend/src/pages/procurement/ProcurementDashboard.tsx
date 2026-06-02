import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Users, FileText, ClipboardList, Scale,
  TrendingUp, DollarSign, AlertTriangle, CheckCircle2,
  GitCompare, ArrowRight, BarChart3, Receipt,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { getAccessToken } from "../../auth/authClient";

// ─── types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  kpis: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalRequisitions: number;
    pendingApprovals: number;
    convertedRequisitions: number;
    totalPOs: number;
    openPOs: number;
    fullyReceivedPOs: number;
    cancelledPOs: number;
    totalSpendKes: number;
    openPOValueKes: number;
    totalGrns: number;
    postedGrns: number;
    pendingQcGrns: number;
    matchedInvoices: number;
    approvedForPayment: number;
    discrepancies: number;
  };
  reqByStatus: Record<string, number>;
  poByStatus: Record<string, number>;
  matchByStatus: Record<string, number>;
  monthlySpend: Array<{
    label: string;
    totalSpend: number;
    vatAmount: number;
    subtotal: number;
    count: number;
  }>;
  topSuppliersBySpend: Array<{
    supplierId: string;
    supplierName: string;
    totalSpend: number;
    poCount: number;
  }>;
  vatBreakdown: Array<{
    taxRate: number;
    poCount: number;
    totalAmount: number;
    taxAmount: number;
  }>;
  recentPOs: Array<{
    id: string;
    poNumber: string;
    status: string;
    currency: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    supplierName: string;
    createdAt: string;
  }>;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtMoney = (n: number, currency = "KES") =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-sky-100 text-sky-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  FULLY_RECEIVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-emerald-50 text-emerald-600",
  CANCELLED: "bg-red-100 text-red-600",
  APPROVED: "bg-emerald-100 text-emerald-700",
  CONVERTED_TO_PO: "bg-indigo-100 text-indigo-700",
  REJECTED: "bg-red-100 text-red-600",
  MATCHED: "bg-emerald-100 text-emerald-700",
  APPROVED_FOR_PAYMENT: "bg-emerald-100 text-emerald-800",
  PRICE_DISCREPANCY: "bg-amber-100 text-amber-700",
  QUANTITY_DISCREPANCY: "bg-amber-100 text-amber-700",
  BOTH_DISCREPANCY: "bg-red-100 text-red-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({
  items, valueKey, color = "bg-emerald-500",
}: {
  items: Array<Record<string, string | number>>;
  valueKey: string;
  color?: string;
}) {
  const values = items.map((i) => Number(i[valueKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {items.map((item, i) => {
        const v = Number(item[valueKey]) || 0;
        const h = Math.max(4, (v / max) * 56);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className={`w-full rounded-t ${color}`}
              style={{ height: h }}
              title={fmtMoney(v)}
            />
            <span className="text-[8px] text-slate-400 truncate w-full text-center">
              {String(item.label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export function ProcurementDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/procurement/dashboard", {
          headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
        });
        const body = await res.json();
        if (res.ok) {
          setData(body);
        } else {
          console.error("[ProcurementDashboard] API error:", body);
          setError(body.message ?? `HTTP ${res.status}`);
        }
      } catch (err) {
        console.error("[ProcurementDashboard] fetch error:", err);
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-bold text-slate-700">Failed to load procurement dashboard</p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  const k = data?.kpis;

  const kpiCards = [
    {
      label: "Active suppliers",
      value: k?.activeSuppliers ?? 0,
      sub: `${k?.totalSuppliers ?? 0} total registered`,
      icon: Users,
      accent: "border-emerald-200 bg-emerald-50/40",
      to: ROUTES.PROCUREMENT_SUPPLIERS,
    },
    {
      label: "Total spend (all POs)",
      value: fmtMoney(k?.totalSpendKes ?? 0),
      sub: "Sum of all PO totals",
      icon: DollarSign,
      accent: "border-indigo-200 bg-indigo-50/30",
      to: ROUTES.PROCUREMENT_POS,
    },
    {
      label: "Open PO value",
      value: fmtMoney(k?.openPOValueKes ?? 0),
      sub: `${k?.openPOs ?? 0} POs in flight`,
      icon: FileText,
      accent: "border-sky-200 bg-sky-50/30",
      to: ROUTES.PROCUREMENT_POS,
    },
    {
      label: "Pending approvals",
      value: k?.pendingApprovals ?? 0,
      sub: "Requisitions awaiting sign-off",
      icon: ClipboardList,
      accent: (k?.pendingApprovals ?? 0) > 0
        ? "border-amber-300 bg-amber-50/60"
        : "border-slate-200",
      to: ROUTES.PROCUREMENT_REQUISITIONS,
    },
    {
      label: "GRNs posted",
      value: k?.postedGrns ?? 0,
      sub: `${k?.pendingQcGrns ?? 0} pending QC`,
      icon: Scale,
      accent: "border-slate-200",
      to: ROUTES.PROCUREMENT_RECEIVING,
    },
    {
      label: "Invoices matched",
      value: k?.matchedInvoices ?? 0,
      sub: `${k?.approvedForPayment ?? 0} approved for payment`,
      icon: GitCompare,
      accent: "border-emerald-200 bg-emerald-50/30",
      to: ROUTES.PROCUREMENT_FINANCE,
    },
    {
      label: "Match discrepancies",
      value: k?.discrepancies ?? 0,
      sub: "Price or quantity mismatches",
      icon: AlertTriangle,
      accent: (k?.discrepancies ?? 0) > 0
        ? "border-amber-300 bg-amber-50/60"
        : "border-slate-200",
      to: ROUTES.PROCUREMENT_FINANCE,
    },
    {
      label: "POs closed / received",
      value: k?.fullyReceivedPOs ?? 0,
      sub: `${k?.cancelledPOs ?? 0} cancelled`,
      icon: CheckCircle2,
      accent: "border-emerald-200 bg-emerald-50/30",
      to: ROUTES.PROCUREMENT_POS,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Procurement reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Spend analytics, supplier performance, PO pipeline, and 3-way match status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Suppliers", to: ROUTES.PROCUREMENT_SUPPLIERS, icon: Users },
            { label: "Requisitions", to: ROUTES.PROCUREMENT_REQUISITIONS, icon: ClipboardList },
            { label: "Purchase Orders", to: ROUTES.PROCUREMENT_POS, icon: FileText },
            { label: "3-Way Match", to: ROUTES.PROCUREMENT_FINANCE, icon: GitCompare },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <button key={link.to} type="button" onClick={() => navigate(link.to)}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-emerald-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-lg shadow-sm transition-colors">
                <Icon className="h-3.5 w-3.5 text-emerald-600" />
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* action alerts */}
      {((k?.pendingApprovals ?? 0) > 0 || (k?.discrepancies ?? 0) > 0 || (k?.pendingQcGrns ?? 0) > 0) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-900">Action required</p>
            {(k?.pendingApprovals ?? 0) > 0 && (
              <p className="text-amber-800">
                {k!.pendingApprovals} requisition{k!.pendingApprovals !== 1 ? "s" : ""} awaiting approval.{" "}
                <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_REQUISITIONS)}
                  className="font-extrabold underline">Review →</button>
              </p>
            )}
            {(k?.pendingQcGrns ?? 0) > 0 && (
              <p className="text-amber-800">
                {k!.pendingQcGrns} GRN{k!.pendingQcGrns !== 1 ? "s" : ""} blocked on QC.{" "}
                <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_RECEIVING)}
                  className="font-extrabold underline">Open receiving →</button>
              </p>
            )}
            {(k?.discrepancies ?? 0) > 0 && (
              <p className="text-amber-800">
                {k!.discrepancies} invoice discrepanc{k!.discrepancies !== 1 ? "ies" : "y"} need resolution.{" "}
                <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_FINANCE)}
                  className="font-extrabold underline">Open finance →</button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.label} type="button" onClick={() => navigate(card.to)}
              className={`text-left rounded-xl border p-5 shadow-sm hover:shadow-md transition-all ${card.accent}`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{card.label}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{card.value}</div>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">{card.sub}</p>
            </button>
          );
        })}
      </section>

      {/* ── spend trend + status breakdown ──────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly spend chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Monthly PO spend (6 months)
            </h3>
          </div>
          {(data?.monthlySpend?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              <MiniBarChart
                items={data!.monthlySpend.map((m) => ({ label: m.label, totalSpend: m.totalSpend }))}
                valueKey="totalSpend"
                color="bg-emerald-500"
              />
              <MiniBarChart
                items={data!.monthlySpend.map((m) => ({ label: m.label, vatAmount: m.vatAmount }))}
                valueKey="vatAmount"
                color="bg-indigo-400"
              />
              <div className="flex gap-4 text-[9px] font-bold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> Total spend
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-indigo-400 inline-block" /> VAT portion
                </span>
              </div>
              <table className="w-full text-[10px] mt-2">
                <thead className="text-slate-400 uppercase border-b border-slate-100">
                  <tr>
                    <th className="pb-1 text-left">Month</th>
                    <th className="pb-1 text-right">POs</th>
                    <th className="pb-1 text-right">Subtotal</th>
                    <th className="pb-1 text-right">VAT</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data!.monthlySpend.map((m) => (
                    <tr key={m.label}>
                      <td className="py-1 font-bold text-slate-700">{m.label}</td>
                      <td className="py-1 text-right text-slate-500">{m.count}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{fmtMoney(m.subtotal)}</td>
                      <td className="py-1 text-right font-mono text-indigo-600">{fmtMoney(m.vatAmount)}</td>
                      <td className="py-1 text-right font-mono font-bold text-slate-900">{fmtMoney(m.totalSpend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">No POs in the last 6 months.</p>
          )}
        </div>

        {/* PO status + Requisition status breakdown */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-sky-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">PO pipeline</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(data?.poByStatus ?? {}).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <StatusPill status={status} />
                  <span className="font-mono font-bold text-slate-800">{count}</span>
                </div>
              ))}
              {Object.keys(data?.poByStatus ?? {}).length === 0 && (
                <p className="text-xs text-slate-400">No purchase orders yet.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Requisition pipeline</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(data?.reqByStatus ?? {}).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <StatusPill status={status} />
                  <span className="font-mono font-bold text-slate-800">{count}</span>
                </div>
              ))}
              {Object.keys(data?.reqByStatus ?? {}).length === 0 && (
                <p className="text-xs text-slate-400">No requisitions yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── top suppliers + VAT breakdown ────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top suppliers by spend */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase text-slate-800">Top suppliers by spend (90d)</h3>
            </div>
            <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_SUPPLIERS)}
              className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {(data?.topSuppliersBySpend.length ?? 0) > 0 ? (
            <ul className="divide-y divide-slate-100 text-xs">
              {data!.topSuppliersBySpend.map((s, i) => (
                <li key={s.supplierId}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => navigate(ROUTES.PROCUREMENT_SUPPLIER_DETAIL(s.supplierId))}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-extrabold text-slate-400 w-4 shrink-0">#{i + 1}</span>
                    <span className="font-semibold text-slate-800 truncate">{s.supplierName}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-emerald-700">{fmtMoney(s.totalSpend)}</div>
                    <div className="text-[10px] text-slate-400">{s.poCount} PO{s.poCount !== 1 ? "s" : ""}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-xs text-slate-400 text-center">No PO data in the last 90 days.</p>
          )}
        </div>

        {/* VAT breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">VAT breakdown</h3>
          </div>
          {(data?.vatBreakdown.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data!.vatBreakdown.sort((a, b) => b.poCount - a.poCount).map((v) => (
                <div key={v.taxRate} className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${v.taxRate > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"}`}>
                      {v.taxRate > 0 ? `VAT ${v.taxRate}%` : "No VAT"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{v.poCount} PO{v.poCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Net (excl. VAT)</p>
                      <p className="font-mono font-bold text-slate-800">{fmtMoney(v.totalAmount - v.taxAmount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">VAT collected</p>
                      <p className="font-mono font-bold text-indigo-700">{fmtMoney(v.taxAmount)}</p>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200">
                      <p className="text-slate-500">Gross total</p>
                      <p className="font-mono font-black text-slate-900">{fmtMoney(v.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">No PO data available.</p>
          )}
        </div>
      </section>

      {/* ── 3-way match status + recent POs ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 3-way match status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">3-Way match</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(data?.matchByStatus ?? {}).sort(([,a],[,b]) => b - a).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <StatusPill status={status} />
                <span className="font-mono font-bold text-slate-800">{count}</span>
              </div>
            ))}
            {Object.keys(data?.matchByStatus ?? {}).length === 0 && (
              <p className="text-xs text-slate-400">No matches run yet.</p>
            )}
          </div>
          <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_FINANCE)}
            className="mt-4 text-[10px] font-bold text-indigo-600 flex items-center gap-0.5 hover:underline">
            Open Finance <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* recent POs table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-600" />
              <h3 className="text-xs font-bold uppercase text-slate-800">Recent purchase orders</h3>
            </div>
            <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_POS)}
              className="text-[10px] font-bold text-sky-600 flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">PO No.</th>
                  <th className="px-4 py-2.5 text-left">Supplier</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Subtotal</th>
                  <th className="px-4 py-2.5 text-right">VAT</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.recentPOs ?? []).map((po) => (
                  <tr key={po.id}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                    onClick={() => navigate(ROUTES.PROCUREMENT_PO_DETAIL(po.id))}>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{po.poNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[120px] truncate">{po.supplierName}</td>
                    <td className="px-4 py-2.5 text-center"><StatusPill status={po.status} /></td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      {po.currency} {po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-indigo-600">
                      {po.taxAmount > 0
                        ? po.currency + " " + po.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                      {po.currency} {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{fmtDate(po.createdAt)}</td>
                  </tr>
                ))}
                {(data?.recentPOs.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No purchase orders found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}

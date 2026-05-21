import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileText, Scale, Users, AlertTriangle } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { procurementApi } from "../../modules/procurement/api/procurementClient";

type StatCard = {
  label: string;
  value: number;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

export function ProcurementDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    openPOs: 0,
    pendingGrn: 0,
    activeSuppliers: 0,
  });

  useEffect(() => {
    void (async () => {
      try {
        const [reqs, pos, grns, suppliers] = await Promise.all([
          procurementApi.requisitions.list(),
          procurementApi.purchaseOrders.list(),
          procurementApi.grns.list(),
          procurementApi.suppliers.list(true),
        ]);
        const requisitions = reqs.requisitions as { status: string }[];
        setStats({
          pendingApprovals: requisitions.filter((r) =>
            r.status.startsWith("PENDING")
          ).length,
          openPOs: (pos.purchaseOrders as { status: string }[]).filter((p) =>
            ["ISSUED", "PARTIALLY_RECEIVED"].includes(p.status)
          ).length,
          pendingGrn: (grns.grns as { status: string }[]).filter(
            (g) => g.status === "PENDING_QC"
          ).length,
          activeSuppliers: (suppliers.suppliers as unknown[]).length,
        });
      } catch {
        /* keep zeros when offline */
      }
    })();
  }, []);

  const cards: StatCard[] = [
    {
      label: "Pending approvals",
      value: stats.pendingApprovals,
      to: ROUTES.PROCUREMENT_REQUISITIONS,
      icon: ClipboardList,
      accent: "border-amber-200 bg-amber-50/50",
    },
    {
      label: "Open purchase orders",
      value: stats.openPOs,
      to: ROUTES.PROCUREMENT_POS,
      icon: FileText,
      accent: "border-indigo-200 bg-indigo-50/50",
    },
    {
      label: "GRNs awaiting QC",
      value: stats.pendingGrn,
      to: ROUTES.PROCUREMENT_RECEIVING,
      icon: Scale,
      accent: "border-sky-200 bg-sky-50/50",
    },
    {
      label: "Active suppliers",
      value: stats.activeSuppliers,
      to: ROUTES.PROCUREMENT_SUPPLIERS,
      icon: Users,
      accent: "border-emerald-200 bg-emerald-50/50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Procurement dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Requisition → approval → PO → weighbridge & QC → GRN → 3-way match → AP
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => navigate(c.to)}
              className={`text-left rounded-xl border p-5 shadow-sm hover:shadow-md transition-all ${c.accent}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {c.label}
                </span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-3">{c.value}</div>
              <span className="text-[10px] font-bold text-emerald-700 mt-2 inline-block">
                View →
              </span>
            </button>
          );
        })}
      </div>

      {(stats.pendingGrn > 0 || stats.pendingApprovals > 0) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-900">Action required</p>
            <p className="text-amber-800 mt-1">
              {stats.pendingApprovals > 0 &&
                `${stats.pendingApprovals} requisition(s) need approval. `}
              {stats.pendingGrn > 0 &&
                `${stats.pendingGrn} GRN(s) blocked until lab QC is logged.`}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
          Standard receiving workflow
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-600 list-decimal list-inside">
          <li>Raise or auto-generate requisition</li>
          <li>Head Procurement / Finance approval</li>
          <li>Issue purchase order to supplier</li>
          <li>Capture weighbridge gross / tare / net</li>
          <li>Lab QC — moisture, aflatoxin, grade</li>
          <li>Post GRN → inventory receipt event</li>
        </ol>
      </div>
    </div>
  );
}

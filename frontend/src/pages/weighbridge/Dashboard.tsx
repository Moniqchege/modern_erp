/**
 * Screen 4 — Executive Analytics Dashboard
 *
 * KPI cards + visual chart for daily traffic + recent tickets list.
 * Pure SVG bar chart (no external chart lib).
 */
import React, { useEffect, useState } from "react";
import {
  Loader2,
  LayoutDashboard,
  Wheat,
  Truck,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import { weighbridgeApi } from "../../modules/weighbridge/api";
import type { WeighbridgeDashboardData } from "../../modules/weighbridge/types";
import {
  fmtDate,
  fmtKg,
  fmtMoney,
  fmtNum,
  statusBadgeClass,
  ticketTypeLabel,
} from "../../modules/weighbridge/format";

export function WeighbridgeDashboard() {
  const [data, setData] = useState<WeighbridgeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    weighbridgeApi
      .dashboard()
      .then((res) => alive && setData(res.data))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-rose-600 py-12 justify-center">
        <AlertTriangle className="h-4 w-4" /> {error ?? "No data"}
      </div>
    );
  }

  const k = data.kpis;
  const maxDaily = Math.max(
    1,
    ...data.dailyTraffic.map((d) => d.purchases + d.sales + d.others)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-sky-600" />
          Executive Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          KPIs, traffic trends, recent activity
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          icon={<Wheat className="h-4 w-4" />}
          label="Total Maize Received"
          value={`${fmtNum(k.totalMaizeReceivedMt, 2)} MT`}
          sub="completed PURCHASE tickets"
          accent="emerald"
        />
        <KpiCard
          icon={<Truck className="h-4 w-4" />}
          label="Total Flour Dispatched"
          value={`${fmtNum(k.totalFlourDispatchedMt, 2)} MT`}
          sub="completed SALE tickets"
          accent="indigo"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Revenue (Others)"
          value={fmtMoney(k.othersRevenue, "KES", 0)}
          sub="collected from 3rd-party services"
          accent="amber"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tickets Today"
          value={fmtNum(k.totalTicketsToday)}
          sub={`${k.completedTicketsToday} completed`}
          accent="sky"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending Tickets"
          value={fmtNum(k.pendingTickets)}
          sub="awaiting second weight"
          accent="rose"
        />
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Daily Traffic (latest)"
          value={
            data.dailyTraffic.length
              ? `${fmtNum(
                  data.dailyTraffic[data.dailyTraffic.length - 1].total
                )} trucks`
              : "—"
          }
          sub={
            data.dailyTraffic.length
              ? data.dailyTraffic[data.dailyTraffic.length - 1].date
              : "no data"
          }
          accent="slate"
        />
      </div>

      {/* Daily traffic chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-sky-500" />
            Daily truck traffic (last 14 days)
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-extrabold text-slate-500">
            <Legend color="bg-emerald-500" label="Purchases" />
            <Legend color="bg-indigo-500" label="Sales" />
            <Legend color="bg-amber-500" label="Others" />
          </div>
        </div>

        {data.dailyTraffic.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-12 text-center">
            No traffic data in the last 14 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-[640px] h-56">
              {data.dailyTraffic.map((d) => {
                const total = d.purchases + d.sales + d.others;
                const totalH = (total / maxDaily) * 200;
                const purH = (d.purchases / maxDaily) * 200;
                const salH = (d.sales / maxDaily) * 200;
                const othH = (d.others / maxDaily) * 200;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${d.date}: ${total} trucks (P:${d.purchases} S:${d.sales} O:${d.others})`}
                  >
                    <span className="text-[9px] font-extrabold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {total}
                    </span>
                    <div
                      className="w-full flex flex-col justify-end rounded-md overflow-hidden bg-slate-100"
                      style={{ height: 200 }}
                    >
                      <div
                        className="bg-emerald-500"
                        style={{ height: purH }}
                      />
                      <div
                        className="bg-indigo-500"
                        style={{ height: salH }}
                      />
                      <div
                        className="bg-amber-500"
                        style={{ height: othH }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Recent tickets */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Recent Tickets</h2>
          <span className="text-[10px] text-slate-400">
            Latest {data.recentTickets.length} tickets
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Ticket</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Party</th>
                <th className="px-4 py-2 text-left">Plate</th>
                <th className="px-4 py-2 text-right">Net</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentTickets.map((t) => (
                <tr
                  key={t.id}
                  className={
                    t.isManual
                      ? "bg-rose-50/60 text-rose-900 hover:bg-rose-50"
                      : "hover:bg-slate-50"
                  }
                >
                  <td className="px-4 py-2 font-mono font-bold">
                    {t.ticketNumber}
                    {t.isManual && (
                      <span
                        className="ml-2 inline-block bg-rose-600 text-white px-1.5 py-0.5 rounded text-[9px] font-extrabold"
                        title="Manual entry"
                      >
                        MANUAL
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                        t.type === "PURCHASE"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.type === "SALE"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ticketTypeLabel(t.type)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {t.supplierName ?? t.customerName ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500">
                    {t.vehiclePlate ?? t.truckMaster?.licensePlate ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold">
                    {fmtKg(t.netWeightKg, 0)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${statusBadgeClass(t.status)}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "indigo" | "amber" | "sky" | "rose" | "slate";
}) {
  const ring: Record<string, string> = {
    emerald: "ring-emerald-100 bg-emerald-50 text-emerald-700",
    indigo: "ring-indigo-100 bg-indigo-50 text-indigo-700",
    amber: "ring-amber-100 bg-amber-50 text-amber-700",
    sky: "ring-sky-100 bg-sky-50 text-sky-700",
    rose: "ring-rose-100 bg-rose-50 text-rose-700",
    slate: "ring-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div
        className={`inline-flex p-1.5 rounded-lg ring-1 ${ring[accent]} mb-2`}
      >
        {icon}
      </div>
      <p className="text-[10px] font-extrabold tracking-wider uppercase text-slate-500">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
